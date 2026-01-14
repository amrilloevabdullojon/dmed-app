import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { extname } from 'path'
import { prisma } from '@/lib/prisma'
import { createLetterSchema } from '@/lib/schemas'
import { addWorkingDays, sanitizeInput } from '@/lib/utils'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit'
import {
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_FILE_TYPES,
  DEFAULT_DEADLINE_WORKING_DAYS,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_LABEL,
  PORTAL_TOKEN_EXPIRY_DAYS,
} from '@/lib/constants'
import { saveLocalUpload } from '@/lib/file-storage'
import { FileStatus, FileStorageProvider } from '@prisma/client'
import { syncFileToDrive } from '@/lib/file-sync'
import { buildApplicantPortalLink, sendMultiChannelNotification } from '@/lib/notifications'
import { dispatchNotification } from '@/lib/notification-dispatcher'
import { logger } from '@/lib/logger.server'

const APPLICANT_EMAIL = 'applicant@portal.local'
const APPLICANT_NAME = '\u0417\u0430\u044f\u0432\u0438\u0442\u0435\u043b\u044c'

const UPLOAD_STRATEGY = process.env.FILE_UPLOAD_STRATEGY || 'async'
const ENABLE_ASYNC_SYNC = process.env.FILE_SYNC_ASYNC !== 'false'
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

const MAX_FILES = 5

type TurnstileVerifyResponse = {
  success: boolean
  'error-codes'?: string[]
  challenge_ts?: string
  hostname?: string
  action?: string
  cdata?: string
}

const ALLOWED_LETTER_EXTENSIONS = new Set(
  ALLOWED_FILE_EXTENSIONS.split(',')
    .map((ext) => ext.trim().toLowerCase())
    .filter(Boolean)
)

const getFormFiles = (formData: FormData) => {
  const entries = formData.getAll('files')
  if (entries.length > 0) {
    return entries.filter((item): item is File => item instanceof File)
  }
  const fallback = formData.get('file')
  return fallback instanceof File ? [fallback] : []
}

const isFileTypeAllowed = (file: File) => {
  const ext = extname(file.name).toLowerCase()
  const extensionAllowed = ALLOWED_LETTER_EXTENSIONS.has(ext)
  if (!file.type) return extensionAllowed
  const mimeAllowed = ALLOWED_FILE_TYPES.includes(file.type as (typeof ALLOWED_FILE_TYPES)[number])
  return mimeAllowed || extensionAllowed
}

const verifyTurnstileToken = async (token: string, clientId: string) => {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    return { success: false, data: null }
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  })

  if (clientId && clientId !== 'anonymous') {
    body.set('remoteip', clientId)
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  })

  const data = (await response.json().catch(() => null)) as TurnstileVerifyResponse | null

  return {
    success: Boolean(response.ok && data?.success),
    data,
  }
}

async function getApplicantUser() {
  return prisma.user.upsert({
    where: { email: APPLICANT_EMAIL },
    update: { name: APPLICANT_NAME, canLogin: false },
    create: {
      email: APPLICANT_EMAIL,
      name: APPLICANT_NAME,
      role: 'VIEWER',
      canLogin: false,
      notifyEmail: false,
      notifyTelegram: false,
      notifySms: false,
      notifyInApp: false,
    },
    select: { id: true },
  })
}

const resolveAutoOwnerId = async () => {
  const users = await prisma.user.findMany({
    where: { canLogin: true },
    select: { id: true },
  })

  if (users.length === 0) return null

  const userIds = users.map((user) => user.id)
  const counts = await prisma.letter.groupBy({
    by: ['ownerId'],
    where: {
      ownerId: { in: userIds },
      deletedAt: null,
      status: { notIn: ['READY', 'DONE'] },
    },
    _count: { _all: true },
  })

  const countByUser = new Map(counts.map((item) => [item.ownerId, item._count._all]))
  const sorted = [...userIds].sort((a, b) => {
    const countA = countByUser.get(a) || 0
    const countB = countByUser.get(b) || 0
    if (countA !== countB) return countA - countB
    return a.localeCompare(b)
  })

  return sorted[0] || null
}

export async function POST(request: NextRequest) {
  const clientId = getClientIdentifier(request.headers)
  const rateLimitResult = await checkRateLimit(
    `${clientId}:/api/portal/letters:POST`,
    RATE_LIMITS.upload.limit,
    RATE_LIMITS.upload.windowMs
  )

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error:
          '\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u0447\u0430\u0441\u0442\u044b\u0435 \u0437\u0430\u043f\u0440\u043e\u0441\u044b. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043f\u043e\u0437\u0436\u0435.',
      },
      { status: 429 }
    )
  }

  try {
    const formData = await request.formData()
    const turnstileToken = (formData.get('cf-turnstile-response') || '').toString().trim()
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY

    if (!turnstileSecret && process.env.NODE_ENV === 'production') {
      logger.error('POST /api/portal/letters', 'Turnstile secret key is missing')
      return NextResponse.json({ error: 'Captcha is not configured.' }, { status: 500 })
    }

    if (turnstileSecret) {
      if (!turnstileToken) {
        return NextResponse.json({ error: 'Captcha is required.' }, { status: 400 })
      }

      const verification = await verifyTurnstileToken(turnstileToken, clientId)
      if (!verification.success) {
        logger.warn('POST /api/portal/letters', 'Turnstile verification failed', {
          errorCodes: verification.data?.['error-codes'],
          clientId,
        })
        return NextResponse.json({ error: 'Captcha verification failed.' }, { status: 400 })
      }
    }

    const honeypot = (formData.get('website') || '').toString().trim()
    if (honeypot) {
      return NextResponse.json({ error: 'Spam detected.' }, { status: 400 })
    }

    const rawData = {
      number: (formData.get('number') || '').toString().trim(),
      org: (formData.get('org') || '').toString().trim(),
      date: (formData.get('date') || '').toString().trim(),
      deadlineDate: (formData.get('deadlineDate') || '').toString().trim(),
      content: (formData.get('content') || '').toString().trim(),
      contacts: (formData.get('contacts') || '').toString().trim(),
      applicantName: (formData.get('applicantName') || '').toString().trim(),
      applicantEmail: (formData.get('applicantEmail') || '').toString().trim(),
      applicantPhone: (formData.get('applicantPhone') || '').toString().trim(),
      applicantTelegramChatId: (formData.get('applicantTelegramChatId') || '').toString().trim(),
    }

    const hasContact =
      Boolean(rawData.applicantEmail) ||
      Boolean(rawData.applicantPhone) ||
      Boolean(rawData.applicantTelegramChatId)

    if (!hasContact) {
      return NextResponse.json(
        {
          error:
            '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 email, \u0442\u0435\u043b\u0435\u0444\u043e\u043d \u0438\u043b\u0438 Telegram \u0434\u043b\u044f \u043e\u0442\u0432\u0435\u0442\u0430.',
        },
        { status: 400 }
      )
    }

    const parsed = createLetterSchema.safeParse(rawData)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid data.' },
        { status: 400 }
      )
    }

    const data = parsed.data
    data.number = sanitizeInput(data.number, 50)
    data.org = sanitizeInput(data.org, 500)
    if (data.content) data.content = sanitizeInput(data.content, 10000)
    if (data.contacts) data.contacts = sanitizeInput(data.contacts, 500)
    if (data.applicantName) data.applicantName = sanitizeInput(data.applicantName, 200)
    if (data.applicantEmail) data.applicantEmail = sanitizeInput(data.applicantEmail, 320)
    if (data.applicantPhone) data.applicantPhone = sanitizeInput(data.applicantPhone, 50)
    if (data.applicantTelegramChatId)
      data.applicantTelegramChatId = sanitizeInput(data.applicantTelegramChatId, 50)

    const existing = await prisma.letter.findFirst({
      where: {
        number: { equals: data.number, mode: 'insensitive' },
        deletedAt: null,
      },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json(
        {
          error:
            '\u041f\u0438\u0441\u044c\u043c\u043e \u0441 \u0442\u0430\u043a\u0438\u043c \u043d\u043e\u043c\u0435\u0440\u043e\u043c \u0443\u0436\u0435 \u0435\u0441\u0442\u044c.',
        },
        { status: 409 }
      )
    }

    const ownerId = await resolveAutoOwnerId()
    const applicantAccessToken = randomUUID()
    const applicantAccessTokenExpiresAt = new Date(
      Date.now() + 1000 * 60 * 60 * 24 * PORTAL_TOKEN_EXPIRY_DAYS
    )
    const deadlineDate =
      data.deadlineDate || addWorkingDays(data.date, DEFAULT_DEADLINE_WORKING_DAYS)

    const letter = await prisma.letter.create({
      data: {
        number: data.number,
        org: data.org,
        date: data.date,
        deadlineDate,
        content: data.content,
        contacts: data.contacts,
        applicantName: data.applicantName,
        applicantEmail: data.applicantEmail || null,
        applicantPhone: data.applicantPhone || null,
        applicantTelegramChatId: data.applicantTelegramChatId || null,
        applicantAccessToken,
        applicantAccessTokenExpiresAt,
        ownerId,
        status: 'NOT_REVIEWED',
        priority: 50,
      },
    })

    const applicantUser = await getApplicantUser()
    await prisma.history.create({
      data: {
        letterId: letter.id,
        userId: applicantUser.id,
        field: 'created',
        newValue: JSON.stringify({ number: letter.number, org: letter.org }),
      },
    })

    if (ownerId) {
      await prisma.watcher.createMany({
        data: [{ letterId: letter.id, userId: ownerId }],
        skipDuplicates: true,
      })

      await dispatchNotification({
        event: 'ASSIGNMENT',
        title: `\u041d\u043e\u0432\u043e\u0435 \u043f\u0438\u0441\u044c\u043c\u043e \u2116-${letter.number}`,
        body: letter.org,
        letterId: letter.id,
        actorId: applicantUser.id,
        userIds: [ownerId],
      })
    }

    const files = getFormFiles(formData)
    const filesFailed: { name: string; reason: string }[] = []
    let savedFiles = 0

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        {
          error: `\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u0444\u0430\u0439\u043b\u043e\u0432. \u041c\u0430\u043a\u0441. ${MAX_FILES}.`,
        },
        { status: 400 }
      )
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        filesFailed.push({
          name: file.name,
          reason: `\u0424\u0430\u0439\u043b \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0431\u043e\u043b\u044c\u0448\u043e\u0439 (max ${MAX_FILE_SIZE_LABEL}).`,
        })
        continue
      }

      if (!isFileTypeAllowed(file)) {
        filesFailed.push({
          name: file.name,
          reason:
            '\u0422\u0438\u043f \u0444\u0430\u0439\u043b\u0430 \u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f.',
        })
        continue
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storedFileName = `${Date.now()}_${safeName}`
      const buffer = Buffer.from(await file.arrayBuffer())
      const localUpload = await saveLocalUpload({
        buffer,
        letterId: letter.id,
        fileName: storedFileName,
      })

      let fileRecord = await prisma.file.create({
        data: {
          name: file.name,
          url: localUpload.url,
          size: file.size,
          mimeType: file.type,
          letterId: letter.id,
          storageProvider: FileStorageProvider.LOCAL,
          storagePath: localUpload.storagePath,
          status: FileStatus.PENDING_SYNC,
        },
      })

      const queueSync = () => {
        if (!ENABLE_ASYNC_SYNC) return
        setTimeout(() => {
          syncFileToDrive(fileRecord.id).catch((error) => {
            logger.error('Background drive sync failed', error, { fileId: fileRecord.id })
          })
        }, 0)
      }

      if (UPLOAD_STRATEGY === 'sync') {
        try {
          const uploadResult = await syncFileToDrive(fileRecord.id)
          if (uploadResult) {
            const refreshed = await prisma.file.findUnique({
              where: { id: fileRecord.id },
            })
            if (refreshed) {
              fileRecord = refreshed
            }
          } else {
            queueSync()
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Drive upload failed'
          await prisma.file.update({
            where: { id: fileRecord.id },
            data: { uploadError: message, status: FileStatus.PENDING_SYNC },
          })
          queueSync()
        }
      } else {
        queueSync()
      }

      savedFiles += 1
    }

    const portalLink = buildApplicantPortalLink(applicantAccessToken)
    const subject = `\u0412\u0430\u0448\u0435 \u043f\u0438\u0441\u044c\u043c\u043e \u2116-${letter.number} \u043f\u0440\u0438\u043d\u044f\u0442\u043e`
    const text = `\u041f\u0438\u0441\u044c\u043c\u043e \u043f\u0440\u0438\u043d\u044f\u0442\u043e \u0432 \u0440\u0430\u0431\u043e\u0442\u0443.\n\n\u041d\u043e\u043c\u0435\u0440: ${letter.number}\n\u041e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u044f: ${letter.org}\n\u0414\u0435\u0434\u043b\u0430\u0439\u043d: ${new Date(letter.deadlineDate).toLocaleDateString('ru-RU')}\n\n\u0421\u0441\u044b\u043b\u043a\u0430: ${portalLink}`
    const telegram = `\n<b>\u041f\u0438\u0441\u044c\u043c\u043e \u043f\u0440\u0438\u043d\u044f\u0442\u043e</b>\n\n\u2116-${letter.number}\n${letter.org}\n\u0414\u0435\u0434\u043b\u0430\u0439\u043d: ${new Date(letter.deadlineDate).toLocaleDateString('ru-RU')}\n\n<a href="${portalLink}">\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0441\u0442\u0430\u0442\u0443\u0441</a>`

    await sendMultiChannelNotification(
      {
        email: letter.applicantEmail,
        phone: letter.applicantPhone,
        telegramChatId: letter.applicantTelegramChatId,
      },
      { subject, text, telegram }
    )

    return NextResponse.json(
      {
        success: true,
        letterId: letter.id,
        portalLink,
        filesUploaded: savedFiles,
        filesFailed,
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error('POST /api/portal/letters', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withValidation } from '@/lib/api-handler'
import { requestQuerySchema, createRequestSchema } from '@/lib/schemas'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeInput } from '@/lib/utils'
import {
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_LABEL,
  REQUEST_ALLOWED_FILE_EXTENSIONS,
  REQUEST_ALLOWED_FILE_TYPES,
  REQUEST_MAX_FILES,
} from '@/lib/constants'
import { saveLocalRequestUpload } from '@/lib/file-storage'
import { FileStorageProvider, Prisma } from '@prisma/client'
import { formatNewRequestMessage, sendTelegramMessage } from '@/lib/telegram'
import { createHash } from 'crypto'
import { extname } from 'path'

const ALLOWED_REQUEST_EXTENSIONS = new Set(
  REQUEST_ALLOWED_FILE_EXTENSIONS.split(',')
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
  const extensionAllowed = ALLOWED_REQUEST_EXTENSIONS.has(ext)

  if (!file.type) {
    return extensionAllowed
  }

  const mimeAllowed = REQUEST_ALLOWED_FILE_TYPES.includes(
    file.type as (typeof REQUEST_ALLOWED_FILE_TYPES)[number]
  )
  return mimeAllowed || extensionAllowed
}

const buildRequestIpHash = (identifier: string) =>
  createHash('sha256').update(identifier).digest('hex')

export const GET = withValidation(
  async (_request, _session, { query }) => {
    const { page, limit, status, search } = query
    const where: Prisma.RequestWhereInput = {}

    if (status) {
      where.status = status
    }

    if (search) {
      const value = search.trim()
      if (value) {
        where.OR = [
          { organization: { contains: value, mode: 'insensitive' } },
          { contactName: { contains: value, mode: 'insensitive' } },
          { contactEmail: { contains: value, mode: 'insensitive' } },
          { contactPhone: { contains: value, mode: 'insensitive' } },
          { contactTelegram: { contains: value, mode: 'insensitive' } },
          { description: { contains: value, mode: 'insensitive' } },
        ]
      }
    }

    const [requests, total] = await Promise.all([
      prisma.request.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          _count: { select: { files: true } },
        },
      }),
      prisma.request.count({ where }),
    ])

    return NextResponse.json({
      requests: requests.map((request) => ({
        ...request,
        description: request.description ? request.description.slice(0, 240) : '',
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  },
  { querySchema: requestQuerySchema, rateLimit: 'search' }
)

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request.headers)
    const rateLimitResult = checkRateLimit(
      `${clientId}:/api/requests:POST`,
      RATE_LIMITS.upload.limit,
      RATE_LIMITS.upload.windowMs
    )

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const formData = await request.formData()
    const rawData = {
      organization: (formData.get('organization') || '').toString().trim(),
      contactName: (formData.get('contactName') || '').toString().trim(),
      contactEmail: (formData.get('contactEmail') || '').toString().trim(),
      contactPhone: (formData.get('contactPhone') || '').toString().trim(),
      contactTelegram: (formData.get('contactTelegram') || '').toString().trim(),
      description: (formData.get('description') || '').toString().trim(),
    }

    const validation = createRequestSchema.safeParse(rawData)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Invalid request data.' },
        { status: 400 }
      )
    }

    const files = getFormFiles(formData)
    if (files.length > REQUEST_MAX_FILES) {
      return NextResponse.json(
        { error: `Too many files. Max ${REQUEST_MAX_FILES}.` },
        { status: 400 }
      )
    }

    const honeypot = (formData.get('website') || '').toString().trim()
    const isSpam = Boolean(honeypot)

    const requestRecord = await prisma.request.create({
      data: {
        organization: sanitizeInput(rawData.organization, 500),
        contactName: sanitizeInput(rawData.contactName, 200),
        contactEmail: sanitizeInput(rawData.contactEmail, 320),
        contactPhone: sanitizeInput(rawData.contactPhone, 50),
        contactTelegram: sanitizeInput(rawData.contactTelegram, 100),
        description: sanitizeInput(rawData.description, 10000),
        status: isSpam ? 'SPAM' : 'NEW',
        source: sanitizeInput(
          request.headers.get('referer') || 'web',
          200
        ),
        ipHash: buildRequestIpHash(clientId),
      },
    })

    const filesFailed: { name: string; reason: string }[] = []
    let savedFiles = 0

    if (!isSpam) {
      for (const [index, file] of files.entries()) {
        if (!file || !(file instanceof File)) continue

        if (file.size > MAX_FILE_SIZE) {
          filesFailed.push({
            name: file.name,
            reason: `File too large (max ${MAX_FILE_SIZE_LABEL}).`,
          })
          continue
        }

        if (!isFileTypeAllowed(file)) {
          filesFailed.push({
            name: file.name,
            reason: 'File type not allowed.',
          })
          continue
        }

        const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storedFileName = `${Date.now()}_${index}_${safeFileName}`

        try {
          const buffer = Buffer.from(await file.arrayBuffer())
          const upload = await saveLocalRequestUpload({
            buffer,
            requestId: requestRecord.id,
            fileName: storedFileName,
          })

          await prisma.requestFile.create({
            data: {
              name: file.name,
              url: upload.url,
              mimeType: file.type,
              size: file.size,
              requestId: requestRecord.id,
              storageProvider: FileStorageProvider.LOCAL,
              storagePath: upload.storagePath,
            },
          })
          savedFiles++
        } catch (error) {
          console.error('Request file upload failed:', error)
          filesFailed.push({
            name: file.name,
            reason: 'Upload failed.',
          })
        }
      }

      const chatId =
        process.env.TELEGRAM_REQUESTS_CHAT_ID ||
        process.env.TELEGRAM_ADMIN_CHAT_ID

      if (chatId) {
        const message = formatNewRequestMessage({
          id: requestRecord.id,
          organization: requestRecord.organization,
          contactName: requestRecord.contactName,
          contactEmail: requestRecord.contactEmail,
          contactPhone: requestRecord.contactPhone,
          contactTelegram: requestRecord.contactTelegram,
          description: requestRecord.description,
          filesCount: savedFiles,
        })
        await sendTelegramMessage(chatId, message)
      }
    }

    return NextResponse.json(
      {
        success: true,
        requestId: requestRecord.id,
        filesFailed,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/requests error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

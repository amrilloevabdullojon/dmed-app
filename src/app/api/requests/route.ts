import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withValidation } from '@/lib/api-handler'
import { requestQuerySchema, createRequestSchema, type RequestQueryInput } from '@/lib/schemas'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeInput } from '@/lib/utils'
import { getRequestContext } from '@/lib/request-context'
import {
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_LABEL,
  PAGE_SIZE,
  REQUEST_ALLOWED_FILE_EXTENSIONS,
  REQUEST_ALLOWED_FILE_TYPES,
  REQUEST_MAX_FILES,
} from '@/lib/constants'
import { saveLocalRequestUpload } from '@/lib/file-storage'
import { FileStorageProvider, Prisma } from '@prisma/client'
import { formatNewRequestMessage, sendTelegramMessage } from '@/lib/telegram'
import { createHash, randomUUID } from 'crypto'
import { extname } from 'path'
import { logger } from '@/lib/logger'

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

type RequestsListResponse = {
  requests: Array<{
    id: string
    organization: string
    contactName: string
    contactEmail: string
    contactPhone: string
    contactTelegram: string
    description: string
    status: string
    createdAt: Date
    updatedAt: Date
    source: string | null
    ipHash: string | null
    assignedTo: { id: string; name: string | null; email: string | null } | null
    _count: { files: number }
  }>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

type RequestsListError = {
  error: string
  details?: string
  requestId?: string
}

type RequestsListResult = RequestsListResponse | RequestsListError

export const GET = withValidation<RequestsListResult, unknown, RequestQueryInput>(
  async (_request, _session, { query }) => {
    const requestId = getRequestContext()?.requestId ?? randomUUID()
    const startTime = Date.now()
    try {
      const { page, limit, status, priority, category, search } = query
      const pageValue = page ?? 1
      const limitValue = limit ?? PAGE_SIZE
      const where: Prisma.RequestWhereInput = {
        deletedAt: null, // Исключаем удалённые заявки
      }

      if (status) {
        where.status = status
      }

      if (priority) {
        where.priority = priority
      }

      if (category) {
        where.category = category
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

      const findStart = Date.now()
      let findMs = 0
      let countMs = 0
      const requestsPromise = prisma.request.findMany({
        where,
        orderBy: [
          { priority: 'desc' }, // URGENT > HIGH > NORMAL > LOW
          { createdAt: 'desc' },
        ],
        skip: (pageValue - 1) * limitValue,
        take: limitValue,
        include: {
          assignedTo: { select: { id: true, name: true, email: true, image: true } },
          _count: { select: { files: true, comments: true } },
        },
      }).then((result) => {
        findMs = Date.now() - findStart
        return result
      })
      const countStart = Date.now()
      const countPromise = prisma.request.count({ where }).then((result) => {
        countMs = Date.now() - countStart
        return result
      })

      const [requests, total] = await Promise.all([requestsPromise, countPromise])
      const totalDuration = Date.now() - startTime
      const logMeta = {
        requestId,
        durationMs: totalDuration,
        findMs,
        countMs,
        total,
        page: pageValue,
        limit: limitValue,
        status,
        priority,
        category,
        search: search?.trim() || undefined,
      }

      if (totalDuration > 1500) {
        logger.warn('GET /api/requests', 'Slow request', logMeta)
      } else {
        logger.info('GET /api/requests', 'Request completed', logMeta)
      }

      return NextResponse.json({
        requests: requests.map((request) => ({
          ...request,
          description: request.description ? request.description.slice(0, 240) : '',
        })),
        pagination: {
          page: pageValue,
          limit: limitValue,
          total,
          totalPages: Math.ceil(total / limitValue),
        },
      })
    } catch (error) {
      logger.error('GET /api/requests', error, { requestId, query })
      return NextResponse.json(
        {
          error: 'Не удалось загрузить заявки.',
          details: error instanceof Error ? error.message : String(error),
          requestId,
        },
        { status: 500 }
      )
    }
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
      // Validate files first (synchronously)
      interface ValidatedFile {
        file: File
        index: number
        safeFileName: string
      }
      const validatedFiles: ValidatedFile[] = []

      for (let index = 0; index < files.length; index++) {
        const file = files[index]
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
        validatedFiles.push({ file, index, safeFileName })
      }

      // Upload files in parallel using Promise.allSettled
      interface UploadResult {
        fileName: string
        success: boolean
        error?: string
      }

      const uploadResults = await Promise.allSettled(
        validatedFiles.map(async ({ file, index, safeFileName }): Promise<UploadResult> => {
          const storedFileName = `${Date.now()}_${index}_${safeFileName}`
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

          return { fileName: file.name, success: true }
        })
      )

      // Process results
      for (let i = 0; i < uploadResults.length; i++) {
        const result = uploadResults[i]
        const fileInfo = validatedFiles[i]

        if (result.status === 'fulfilled') {
          savedFiles++
        } else {
          logger.error('POST /api/requests', result.reason, {
            fileName: fileInfo.file.name,
            requestId: requestRecord.id,
          })
          filesFailed.push({
            name: fileInfo.file.name,
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
    logger.error('POST /api/requests', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

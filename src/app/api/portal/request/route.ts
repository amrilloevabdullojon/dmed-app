import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit'

const trackSchema = z.object({
  requestId: z.string().cuid(),
  contact: z.string().min(3).max(200),
})

const normalizePhone = (value: string) => value.replace(/\D/g, '')

export async function POST(request: NextRequest) {
  const clientId = getClientIdentifier(request.headers)
  const rateLimitResult = await checkRateLimit(
    `${clientId}:/api/portal/request:POST`,
    RATE_LIMITS.standard.limit,
    RATE_LIMITS.standard.windowMs
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

  const body = await request.json().catch(() => null)
  const parsed = trackSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          '\u041d\u0435\u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435.',
      },
      { status: 400 }
    )
  }

  const { requestId, contact } = parsed.data
  const normalizedContact = contact.trim().toLowerCase()
  const contactDigits = normalizePhone(normalizedContact)
  const contactTelegram = normalizedContact.replace(/^@/, '')

  const requestRecord = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      files: {
        select: { id: true, name: true, url: true, size: true, mimeType: true },
      },
      history: {
        where: { field: 'status' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, oldValue: true, newValue: true, createdAt: true },
      },
      comments: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          text: true,
          createdAt: true,
          author: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  })

  if (!requestRecord) {
    return NextResponse.json(
      {
        error:
          '\u0417\u0430\u044f\u0432\u043a\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430.',
      },
      { status: 404 }
    )
  }

  const emailMatch = requestRecord.contactEmail?.toLowerCase() === normalizedContact
  const phoneMatch =
    contactDigits.length > 0 && normalizePhone(requestRecord.contactPhone || '') === contactDigits
  const telegramValue = (requestRecord.contactTelegram || '').replace(/^@/, '').toLowerCase()
  const telegramMatch =
    telegramValue === contactTelegram ||
    (contactDigits.length > 0 && normalizePhone(telegramValue) === contactDigits)

  if (!emailMatch && !phoneMatch && !telegramMatch) {
    return NextResponse.json(
      {
        error:
          '\u0417\u0430\u044f\u0432\u043a\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430.',
      },
      { status: 404 }
    )
  }

  return NextResponse.json({
    success: true,
    request: {
      id: requestRecord.id,
      organization: requestRecord.organization,
      description: requestRecord.description,
      status: requestRecord.status,
      priority: requestRecord.priority,
      category: requestRecord.category,
      slaDeadline: requestRecord.slaDeadline,
      slaStatus: requestRecord.slaStatus,
      createdAt: requestRecord.createdAt,
      updatedAt: requestRecord.updatedAt,
      files: requestRecord.files,
      history: requestRecord.history,
      comments: requestRecord.comments,
    },
  })
}

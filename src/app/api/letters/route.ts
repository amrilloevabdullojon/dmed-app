import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { addWorkingDays, parseDateValue, sanitizeInput } from '@/lib/utils'
import { buildApplicantPortalLink, sendMultiChannelNotification } from '@/lib/notifications'
import { dispatchNotification } from '@/lib/notification-dispatcher'
import { logger } from '@/lib/logger.server'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit'
import { withValidation } from '@/lib/api-handler'
import { letterFiltersSchema, paginationSchema } from '@/lib/schemas'
import { LetterService } from '@/services/letter.service'
import { PORTAL_TOKEN_EXPIRY_DAYS, DEFAULT_DEADLINE_WORKING_DAYS } from '@/lib/constants'
import { requirePermission } from '@/lib/permission-guard'
import { csrfGuard } from '@/lib/security'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import type { LetterSummary, PaginationMeta } from '@/types/dto'

// Схема валидации для создания письма
const createLetterSchema = z.object({
  number: z.string().min(1, 'Номер письма обязателен').max(50),
  org: z.string().min(1, 'Организация обязательна').max(500),
  date: z
    .string()
    .refine((val) => parseDateValue(val), { message: 'Invalid date' })
    .transform((val) => parseDateValue(val) as Date),
  deadlineDate: z
    .string()
    .optional()
    .refine((val) => !val || parseDateValue(val), { message: 'Invalid deadline date' })
    .transform((val) => (val ? (parseDateValue(val) as Date) : null)),
  type: z.string().optional(),
  content: z.string().max(10000).optional(),
  comment: z.string().max(5000).optional(),
  contacts: z.string().max(500).optional(),
  jiraLink: z.string().max(500).optional(),
  ownerId: z.string().optional(),
  applicantName: z.string().max(200).optional(),
  applicantEmail: z.string().max(320).optional(),
  applicantPhone: z.string().max(50).optional(),
  applicantTelegramChatId: z.string().max(50).optional(),
})

const lettersQuerySchema = paginationSchema.merge(letterFiltersSchema)

type LettersQueryInput = z.infer<typeof lettersQuerySchema>
type LettersListResponse =
  | { letters: LetterSummary[]; pagination: PaginationMeta }
  | { error: string }

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

// GET /api/letters - получить все письма
export const GET = withValidation<LettersListResponse, unknown, LettersQueryInput>(
  async (_request, session, { query }) => {
    const permissionError = requirePermission(session.user.role, 'VIEW_LETTERS')
    if (permissionError) {
      return permissionError
    }

    const { page, limit, ...filters } = query
    const result = await LetterService.findMany(filters, { page, limit }, session.user.id)

    return NextResponse.json({
      letters: result.data,
      pagination: result.pagination,
    })
  },
  { querySchema: lettersQuerySchema, rateLimit: { limit: 120, windowMs: 60 * 1000 } }
)
// POST /api/letters - создать новое письмо
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request.headers)
    const rateLimitResult = await checkRateLimit(
      `${clientId}:/api/letters:POST`,
      RATE_LIMITS.standard.limit,
      RATE_LIMITS.standard.windowMs
    )

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Слишком много запросов. Попробуйте позже.' },
        { status: 429 }
      )
    }

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    const permissionError = requirePermission(session.user.role, 'MANAGE_LETTERS')
    if (permissionError) {
      return permissionError
    }

    const body = await request.json()

    // Валидация
    const result = createLetterSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 })
    }

    const data = result.data

    // Санитизация
    data.number = sanitizeInput(data.number, 50)
    data.org = sanitizeInput(data.org, 500)
    if (data.content) data.content = sanitizeInput(data.content, 10000)
    if (data.comment) data.comment = sanitizeInput(data.comment, 5000)
    if (data.contacts) data.contacts = sanitizeInput(data.contacts, 500)
    if (data.jiraLink) data.jiraLink = sanitizeInput(data.jiraLink, 500)
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
      return NextResponse.json({ error: 'Письмо с таким номером уже существует' }, { status: 409 })
    }

    // Рассчитать дедлайн (+7 рабочих дней если не указан)
    const ownerId = data.ownerId || (await resolveAutoOwnerId())

    const hasApplicantContact = !!(
      data.applicantEmail ||
      data.applicantPhone ||
      data.applicantTelegramChatId
    )
    const applicantAccessToken = hasApplicantContact ? randomUUID() : null
    const applicantAccessTokenExpiresAt = hasApplicantContact
      ? new Date(Date.now() + 1000 * 60 * 60 * 24 * PORTAL_TOKEN_EXPIRY_DAYS)
      : null

    const deadlineDate =
      data.deadlineDate || addWorkingDays(data.date, DEFAULT_DEADLINE_WORKING_DAYS)

    // Создать письмо
    const letter = await prisma.letter.create({
      data: {
        number: data.number,
        org: data.org,
        date: data.date,
        deadlineDate,
        type: data.type,
        content: data.content,
        comment: data.comment,
        contacts: data.contacts,
        jiraLink: data.jiraLink,
        applicantName: data.applicantName,
        applicantEmail: data.applicantEmail,
        applicantPhone: data.applicantPhone,
        applicantTelegramChatId: data.applicantTelegramChatId,
        applicantAccessToken,
        applicantAccessTokenExpiresAt,
        ownerId,
        status: 'NOT_REVIEWED',
        priority: 50,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    // Записать в историю
    await prisma.history.create({
      data: {
        letterId: letter.id,
        userId: session.user.id,
        field: 'created',
        newValue: JSON.stringify({ number: letter.number, org: letter.org }),
      },
    })

    // Автоподписать владельца
    const watcherIds = new Set<string>()
    watcherIds.add(session.user.id)
    if (letter.ownerId) watcherIds.add(letter.ownerId)

    if (watcherIds.size > 0) {
      await prisma.watcher.createMany({
        data: Array.from(watcherIds).map((userId) => ({
          letterId: letter.id,
          userId,
        })),
        skipDuplicates: true,
      })
    }

    if (letter.ownerId && letter.ownerId !== session.user.id) {
      await dispatchNotification({
        event: 'ASSIGNMENT',
        title: `Назначено письмо №-${letter.number}`,
        body: letter.org,
        letterId: letter.id,
        actorId: session.user.id,
        userIds: [letter.ownerId],
      })
    }

    if (hasApplicantContact && applicantAccessToken) {
      const portalLink = buildApplicantPortalLink(applicantAccessToken)
      const subject = `Ваше обращение №${letter.number} зарегистрировано`
      const text = `Ваше обращение зарегистрировано.

Номер: ${letter.number}
Организация: ${letter.org}
Дедлайн: ${new Date(letter.deadlineDate).toLocaleDateString('ru-RU')}

Ссылка: ${portalLink}`
      const telegram = `
<b>Обращение зарегистрировано</b>

№${letter.number}
${letter.org}
Дедлайн: ${new Date(letter.deadlineDate).toLocaleDateString('ru-RU')}

<a href="${portalLink}">Открыть обращение</a>`

      await sendMultiChannelNotification(
        {
          email: letter.applicantEmail,
          phone: letter.applicantPhone,
          telegramChatId: letter.applicantTelegramChatId,
        },
        { subject, text, telegram }
      )
    }
    return NextResponse.json({ success: true, letter }, { status: 201 })
  } catch (error) {
    logger.error('POST /api/letters', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

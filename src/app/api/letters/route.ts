import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { addWorkingDays, sanitizeInput, STATUS_FROM_LABEL } from '@/lib/utils'
import { buildApplicantPortalLink, sendMultiChannelNotification } from '@/lib/notifications'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit'
import {
  PAGE_SIZE,
  PORTAL_TOKEN_EXPIRY_DAYS,
  DEFAULT_DEADLINE_WORKING_DAYS,
} from '@/lib/constants'
import type { LetterStatus, Prisma } from '@prisma/client'
import { z } from 'zod'
import { randomUUID } from 'crypto'

// Схема валидации для создания письма
const createLetterSchema = z.object({
  number: z.string().min(1, 'Номер письма обязателен').max(50),
  org: z.string().min(1, 'Организация обязательна').max(500),
  date: z.string().transform((val) => new Date(val)),
  deadlineDate: z.string().optional().transform((val) => val ? new Date(val) : null),
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

  const countByUser = new Map(
    counts.map((item) => [item.ownerId, item._count._all])
  )

  const sorted = [...userIds].sort((a, b) => {
    const countA = countByUser.get(a) || 0
    const countB = countByUser.get(b) || 0
    if (countA !== countB) return countA - countB
    return a.localeCompare(b)
  })

  return sorted[0] || null
}

// GET /api/letters - получить все письма
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request.headers)
    const rateLimitResult = checkRateLimit(
      `${clientId}:/api/letters`,
      RATE_LIMITS.search.limit,
      RATE_LIMITS.search.windowMs
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const owner = searchParams.get('owner')
    const search = searchParams.get('search')
    const filter = searchParams.get('filter') // overdue, urgent, done
    const type = searchParams.get('type')
    const sortBy = searchParams.get('sortBy') || 'created' // created, deadline, date, priority, status
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || String(PAGE_SIZE))

    // Построить фильтры с правильной типизацией
    const where: Prisma.LetterWhereInput = {
      deletedAt: null, // Исключаем soft-deleted письма
    }

    if (status && status !== 'all') {
      where.status = status as LetterStatus
    }

    if (owner) {
      where.ownerId = owner
    }

    if (type) {
      where.type = type
    }

    // Фильтр по просроченным/срочным/завершённым/избранным
    if (filter === 'overdue') {
      where.deadlineDate = { lt: new Date() }
      where.status = { notIn: ['READY', 'DONE'] }
    } else if (filter === 'urgent') {
      const threeDaysLater = new Date()
      threeDaysLater.setDate(threeDaysLater.getDate() + 3)
      where.deadlineDate = { lte: threeDaysLater, gte: new Date() }
      where.status = { notIn: ['READY', 'DONE'] }
    } else if (filter === 'done') {
      where.status = { in: ['READY', 'DONE'] }
    } else if (filter === 'active') {
      where.status = { notIn: ['READY', 'DONE'] }
    } else if (filter === 'favorites') {
      where.favorites = {
        some: { userId: session.user.id }
      }
    }

    if (search) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { org: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { jiraLink: { contains: search, mode: 'insensitive' } },
        { answer: { contains: search, mode: 'insensitive' } },
        { zordoc: { contains: search, mode: 'insensitive' } },
        { comment: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Сортировка
    const orderByMap: Record<string, any> = {
      created: { createdAt: sortOrder },
      deadline: { deadlineDate: sortOrder },
      date: { date: sortOrder },
      priority: { priority: sortOrder === 'asc' ? 'desc' : 'asc' },
      status: { status: sortOrder },
      number: { number: sortOrder },
      org: { org: sortOrder },
    }
    const orderBy = orderByMap[sortBy] || { deadlineDate: 'asc' }

    // Получить письма с пагинацией
    const [letters, total] = await Promise.all([
      prisma.letter.findMany({
        where,
        select: {
          id: true,
          number: true,
          org: true,
          date: true,
          deadlineDate: true,
          status: true,
          type: true,
          content: true,
          priority: true,
          owner: {
            select: { id: true, name: true, email: true, image: true },
          },
          _count: {
            select: { comments: true, watchers: true },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.letter.count({ where }),
    ])

    return NextResponse.json({
      letters,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    logger.error('GET /api/letters', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/letters - создать новое письмо
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request.headers)
    const rateLimitResult = checkRateLimit(
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

    const body = await request.json()

    // Валидация
    const result = createLetterSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      )
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
    if (data.applicantTelegramChatId) data.applicantTelegramChatId = sanitizeInput(data.applicantTelegramChatId, 50)


    const existing = await prisma.letter.findFirst({
      where: {
        number: { equals: data.number, mode: 'insensitive' },
        deletedAt: null,
      },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Письмо с таким номером уже существует' },
        { status: 409 }
      )
    }

    // Рассчитать дедлайн (+7 рабочих дней если не указан)
    const ownerId = data.ownerId || await resolveAutoOwnerId()

    const hasApplicantContact = !!(data.applicantEmail || data.applicantPhone || data.applicantTelegramChatId)
    const applicantAccessToken = hasApplicantContact ? randomUUID() : null
    const applicantAccessTokenExpiresAt = hasApplicantContact
      ? new Date(Date.now() + 1000 * 60 * 60 * 24 * PORTAL_TOKEN_EXPIRY_DAYS)
      : null

    const deadlineDate = data.deadlineDate || addWorkingDays(data.date, DEFAULT_DEADLINE_WORKING_DAYS)

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
      await prisma.notification.create({
        data: {
          userId: letter.ownerId,
          letterId: letter.id,
          type: 'ASSIGNMENT',
          title: `????????? ????? ?????? ?${letter.number}`,
          body: letter.org,
        },
      })
    }

    if (hasApplicantContact && applicantAccessToken) {
      const portalLink = buildApplicantPortalLink(applicantAccessToken)
      const subject = `???? ????????? ?${letter.number} ????????????????`
      const text = `???? ????????? ????????????????.

?????: ${letter.number}
???????????: ${letter.org}
????: ${new Date(letter.deadlineDate).toLocaleDateString('ru-RU')}

??????: ${portalLink}`
      const telegram = `
<b>????????? ????????????????</b>

?${letter.number}
${letter.org}
????: ${new Date(letter.deadlineDate).toLocaleDateString('ru-RU')}

<a href="${portalLink}">??????? ??????</a>`

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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

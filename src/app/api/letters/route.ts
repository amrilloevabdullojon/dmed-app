import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { addWorkingDays, sanitizeInput, STATUS_FROM_LABEL } from '@/lib/utils'
import type { LetterStatus } from '@prisma/client'
import { z } from 'zod'

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
})

// GET /api/letters - получить все письма
export async function GET(request: NextRequest) {
  try {
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
    const limit = parseInt(searchParams.get('limit') || '50')

    // Построить фильтры
    const where: any = {
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
    console.error('GET /api/letters error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/letters - создать новое письмо
export async function POST(request: NextRequest) {
  try {
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
    const deadlineDate = data.deadlineDate || addWorkingDays(data.date, 7)

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
        ownerId: data.ownerId,
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
    if (letter.ownerId) {
      await prisma.watcher.create({
        data: {
          letterId: letter.id,
          userId: letter.ownerId,
        },
      })
    }

    return NextResponse.json({ success: true, letter }, { status: 201 })
  } catch (error) {
    console.error('POST /api/letters error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

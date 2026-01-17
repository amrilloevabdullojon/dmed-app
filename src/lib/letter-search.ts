import { Prisma, LetterStatus } from '@prisma/client'
import { prisma } from './prisma'

/**
 * Параметры поиска писем
 */
export type LetterSearchParams = {
  // Текстовый поиск
  query?: string

  // Фильтры
  status?: LetterStatus | LetterStatus[]
  ownerId?: string
  org?: string
  type?: string
  tags?: string[]

  // Диапазоны дат
  dateFrom?: Date
  dateTo?: Date
  deadlineFrom?: Date
  deadlineTo?: Date

  // Приоритет
  priorityMin?: number
  priorityMax?: number

  // Дедлайн
  overdue?: boolean
  dueToday?: boolean
  dueThisWeek?: boolean

  // Другие фильтры
  hasAnswer?: boolean
  hasJiraLink?: boolean
  favorite?: boolean
  watching?: boolean

  // Пагинация
  page?: number
  limit?: number

  // Сортировка
  sortBy?: 'date' | 'deadlineDate' | 'priority' | 'createdAt' | 'updatedAt' | 'relevance'
  sortOrder?: 'asc' | 'desc'

  // Для конкретного пользователя
  userId?: string
}

/**
 * Результат поиска
 */
export type LetterSearchResult = {
  letters: any[]
  total: number
  page: number
  limit: number
  pages: number
  hasMore: boolean
}

/**
 * Выполняет полнотекстовый поиск писем
 */
export async function searchLetters(
  params: LetterSearchParams
): Promise<LetterSearchResult> {
  const {
    query,
    status,
    ownerId,
    org,
    type,
    tags,
    dateFrom,
    dateTo,
    deadlineFrom,
    deadlineTo,
    priorityMin,
    priorityMax,
    overdue,
    dueToday,
    dueThisWeek,
    hasAnswer,
    hasJiraLink,
    favorite,
    watching,
    page = 1,
    limit = 50,
    sortBy = 'deadlineDate',
    sortOrder = 'asc',
    userId,
  } = params

  // Строим WHERE условия
  const where: Prisma.LetterWhereInput = {
    deletedAt: null, // Не показываем удалённые
  }

  // Текстовый поиск по нескольким полям
  if (query && query.trim()) {
    const searchTerm = query.trim()
    where.OR = [
      { number: { contains: searchTerm, mode: 'insensitive' } },
      { org: { contains: searchTerm, mode: 'insensitive' } },
      { content: { contains: searchTerm, mode: 'insensitive' } },
      { answer: { contains: searchTerm, mode: 'insensitive' } },
      { comment: { contains: searchTerm, mode: 'insensitive' } },
      { type: { contains: searchTerm, mode: 'insensitive' } },
      { contacts: { contains: searchTerm, mode: 'insensitive' } },
      { applicantName: { contains: searchTerm, mode: 'insensitive' } },
      { applicantEmail: { contains: searchTerm, mode: 'insensitive' } },
      { zordoc: { contains: searchTerm, mode: 'insensitive' } },
    ]
  }

  // Фильтр по статусу
  if (status) {
    if (Array.isArray(status)) {
      where.status = { in: status }
    } else {
      where.status = status
    }
  }

  // Фильтр по владельцу
  if (ownerId) {
    where.ownerId = ownerId
  }

  // Фильтр по организации
  if (org) {
    where.org = { contains: org, mode: 'insensitive' }
  }

  // Фильтр по типу
  if (type) {
    where.type = { contains: type, mode: 'insensitive' }
  }

  // Фильтр по тегам
  if (tags && tags.length > 0) {
    where.tags = {
      some: {
        name: { in: tags },
      },
    }
  }

  // Фильтр по датам
  if (dateFrom || dateTo) {
    where.date = {}
    if (dateFrom) where.date.gte = dateFrom
    if (dateTo) where.date.lte = dateTo
  }

  // Фильтр по дедлайну
  if (deadlineFrom || deadlineTo) {
    where.deadlineDate = {}
    if (deadlineFrom) where.deadlineDate.gte = deadlineFrom
    if (deadlineTo) where.deadlineDate.lte = deadlineTo
  }

  // Просроченные письма
  if (overdue) {
    where.deadlineDate = {
      ...(typeof where.deadlineDate === 'object' && where.deadlineDate !== null ? where.deadlineDate : {}),
      lt: new Date(),
    }
    where.status = { not: 'DONE' }
  }

  // Дедлайн сегодня
  if (dueToday) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    where.deadlineDate = {
      gte: today,
      lt: tomorrow,
    }
    where.status = { not: 'DONE' }
  }

  // Дедлайн на этой неделе
  if (dueThisWeek) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)

    where.deadlineDate = {
      gte: today,
      lt: nextWeek,
    }
    where.status = { not: 'DONE' }
  }

  // Фильтр по приоритету
  if (priorityMin !== undefined || priorityMax !== undefined) {
    where.priority = {}
    if (priorityMin !== undefined) where.priority.gte = priorityMin
    if (priorityMax !== undefined) where.priority.lte = priorityMax
  }

  // Наличие ответа
  if (hasAnswer !== undefined) {
    if (hasAnswer) {
      where.answer = { not: null }
    } else {
      where.answer = null
    }
  }

  // Наличие Jira ссылки
  if (hasJiraLink !== undefined) {
    if (hasJiraLink) {
      where.jiraLink = { not: null }
    } else {
      where.jiraLink = null
    }
  }

  // Избранное (для конкретного пользователя)
  if (favorite && userId) {
    where.favorites = {
      some: {
        userId,
      },
    }
  }

  // Наблюдаемые (для конкретного пользователя)
  if (watching && userId) {
    where.watchers = {
      some: {
        userId,
      },
    }
  }

  // Подсчёт общего количества
  const total = await prisma.letter.count({ where })

  // Определяем сортировку
  const orderBy: Prisma.LetterOrderByWithRelationInput = {}

  if (sortBy === 'relevance' && query) {
    // Для relevance сортируем по updatedAt как fallback
    // В будущем можно использовать PostgreSQL full-text search ranking
    orderBy.updatedAt = 'desc'
  } else if (sortBy !== 'relevance') {
    // Убеждаемся, что sortBy не является 'relevance'
    orderBy[sortBy] = sortOrder
  }

  // Пагинация
  const skip = (page - 1) * limit
  const take = limit

  // Получаем письма
  const letters = await prisma.letter.findMany({
    where,
    orderBy,
    skip,
    take,
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      tags: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
      _count: {
        select: {
          comments: true,
          files: true,
          watchers: true,
        },
      },
      ...(userId && {
        favorites: {
          where: { userId },
          select: { id: true },
        },
        watchers: {
          where: { userId },
          select: { id: true },
        },
      }),
    },
  })

  const pages = Math.ceil(total / limit)
  const hasMore = page < pages

  return {
    letters,
    total,
    page,
    limit,
    pages,
    hasMore,
  }
}

/**
 * Быстрый поиск для автозаполнения (только номера и организации)
 */
export async function quickSearch(query: string, limit = 10) {
  if (!query || query.trim().length < 2) {
    return []
  }

  const searchTerm = query.trim()

  const letters = await prisma.letter.findMany({
    where: {
      deletedAt: null,
      OR: [
        { number: { contains: searchTerm, mode: 'insensitive' } },
        { org: { contains: searchTerm, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      number: true,
      org: true,
      status: true,
      deadlineDate: true,
    },
    take: limit,
    orderBy: {
      updatedAt: 'desc',
    },
  })

  return letters
}

/**
 * Получает популярные организации для фильтров
 */
export async function getPopularOrganizations(limit = 20) {
  const orgs = await prisma.letter.groupBy({
    by: ['org'],
    where: {
      deletedAt: null,
    },
    _count: {
      org: true,
    },
    orderBy: {
      _count: {
        org: 'desc',
      },
    },
    take: limit,
  })

  return orgs.map((o) => ({
    name: o.org,
    count: o._count.org,
  }))
}

/**
 * Получает популярные типы для фильтров
 */
export async function getPopularTypes(limit = 20) {
  const types = await prisma.letter.groupBy({
    by: ['type'],
    where: {
      deletedAt: null,
      type: { not: null },
    },
    _count: {
      type: true,
    },
    orderBy: {
      _count: {
        type: 'desc',
      },
    },
    take: limit,
  })

  return types
    .filter((t) => t.type !== null)
    .map((t) => ({
      name: t.type as string,
      count: t._count.type,
    }))
}

/**
 * Сохраняет поисковый запрос пользователя для истории
 */
export async function saveSearchQuery(userId: string, query: string, filters: any) {
  // Можно создать модель SearchHistory для хранения истории поиска
  // Пока просто логируем
  console.log(`User ${userId} searched: "${query}"`, filters)
}

/**
 * Экспортирует результаты поиска в CSV
 */
export function exportSearchResultsToCSV(letters: any[]): string {
  const headers = ['Номер', 'Организация', 'Дата', 'Дедлайн', 'Статус', 'Тип', 'Ответственный']
  const rows = letters.map((letter) => [
    letter.number,
    letter.org,
    new Date(letter.date).toLocaleDateString('ru-RU'),
    new Date(letter.deadlineDate).toLocaleDateString('ru-RU'),
    letter.status,
    letter.type || '',
    letter.owner?.name || letter.owner?.email || '',
  ])

  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')

  return csv
}

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

  // ✅ ОПТИМИЗАЦИЯ: Флаг для использования PostgreSQL FTS вместо LIKE
  const useFTS = query && query.trim().length > 0

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

  // Пагинация
  const skip = (page - 1) * limit
  const take = limit

  let total: number
  let letters: any[]

  // ✅ ОПТИМИЗАЦИЯ: Используем PostgreSQL FTS для поиска
  if (useFTS && query) {
    const searchTerm = query.trim()

    // Строим WHERE clauses для SQL
    const sqlWhere: string[] = ['l."deletedAt" IS NULL']

    // FTS условие - используем Prisma.sql для безопасности
    sqlWhere.push(Prisma.sql`l.search_vector @@ plainto_tsquery('russian', ${searchTerm})` as unknown as string)

    // Добавляем основные фильтры в SQL
    if (status) {
      if (Array.isArray(status)) {
        const statusList = status.map(s => `'${s}'`).join(',')
        sqlWhere.push(`l.status IN (${statusList})`)
      } else {
        sqlWhere.push(`l.status = '${status}'`)
      }
    }

    if (ownerId) {
      sqlWhere.push(`l."ownerId" = '${ownerId}'`)
    }

    if (org) {
      sqlWhere.push(`l.org ILIKE '%${org.replace(/'/g, "''")}%'`)
    }

    if (type) {
      sqlWhere.push(`l.type ILIKE '%${type.replace(/'/g, "''")}%'`)
    }

    if (dateFrom) {
      sqlWhere.push(`l.date >= '${dateFrom.toISOString()}'`)
    }

    if (dateTo) {
      sqlWhere.push(`l.date <= '${dateTo.toISOString()}'`)
    }

    if (deadlineFrom) {
      sqlWhere.push(`l."deadlineDate" >= '${deadlineFrom.toISOString()}'`)
    }

    if (deadlineTo) {
      sqlWhere.push(`l."deadlineDate" <= '${deadlineTo.toISOString()}'`)
    }

    if (overdue) {
      sqlWhere.push(`l."deadlineDate" < NOW()`)
      sqlWhere.push(`l.status NOT IN ('READY', 'DONE')`)
    }

    if (dueToday) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      sqlWhere.push(`l."deadlineDate" >= '${today.toISOString()}'`)
      sqlWhere.push(`l."deadlineDate" < '${tomorrow.toISOString()}'`)
      sqlWhere.push(`l.status NOT IN ('READY', 'DONE')`)
    }

    const whereClause = sqlWhere.join(' AND ')

    // Определяем сортировку
    let orderByClause = 'ORDER BY '
    if (sortBy === 'relevance') {
      orderByClause += `ts_rank(l.search_vector, plainto_tsquery('russian', '${searchTerm}')) DESC, l."createdAt" DESC`
    } else {
      orderByClause += `l."${sortBy}" ${sortOrder.toUpperCase()}`
    }

    // Count query
    const countQuery = `SELECT COUNT(*) as count FROM "Letter" l WHERE ${whereClause}`
    const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(countQuery)
    total = Number(countResult[0].count)

    // Fetch letter IDs with FTS ranking
    const idsQuery = `
      SELECT l.id
      FROM "Letter" l
      WHERE ${whereClause}
      ${orderByClause}
      LIMIT ${take} OFFSET ${skip}
    `
    const letterIds = await prisma.$queryRawUnsafe<Array<{ id: string }>>(idsQuery)

    // Fetch full letter data using Prisma for includes
    if (letterIds.length > 0) {
      letters = await prisma.letter.findMany({
        where: {
          id: { in: letterIds.map(l => l.id) },
        },
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

      // Restore FTS sort order (findMany loses the ORDER BY)
      const orderMap = new Map(letterIds.map((l, idx) => [l.id, idx]))
      letters.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))
    } else {
      letters = []
    }
  } else {
    // Fallback для запросов без FTS (только фильтры)
    total = await prisma.letter.count({ where })

    // Определяем сортировку
    const orderBy: Prisma.LetterOrderByWithRelationInput = {}
    if (sortBy !== 'relevance') {
      orderBy[sortBy] = sortOrder
    } else {
      orderBy.updatedAt = 'desc'
    }

    letters = await prisma.letter.findMany({
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
  }

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
 * ✅ ОПТИМИЗАЦИЯ: Использует FTS для быстрого поиска
 */
export async function quickSearch(query: string, limit = 10) {
  if (!query || query.trim().length < 2) {
    return []
  }

  const searchTerm = query.trim()

  // Используем FTS для быстрого поиска
  const letterIds = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `
    SELECT l.id
    FROM "Letter" l
    WHERE l."deletedAt" IS NULL
      AND l.search_vector @@ plainto_tsquery('russian', '${searchTerm.replace(/'/g, "''")}')
    ORDER BY ts_rank(l.search_vector, plainto_tsquery('russian', '${searchTerm.replace(/'/g, "''")}')) DESC
    LIMIT ${limit}
    `
  )

  if (letterIds.length === 0) {
    return []
  }

  // Получаем полные данные
  const letters = await prisma.letter.findMany({
    where: {
      id: { in: letterIds.map(l => l.id) },
    },
    select: {
      id: true,
      number: true,
      org: true,
      status: true,
      deadlineDate: true,
    },
  })

  // Restore sort order
  const orderMap = new Map(letterIds.map((l, idx) => [l.id, idx]))
  letters.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))

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

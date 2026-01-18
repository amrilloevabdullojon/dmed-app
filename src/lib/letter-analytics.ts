import { prisma } from './prisma'
import { LetterStatus } from '@prisma/client'

/**
 * Параметры фильтрации аналитики
 */
export type AnalyticsFilters = {
  dateFrom?: Date
  dateTo?: Date
  ownerId?: string
  org?: string
  status?: LetterStatus[]
}

/**
 * Общая статистика по письмам
 */
export async function getLetterStats(filters: AnalyticsFilters = {}) {
  const where = buildWhereClause(filters)

  const [
    total,
    notReviewed,
    accepted,
    inProgress,
    clarification,
    ready,
    done,
    overdue,
    dueToday,
    dueThisWeek,
    withAnswer,
    withoutAnswer,
    avgPriority,
  ] = await Promise.all([
    // Всего писем
    prisma.letter.count({ where }),

    // По статусам
    prisma.letter.count({ where: { ...where, status: 'NOT_REVIEWED' } }),
    prisma.letter.count({ where: { ...where, status: 'ACCEPTED' } }),
    prisma.letter.count({ where: { ...where, status: 'IN_PROGRESS' } }),
    prisma.letter.count({ where: { ...where, status: 'CLARIFICATION' } }),
    prisma.letter.count({ where: { ...where, status: 'READY' } }),
    prisma.letter.count({ where: { ...where, status: 'DONE' } }),

    // Просроченные
    prisma.letter.count({
      where: {
        ...where,
        deadlineDate: { lt: new Date() },
        status: { not: 'DONE' },
      },
    }),

    // Дедлайн сегодня
    prisma.letter.count({
      where: {
        ...where,
        deadlineDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
        status: { not: 'DONE' },
      },
    }),

    // Дедлайн на этой неделе
    prisma.letter.count({
      where: {
        ...where,
        deadlineDate: {
          gte: new Date(),
          lt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        status: { not: 'DONE' },
      },
    }),

    // С ответом / без ответа
    prisma.letter.count({ where: { ...where, answer: { not: null } } }),
    prisma.letter.count({ where: { ...where, answer: null } }),

    // Средний приоритет
    prisma.letter.aggregate({
      where,
      _avg: { priority: true },
    }),
  ])

  return {
    total,
    byStatus: {
      NOT_REVIEWED: notReviewed,
      ACCEPTED: accepted,
      IN_PROGRESS: inProgress,
      CLARIFICATION: clarification,
      READY: ready,
      DONE: done,
    },
    deadlines: {
      overdue,
      dueToday,
      dueThisWeek,
    },
    answers: {
      withAnswer,
      withoutAnswer,
    },
    avgPriority: avgPriority._avg.priority || 0,
  }
}

/**
 * Статистика по времени (тренды)
 */
export async function getLetterTrends(filters: AnalyticsFilters = {}, groupBy: 'day' | 'week' | 'month' = 'day') {
  const where = buildWhereClause(filters)

  // Получаем письма с датами
  const letters = await prisma.letter.findMany({
    where,
    select: {
      id: true,
      date: true,
      createdAt: true,
      status: true,
      deadlineDate: true,
    },
    orderBy: { date: 'asc' },
  })

  // Группируем по периодам
  const grouped = new Map<string, { created: number; done: number; overdue: number }>()

  letters.forEach((letter) => {
    const key = formatDateKey(letter.date, groupBy)
    const current = grouped.get(key) || { created: 0, done: 0, overdue: 0 }

    current.created++
    if (letter.status === 'DONE') current.done++
    if (new Date(letter.deadlineDate) < new Date() && letter.status !== 'DONE') {
      current.overdue++
    }

    grouped.set(key, current)
  })

  return Array.from(grouped.entries())
    .map(([period, stats]) => ({ period, ...stats }))
    .sort((a, b) => a.period.localeCompare(b.period))
}

/**
 * Статистика по организациям
 */
export async function getOrganizationStats(filters: AnalyticsFilters = {}, limit = 10) {
  const where = buildWhereClause(filters)

  const orgs = await prisma.letter.groupBy({
    by: ['org'],
    where,
    _count: { org: true },
    orderBy: { _count: { org: 'desc' } },
    take: limit,
  })

  // Получаем детальную статистику по топ организациям
  const detailedStats = await Promise.all(
    orgs.map(async (org) => {
      const [total, done, overdue, avgPriority] = await Promise.all([
        prisma.letter.count({ where: { ...where, org: org.org } }),
        prisma.letter.count({ where: { ...where, org: org.org, status: 'DONE' } }),
        prisma.letter.count({
          where: {
            ...where,
            org: org.org,
            deadlineDate: { lt: new Date() },
            status: { not: 'DONE' },
          },
        }),
        prisma.letter.aggregate({
          where: { ...where, org: org.org },
          _avg: { priority: true },
        }),
      ])

      return {
        org: org.org,
        total,
        done,
        overdue,
        inProgress: total - done,
        completionRate: total > 0 ? (done / total) * 100 : 0,
        avgPriority: avgPriority._avg.priority || 0,
      }
    })
  )

  return detailedStats
}

/**
 * Статистика по пользователям (ответственным)
 */
export async function getUserStats(filters: AnalyticsFilters = {}, limit = 10) {
  const where = buildWhereClause(filters)

  const users = await prisma.letter.groupBy({
    by: ['ownerId'],
    where: {
      ...where,
      ownerId: { not: null },
    },
    _count: { ownerId: true },
    orderBy: { _count: { ownerId: 'desc' } },
    take: limit,
  })

  // Получаем детальную статистику
  const detailedStats = await Promise.all(
    users.map(async (user) => {
      if (!user.ownerId) return null

      const [owner, total, done, overdue, inProgress] = await Promise.all([
        prisma.user.findUnique({
          where: { id: user.ownerId },
          select: { id: true, name: true, email: true },
        }),
        prisma.letter.count({ where: { ...where, ownerId: user.ownerId } }),
        prisma.letter.count({ where: { ...where, ownerId: user.ownerId, status: 'DONE' } }),
        prisma.letter.count({
          where: {
            ...where,
            ownerId: user.ownerId,
            deadlineDate: { lt: new Date() },
            status: { not: 'DONE' },
          },
        }),
        prisma.letter.count({
          where: { ...where, ownerId: user.ownerId, status: 'IN_PROGRESS' },
        }),
      ])

      return {
        user: owner,
        total,
        done,
        overdue,
        inProgress,
        completionRate: total > 0 ? (done / total) * 100 : 0,
      }
    })
  )

  return detailedStats.filter((s) => s !== null)
}

/**
 * Статистика по типам запросов
 */
export async function getTypeStats(filters: AnalyticsFilters = {}) {
  const where = buildWhereClause(filters)

  const types = await prisma.letter.groupBy({
    by: ['type'],
    where: {
      ...where,
      type: { not: null },
    },
    _count: { type: true },
    orderBy: { _count: { type: 'desc' } },
  })

  return types
    .filter((t) => t.type !== null)
    .map((t) => ({
      type: t.type as string,
      count: t._count.type,
    }))
}

/**
 * Метрики производительности (SLA, время ответа)
 */
export async function getPerformanceMetrics(filters: AnalyticsFilters = {}) {
  const where = buildWhereClause(filters)

  // Письма с ответом
  const lettersWithAnswer = await prisma.letter.findMany({
    where: {
      ...where,
      answer: { not: null },
      status: 'DONE',
    },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      date: true,
      deadlineDate: true,
      closeDate: true,
    },
  })

  // Вычисляем метрики
  let totalResponseTime = 0
  let totalResolutionTime = 0
  let onTimeCount = 0
  let lateCount = 0

  lettersWithAnswer.forEach((letter) => {
    const created = new Date(letter.createdAt)
    const updated = new Date(letter.updatedAt)
    const deadline = new Date(letter.deadlineDate)
    const closed = letter.closeDate ? new Date(letter.closeDate) : updated

    // Время ответа (создание -> последнее обновление)
    const responseTime = (updated.getTime() - created.getTime()) / (1000 * 60 * 60) // часы
    totalResponseTime += responseTime

    // Время решения (создание -> закрытие)
    const resolutionTime = (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24) // дни
    totalResolutionTime += resolutionTime

    // SLA соблюдение
    if (closed <= deadline) {
      onTimeCount++
    } else {
      lateCount++
    }
  })

  const count = lettersWithAnswer.length

  return {
    avgResponseTime: count > 0 ? totalResponseTime / count : 0, // часы
    avgResolutionTime: count > 0 ? totalResolutionTime / count : 0, // дни
    slaCompliance: count > 0 ? (onTimeCount / count) * 100 : 0, // процент
    onTime: onTimeCount,
    late: lateCount,
    total: count,
  }
}

/**
 * Динамика работы (письма по дням недели и часам)
 */
export async function getActivityPatterns(filters: AnalyticsFilters = {}) {
  const where = buildWhereClause(filters)

  const letters = await prisma.letter.findMany({
    where,
    select: {
      createdAt: true,
    },
  })

  const byDayOfWeek = new Map<number, number>()
  const byHour = new Map<number, number>()

  letters.forEach((letter) => {
    const date = new Date(letter.createdAt)
    const day = date.getDay() // 0 = Воскресенье
    const hour = date.getHours()

    byDayOfWeek.set(day, (byDayOfWeek.get(day) || 0) + 1)
    byHour.set(hour, (byHour.get(hour) || 0) + 1)
  })

  const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

  return {
    byDayOfWeek: Array.from(byDayOfWeek.entries())
      .map(([day, count]) => ({ day: dayNames[day], count }))
      .sort((a, b) => dayNames.indexOf(a.day) - dayNames.indexOf(b.day)),
    byHour: Array.from(byHour.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour),
  }
}

/**
 * Вспомогательная функция для построения WHERE условия
 */
function buildWhereClause(filters: AnalyticsFilters) {
  const where: any = {
    deletedAt: null,
  }

  if (filters.dateFrom || filters.dateTo) {
    where.date = {}
    if (filters.dateFrom) where.date.gte = filters.dateFrom
    if (filters.dateTo) where.date.lte = filters.dateTo
  }

  if (filters.ownerId) {
    where.ownerId = filters.ownerId
  }

  if (filters.org) {
    where.org = { contains: filters.org, mode: 'insensitive' }
  }

  if (filters.status && filters.status.length > 0) {
    where.status = { in: filters.status }
  }

  return where
}

/**
 * Форматирует дату для группировки
 */
function formatDateKey(date: Date, groupBy: 'day' | 'week' | 'month'): string {
  const d = new Date(date)

  switch (groupBy) {
    case 'day':
      return d.toISOString().split('T')[0] // YYYY-MM-DD
    case 'week': {
      const week = getWeekNumber(d)
      return `${d.getFullYear()}-W${week.toString().padStart(2, '0')}`
    }
    case 'month':
      return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
    default:
      return d.toISOString().split('T')[0]
  }
}

/**
 * Получает номер недели в году
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/**
 * Экспортирует аналитику в JSON
 */
export async function exportAnalytics(filters: AnalyticsFilters = {}) {
  const [stats, trends, orgStats, userStats, typeStats, performance, activity] =
    await Promise.all([
      getLetterStats(filters),
      getLetterTrends(filters),
      getOrganizationStats(filters),
      getUserStats(filters),
      getTypeStats(filters),
      getPerformanceMetrics(filters),
      getActivityPatterns(filters),
    ])

  return {
    generatedAt: new Date().toISOString(),
    filters,
    stats,
    trends,
    organizations: orgStats,
    users: userStats,
    types: typeStats,
    performance,
    activity,
  }
}

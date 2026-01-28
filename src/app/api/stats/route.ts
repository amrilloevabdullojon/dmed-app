import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { cache, CACHE_TTL, CACHE_KEYS } from '@/lib/cache'
import type { LetterStatus } from '@prisma/client'
import { URGENT_DAYS, MONTHS_TO_SHOW } from '@/lib/constants'
import { logger } from '@/lib/logger.server'
import { normalizeLetterType, normalizeOrganization } from '@/lib/reporting'

export const dynamic = 'force-dynamic'

interface StatsData {
  summary: {
    total: number
    overdue: number
    urgent: number
    done: number
    inProgress: number
    notReviewed: number
    todayDeadlines: number
    weekDeadlines: number
    monthNew: number
    monthDone: number
    avgDays: number
  }
  byStatus: Record<LetterStatus, number>
  byOwner: Array<{ id: string; name: string; count: number }>
  byType: Array<{ type: string; count: number }>
  byOrgTypePeriod: Array<{
    periodKey: string
    periodLabel: string
    org: string
    type: string
    count: number
  }>
  monthly: Array<{ month: string; created: number; done: number }>
  report?: {
    letters: Array<{
      createdAt: string
      org: string
      type: string
      status: LetterStatus
      ownerId: string | null
    }>
  }
}

// GET /api/stats - получить статистику
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверяем кэш
    const includeReport = request.nextUrl.searchParams.get('includeReport') === '1'
    const cacheKey = includeReport ? CACHE_KEYS.STATS_REPORT : CACHE_KEYS.STATS
    const cacheTtlMs = includeReport ? CACHE_TTL.STATS_REPORT : CACHE_TTL.STATS
    const cacheSeconds = Math.max(1, Math.floor(cacheTtlMs / 1000))
    const responseHeaders: HeadersInit = {
      'Cache-Control': `private, max-age=${cacheSeconds}, stale-while-revalidate=${cacheSeconds}`,
    }
    const cachedStats = await cache.get<StatsData>(cacheKey)
    if (!includeReport && cachedStats && Array.isArray(cachedStats.byOrgTypePeriod)) {
      return NextResponse.json(cachedStats, { headers: responseHeaders })
    }
    if (includeReport && cachedStats?.report?.letters) {
      return NextResponse.json(cachedStats, { headers: responseHeaders })
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodStart = new Date(now.getFullYear(), now.getMonth() - (MONTHS_TO_SHOW - 1), 1)

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

    // Параллельные запросы для ускорения
    const [
      statusCounts,
      total,
      overdueCount,
      urgentCount,
      todayDeadlinesCount,
      weekDeadlinesCount,
      monthStats,
      monthDone,
      byOwner,
      byType,
      allUsers, // Загружаем всех пользователей сразу, чтобы избежать N+1
    ] = await Promise.all([
      // Статистика по статусам
      prisma.letter.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { status: true },
      }),
      // Общее количество
      prisma.letter.count({ where: { deletedAt: null } }),
      // Просроченные
      prisma.letter.count({
        where: {
          deletedAt: null,
          deadlineDate: { lt: now },
          status: { notIn: ['READY', 'DONE'] },
        },
      }),
      // Срочные (N дней)
      prisma.letter.count({
        where: {
          deletedAt: null,
          deadlineDate: {
            gte: now,
            lte: new Date(now.getTime() + URGENT_DAYS * 24 * 60 * 60 * 1000),
          },
          status: { notIn: ['READY', 'DONE'] },
        },
      }),
      // Дедлайн сегодня
      prisma.letter.count({
        where: {
          deletedAt: null,
          deadlineDate: { gte: today, lt: tomorrow },
          status: { notIn: ['READY', 'DONE'] },
        },
      }),
      // Дедлайн на этой неделе
      prisma.letter.count({
        where: {
          deletedAt: null,
          deadlineDate: { gte: today, lt: weekEnd },
          status: { notIn: ['READY', 'DONE'] },
        },
      }),
      // Новых за месяц
      prisma.letter.count({
        where: { deletedAt: null, createdAt: { gte: startOfMonth } },
      }),
      // Закрыто за месяц
      prisma.letter.count({
        where: {
          deletedAt: null,
          closeDate: { gte: startOfMonth },
          status: { in: ['READY', 'DONE'] },
        },
      }),
      // По ответственным
      prisma.letter.groupBy({
        by: ['ownerId'],
        _count: { id: true },
        where: { ownerId: { not: null }, deletedAt: null },
      }),
      // По типам
      prisma.letter.groupBy({
        by: ['type'],
        _count: { id: true },
        where: { type: { not: null }, deletedAt: null },
      }),
      // Все пользователи (для статистики по ответственным)
      prisma.user.findMany({
        select: { id: true, name: true, email: true },
      }),
    ])
    const userById = new Map(allUsers.map((user) => [user.id, user]))

    // Статистика по статусам
    const byStatus: Record<LetterStatus, number> = {
      NOT_REVIEWED: 0,
      ACCEPTED: 0,
      IN_PROGRESS: 0,
      CLARIFICATION: 0,
      READY: 0,
      DONE: 0,
    }
    statusCounts.forEach((item) => {
      byStatus[item.status] = item._count.status
    })

    const doneCount = byStatus.READY + byStatus.DONE
    const inProgressCount = byStatus.IN_PROGRESS + byStatus.ACCEPTED + byStatus.CLARIFICATION

    // Статистика по ответственным (используем уже загруженных пользователей)
    const ownerStats = byOwner
      .map((o) => {
        const ownerId = o.ownerId ?? 'unassigned'
        const user = o.ownerId ? userById.get(o.ownerId) : undefined
        const name = o.ownerId
          ? user?.name || user?.email?.split('@')[0] || ownerId
          : 'Не назначено'
        return {
          id: ownerId,
          name,
          count: o._count.id,
        }
      })
      .sort((a, b) => b.count - a.count)

    // ✅ ОПТИМИЗАЦИЯ: SQL агрегация вместо загрузки всех писем
    const yearAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)

    // Используем SQL для группировки по месяцам (created)
    const monthlyCreatedRaw = await prisma.$queryRaw<Array<{ month: Date; count: bigint }>>`
      SELECT
        DATE_TRUNC('month', "createdAt") as month,
        COUNT(*) as count
      FROM "Letter"
      WHERE "deletedAt" IS NULL AND "createdAt" >= ${yearAgo}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month DESC
    `

    // Используем SQL для группировки по месяцам (done)
    const monthlyDoneRaw = await prisma.$queryRaw<Array<{ month: Date; count: bigint }>>`
      SELECT
        DATE_TRUNC('month', "closeDate") as month,
        COUNT(*) as count
      FROM "Letter"
      WHERE "deletedAt" IS NULL
        AND "closeDate" >= ${yearAgo}
        AND status IN ('READY', 'DONE')
      GROUP BY DATE_TRUNC('month', "closeDate")
      ORDER BY month DESC
    `

    // Преобразуем результаты в Map для быстрого поиска
    const createdByMonth = new Map(
      monthlyCreatedRaw.map(r => [
        new Date(r.month).toLocaleDateString('ru-RU', { month: 'short' }),
        Number(r.count)
      ])
    )
    const doneByMonth = new Map(
      monthlyDoneRaw.map(r => [
        new Date(r.month).toLocaleDateString('ru-RU', { month: 'short' }),
        Number(r.count)
      ])
    )

    // Формируем итоговый массив за 12 месяцев
    const monthlyMap = new Map<string, { created: number; done: number }>()
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = monthStart.toLocaleDateString('ru-RU', { month: 'short' })
      monthlyMap.set(monthKey, {
        created: createdByMonth.get(monthKey) || 0,
        done: doneByMonth.get(monthKey) || 0,
      })
    }

    const monthlyData = Array.from(monthlyMap.entries())
      .reverse()
      .map(([month, data]) => ({ month, ...data }))

    // ✅ ОПТИМИЗАЦИЯ: SQL агрегация для org/type/period вместо in-memory обработки
    const periodBuckets: Array<{ key: string; label: string }> = []
    for (let i = MONTHS_TO_SHOW - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`
      const label = monthStart.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })
      periodBuckets.push({ key, label })
    }
    const periodLabelByKey = new Map(periodBuckets.map((bucket) => [bucket.key, bucket.label]))

    // SQL агрегация по org/type/period
    const orgTypePeriodRaw = await prisma.$queryRaw<
      Array<{ period: Date; org: string; type: string; count: bigint }>
    >`
      SELECT
        DATE_TRUNC('month', "createdAt") as period,
        COALESCE("org", 'Unknown') as org,
        COALESCE("type", 'Unknown') as type,
        COUNT(*) as count
      FROM "Letter"
      WHERE "deletedAt" IS NULL AND "createdAt" >= ${periodStart}
      GROUP BY DATE_TRUNC('month', "createdAt"), "org", "type"
      ORDER BY period, count DESC
    `

    const orgTypePeriodStats = orgTypePeriodRaw
      .map((row) => {
        const periodDate = new Date(row.period)
        const periodKey = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, '0')}`
        const periodLabel = periodLabelByKey.get(periodKey)
        if (!periodLabel) return null

        return {
          periodKey,
          periodLabel,
          org: normalizeOrganization(row.org),
          type: normalizeLetterType(row.type),
          count: Number(row.count),
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => {
        if (a.periodKey !== b.periodKey) return a.periodKey.localeCompare(b.periodKey)
        if (a.count !== b.count) return b.count - a.count
        const orgCompare = a.org.localeCompare(b.org, 'ru-RU')
        if (orgCompare !== 0) return orgCompare
        return a.type.localeCompare(b.type, 'ru-RU')
      })

    // ✅ ОПТИМИЗАЦИЯ: Загружаем данные для отчета только если запрошено, с LIMIT
    const reportLetters = includeReport
      ? await prisma.letter.findMany({
          where: {
            deletedAt: null,
            createdAt: { gte: periodStart },
          },
          select: {
            createdAt: true,
            org: true,
            type: true,
            status: true,
            ownerId: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5000, // Лимит для безопасности
        }).then(letters =>
          letters.map((letter) => ({
            createdAt: letter.createdAt.toISOString(),
            org: normalizeOrganization(letter.org),
            type: normalizeLetterType(letter.type),
            status: letter.status,
            ownerId: letter.ownerId,
          }))
        )
      : []

    // ✅ ОПТИМИЗАЦИЯ: SQL AVG вместо загрузки всех завершенных писем
    const avgDaysResult = await prisma.$queryRaw<Array<{ avg_days: number | null }>>`
      SELECT
        AVG(EXTRACT(DAY FROM ("closeDate" - "date"))::numeric) as avg_days
      FROM "Letter"
      WHERE "deletedAt" IS NULL
        AND status IN ('READY', 'DONE')
        AND "closeDate" IS NOT NULL
        AND "closeDate" >= "date"
    `
    const avgDays = avgDaysResult[0]?.avg_days ? Math.round(avgDaysResult[0].avg_days) : 0

    // Статистика по типам
    const typeStats = byType
      .map((t) => ({
        type: normalizeLetterType(t.type),
        count: t._count.id,
      }))
      .sort((a, b) => b.count - a.count)

    const result: StatsData = {
      summary: {
        total,
        overdue: overdueCount,
        urgent: urgentCount,
        done: doneCount,
        inProgress: inProgressCount,
        notReviewed: byStatus.NOT_REVIEWED,
        todayDeadlines: todayDeadlinesCount,
        weekDeadlines: weekDeadlinesCount,
        monthNew: monthStats,
        monthDone,
        avgDays,
      },
      byStatus,
      byOwner: ownerStats,
      byType: typeStats,
      byOrgTypePeriod: orgTypePeriodStats,
      monthly: monthlyData,
      ...(includeReport
        ? {
            report: {
              letters: reportLetters,
            },
          }
        : {}),
    }

    // Сохраняем в кэш
    await cache.set(cacheKey, result, includeReport ? CACHE_TTL.STATS_REPORT : CACHE_TTL.STATS)

    return NextResponse.json(result, { headers: responseHeaders })
  } catch (error) {
    logger.error('GET /api/stats', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { cache, CACHE_TTL, CACHE_KEYS } from '@/lib/cache'
import type { LetterStatus } from '@prisma/client'
import { URGENT_DAYS, MONTHS_TO_SHOW } from '@/lib/constants'
import { logger } from '@/lib/logger.server'

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
  byOwner: Array<{ id: string | null; name: string; count: number }>
  byType: Array<{ type: string; count: number }>
  byOrgTypePeriod: Array<{
    periodKey: string
    periodLabel: string
    org: string
    type: string
    count: number
  }>
  monthly: Array<{ month: string; created: number; done: number }>
}

// GET /api/stats - получить статистику
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверяем кэш
    const cachedStats = await cache.get<StatsData>(CACHE_KEYS.STATS)
    if (cachedStats && Array.isArray(cachedStats.byOrgTypePeriod)) {
      return NextResponse.json(cachedStats)
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
      completedLetters,
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
      // Для среднего времени выполнения
      prisma.letter.findMany({
        where: {
          deletedAt: null,
          status: { in: ['READY', 'DONE'] },
          closeDate: { not: null },
        },
        select: { date: true, closeDate: true },
      }),
      // Все пользователи (для статистики по ответственным)
      prisma.user.findMany({
        select: { id: true, name: true, email: true },
      }),
    ])

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
        const user = allUsers.find((u) => u.id === o.ownerId)
        return {
          id: o.ownerId,
          name: user?.name || user?.email?.split('@')[0] || 'Неизвестный',
          count: o._count.id,
        }
      })
      .sort((a, b) => b.count - a.count)

    // Статистика по месяцам за год (оптимизировано - один запрос)
    const yearAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    const monthlyLetters = await prisma.letter.findMany({
      where: {
        deletedAt: null,
        OR: [{ createdAt: { gte: yearAgo } }, { closeDate: { gte: yearAgo } }],
      },
      select: { createdAt: true, closeDate: true, status: true, org: true, type: true },
    })

    // Группируем по месяцам
    const monthlyMap = new Map<string, { created: number; done: number }>()
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = monthStart.toLocaleDateString('ru-RU', { month: 'short' })
      monthlyMap.set(monthKey, { created: 0, done: 0 })
    }

    monthlyLetters.forEach((letter) => {
      const createdMonth = new Date(letter.createdAt).toLocaleDateString('ru-RU', {
        month: 'short',
      })
      if (monthlyMap.has(createdMonth)) {
        const data = monthlyMap.get(createdMonth)!
        data.created++
      }

      if (letter.closeDate && ['READY', 'DONE'].includes(letter.status)) {
        const closedMonth = new Date(letter.closeDate).toLocaleDateString('ru-RU', {
          month: 'short',
        })
        if (monthlyMap.has(closedMonth)) {
          const data = monthlyMap.get(closedMonth)!
          data.done++
        }
      }
    })

    const monthlyData = Array.from(monthlyMap.entries())
      .reverse()
      .map(([month, data]) => ({ month, ...data }))

    const periodBuckets: Array<{ key: string; label: string }> = []
    for (let i = MONTHS_TO_SHOW - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`
      const label = monthStart.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })
      periodBuckets.push({ key, label })
    }
    const periodLabelByKey = new Map(periodBuckets.map((bucket) => [bucket.key, bucket.label]))
    const normalizeLabel = (value: string | null | undefined, fallback: string) => {
      const trimmed = value?.trim()
      return trimmed ? trimmed : fallback
    }
    const orgTypePeriodMap = new Map<
      string,
      { periodKey: string; periodLabel: string; org: string; type: string; count: number }
    >()

    monthlyLetters.forEach((letter) => {
      if (letter.createdAt < periodStart) return
      const periodKey = `${letter.createdAt.getFullYear()}-${String(
        letter.createdAt.getMonth() + 1
      ).padStart(2, '0')}`
      const periodLabel = periodLabelByKey.get(periodKey)
      if (!periodLabel) return
      const org = normalizeLabel(letter.org, 'Не указано')
      const type = normalizeLabel(letter.type, 'Не указано')
      const rowKey = `${periodKey}||${org}||${type}`
      const existing = orgTypePeriodMap.get(rowKey)
      if (existing) {
        existing.count += 1
      } else {
        orgTypePeriodMap.set(rowKey, {
          periodKey,
          periodLabel,
          org,
          type,
          count: 1,
        })
      }
    })

    const orgTypePeriodStats = Array.from(orgTypePeriodMap.values()).sort((a, b) => {
      if (a.periodKey !== b.periodKey) return a.periodKey.localeCompare(b.periodKey)
      if (a.count !== b.count) return b.count - a.count
      const orgCompare = a.org.localeCompare(b.org, 'ru-RU')
      if (orgCompare !== 0) return orgCompare
      return a.type.localeCompare(b.type, 'ru-RU')
    })

    // Среднее время выполнения
    let avgDays = 0
    if (completedLetters.length > 0) {
      const totalDays = completedLetters.reduce((acc, letter) => {
        if (letter.closeDate) {
          const days = Math.ceil(
            (letter.closeDate.getTime() - letter.date.getTime()) / (1000 * 60 * 60 * 24)
          )
          return acc + Math.max(0, days) // Исключаем отрицательные значения
        }
        return acc
      }, 0)
      avgDays = Math.round(totalDays / completedLetters.length)
    }

    // Статистика по типам
    const typeStats = byType
      .map((t) => ({
        type: t.type || 'Не указан',
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
    }

    // Сохраняем в кэш
    await cache.set(CACHE_KEYS.STATS, result, CACHE_TTL.STATS)

    return NextResponse.json(result)
  } catch (error) {
    logger.error('GET /api/stats', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

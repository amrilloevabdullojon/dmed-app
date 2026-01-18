import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger.server'
import { requirePermission } from '@/lib/permission-guard'
import {
  getLetterStats,
  getLetterTrends,
  getOrganizationStats,
  getUserStats,
  getTypeStats,
  getPerformanceMetrics,
  getActivityPatterns,
  exportAnalytics,
  AnalyticsFilters,
} from '@/lib/letter-analytics'
import { LetterStatus } from '@prisma/client'

/**
 * GET /api/analytics/letters
 *
 * Получает аналитику по письмам
 *
 * Query параметры:
 * - type: stats | trends | organizations | users | types | performance | activity | all
 * - dateFrom, dateTo: диапазон дат
 * - ownerId: фильтр по владельцу
 * - org: фильтр по организации
 * - status: фильтр по статусу (через запятую)
 * - groupBy: day | week | month (для trends)
 * - limit: количество результатов (для top lists)
 * - export: true для экспорта в JSON
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionError = requirePermission(session.user.role, 'VIEW_LETTERS')
    if (permissionError) {
      return permissionError
    }

    const { searchParams } = new URL(request.url)

    // Строим фильтры
    const filters: AnalyticsFilters = {}

    if (searchParams.get('dateFrom')) {
      filters.dateFrom = new Date(searchParams.get('dateFrom')!)
    }
    if (searchParams.get('dateTo')) {
      filters.dateTo = new Date(searchParams.get('dateTo')!)
    }
    if (searchParams.get('ownerId')) {
      filters.ownerId = searchParams.get('ownerId')!
    }
    if (searchParams.get('org')) {
      filters.org = searchParams.get('org')!
    }

    const statusParam = searchParams.get('status')
    if (statusParam) {
      filters.status = statusParam.split(',') as LetterStatus[]
    }

    const type = searchParams.get('type') || 'all'
    const groupBy = (searchParams.get('groupBy') || 'day') as 'day' | 'week' | 'month'
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')))
    const shouldExport = searchParams.get('export') === 'true'

    // Экспорт
    if (shouldExport) {
      const data = await exportAnalytics(filters)
      logger.info('GET /api/analytics/letters', 'Analytics exported', {
        userId: session.user.id,
      })
      return NextResponse.json(data)
    }

    // Получаем данные по типу
    let result: any = {}

    if (type === 'stats' || type === 'all') {
      result.stats = await getLetterStats(filters)
    }

    if (type === 'trends' || type === 'all') {
      result.trends = await getLetterTrends(filters, groupBy)
    }

    if (type === 'organizations' || type === 'all') {
      result.organizations = await getOrganizationStats(filters, limit)
    }

    if (type === 'users' || type === 'all') {
      result.users = await getUserStats(filters, limit)
    }

    if (type === 'types' || type === 'all') {
      result.types = await getTypeStats(filters)
    }

    if (type === 'performance' || type === 'all') {
      result.performance = await getPerformanceMetrics(filters)
    }

    if (type === 'activity' || type === 'all') {
      result.activity = await getActivityPatterns(filters)
    }

    logger.info('GET /api/analytics/letters', 'Analytics retrieved', {
      userId: session.user.id,
      type,
    })

    return NextResponse.json(result)
  } catch (error) {
    logger.error('GET /api/analytics/letters', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

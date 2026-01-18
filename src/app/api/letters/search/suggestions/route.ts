import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger.server'
import { requirePermission } from '@/lib/permission-guard'
import { getPopularOrganizations, getPopularTypes } from '@/lib/letter-search'

/**
 * GET /api/letters/search/suggestions
 *
 * Получает подсказки для фильтров поиска:
 * - Популярные организации
 * - Популярные типы запросов
 *
 * Query параметры:
 * - type: organizations | types (default: both)
 * - limit: количество результатов (default: 20)
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
    const type = searchParams.get('type') || 'both'
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    const result: any = {}

    if (type === 'organizations' || type === 'both') {
      result.organizations = await getPopularOrganizations(limit)
    }

    if (type === 'types' || type === 'both') {
      result.types = await getPopularTypes(limit)
    }

    return NextResponse.json(result)
  } catch (error) {
    logger.error('GET /api/letters/search/suggestions', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

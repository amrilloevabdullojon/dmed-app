import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger.server'
import { requirePermission } from '@/lib/permission-guard'
import { searchLetters, quickSearch, LetterSearchParams } from '@/lib/letter-search'
import { LetterStatus } from '@prisma/client'

/**
 * GET /api/letters/search
 *
 * Полнотекстовый поиск писем с продвинутыми фильтрами
 *
 * Query параметры:
 * - q: поисковый запрос
 * - status: статус (или массив статусов через запятую)
 * - ownerId: ID владельца
 * - org: организация
 * - type: тип запроса
 * - tags: теги (массив через запятую)
 * - dateFrom, dateTo: диапазон дат письма
 * - deadlineFrom, deadlineTo: диапазон дедлайнов
 * - priorityMin, priorityMax: диапазон приоритета
 * - overdue: только просроченные (true/false)
 * - dueToday: дедлайн сегодня (true/false)
 * - dueThisWeek: дедлайн на этой неделе (true/false)
 * - hasAnswer: наличие ответа (true/false)
 * - hasJiraLink: наличие Jira ссылки (true/false)
 * - favorite: только избранные (true/false)
 * - watching: только наблюдаемые (true/false)
 * - page: номер страницы (default: 1)
 * - limit: количество на странице (default: 50, max: 100)
 * - sortBy: поле сортировки (date, deadlineDate, priority, createdAt, updatedAt, relevance)
 * - sortOrder: порядок сортировки (asc, desc)
 * - quick: быстрый поиск для автозаполнения (true/false)
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

    // Быстрый поиск для автозаполнения
    const isQuickSearch = searchParams.get('quick') === 'true'
    if (isQuickSearch) {
      const query = searchParams.get('q') || ''
      const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20)

      const results = await quickSearch(query, limit)
      return NextResponse.json({ results })
    }

    // Полный поиск
    const params: LetterSearchParams = {
      query: searchParams.get('q') || undefined,
      userId: session.user.id,
    }

    // Статус
    const statusParam = searchParams.get('status')
    if (statusParam) {
      const statuses = statusParam.split(',').filter((s) => s.trim())
      if (statuses.length === 1) {
        params.status = statuses[0] as LetterStatus
      } else if (statuses.length > 1) {
        params.status = statuses as LetterStatus[]
      }
    }

    // Владелец
    if (searchParams.get('ownerId')) {
      params.ownerId = searchParams.get('ownerId')!
    }

    // Организация
    if (searchParams.get('org')) {
      params.org = searchParams.get('org')!
    }

    // Тип
    if (searchParams.get('type')) {
      params.type = searchParams.get('type')!
    }

    // Теги
    const tagsParam = searchParams.get('tags')
    if (tagsParam) {
      params.tags = tagsParam.split(',').filter((t) => t.trim())
    }

    // Даты
    if (searchParams.get('dateFrom')) {
      params.dateFrom = new Date(searchParams.get('dateFrom')!)
    }
    if (searchParams.get('dateTo')) {
      params.dateTo = new Date(searchParams.get('dateTo')!)
    }
    if (searchParams.get('deadlineFrom')) {
      params.deadlineFrom = new Date(searchParams.get('deadlineFrom')!)
    }
    if (searchParams.get('deadlineTo')) {
      params.deadlineTo = new Date(searchParams.get('deadlineTo')!)
    }

    // Приоритет
    if (searchParams.get('priorityMin')) {
      params.priorityMin = parseInt(searchParams.get('priorityMin')!)
    }
    if (searchParams.get('priorityMax')) {
      params.priorityMax = parseInt(searchParams.get('priorityMax')!)
    }

    // Булевые фильтры
    if (searchParams.get('overdue') === 'true') {
      params.overdue = true
    }
    if (searchParams.get('dueToday') === 'true') {
      params.dueToday = true
    }
    if (searchParams.get('dueThisWeek') === 'true') {
      params.dueThisWeek = true
    }
    if (searchParams.get('hasAnswer') !== null) {
      params.hasAnswer = searchParams.get('hasAnswer') === 'true'
    }
    if (searchParams.get('hasJiraLink') !== null) {
      params.hasJiraLink = searchParams.get('hasJiraLink') === 'true'
    }
    if (searchParams.get('favorite') === 'true') {
      params.favorite = true
    }
    if (searchParams.get('watching') === 'true') {
      params.watching = true
    }

    // Пагинация
    if (searchParams.get('page')) {
      params.page = Math.max(1, parseInt(searchParams.get('page')!))
    }
    if (searchParams.get('limit')) {
      params.limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit')!)))
    }

    // Сортировка
    const sortBy = searchParams.get('sortBy')
    if (
      sortBy &&
      ['date', 'deadlineDate', 'priority', 'createdAt', 'updatedAt', 'relevance'].includes(
        sortBy
      )
    ) {
      params.sortBy = sortBy as any
    }

    const sortOrder = searchParams.get('sortOrder')
    if (sortOrder && ['asc', 'desc'].includes(sortOrder)) {
      params.sortOrder = sortOrder as 'asc' | 'desc'
    }

    // Выполняем поиск
    const result = await searchLetters(params)

    logger.info('GET /api/letters/search', 'Search executed', {
      userId: session.user.id,
      query: params.query,
      total: result.total,
    })

    return NextResponse.json(result)
  } catch (error) {
    logger.error('GET /api/letters/search', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/sync/changes - Получить историю изменений для синхронизации
 * Query params:
 *   - status: PENDING | SYNCED | FAILED (фильтр по статусу)
 *   - letterId: string (фильтр по письму)
 *   - limit: number (лимит, default 50)
 *   - offset: number (смещение, default 0)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  // Только админы могут просматривать лог синхронизации
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const letterId = searchParams.get('letterId')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Строим фильтр
    const where: {
      syncStatus?: 'PENDING' | 'PROCESSING' | 'SYNCED' | 'FAILED' | 'SKIPPED'
      letterId?: string
    } = {}

    if (status && ['PENDING', 'PROCESSING', 'SYNCED', 'FAILED', 'SKIPPED'].includes(status)) {
      where.syncStatus = status as typeof where.syncStatus
    }

    if (letterId) {
      where.letterId = letterId
    }

    // Получаем изменения
    const [changes, total] = await Promise.all([
      prisma.letterChangeLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.letterChangeLog.count({ where }),
    ])

    // Получаем информацию о письмах
    const letterIds = Array.from(new Set(changes.map((c) => c.letterId)))
    const letters = await prisma.letter.findMany({
      where: { id: { in: letterIds } },
      select: { id: true, number: true, org: true },
    })
    const letterMap = new Map(letters.map((l) => [l.id, l]))

    // Форматируем результат
    const formattedChanges = changes.map((change) => {
      const letter = letterMap.get(change.letterId)
      return {
        id: change.id,
        letterId: change.letterId,
        letterNumber: letter?.number || null,
        letterOrg: letter?.org || null,
        action: change.action,
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
        syncStatus: change.syncStatus,
        syncError: change.syncError,
        retryCount: change.retryCount,
        createdAt: change.createdAt,
        syncedAt: change.syncedAt,
      }
    })

    return NextResponse.json({
      changes: formattedChanges,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + changes.length < total,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/sync/changes - Очистить старые записи
 * Body: { olderThanDays: number }
 */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  // Только SUPERADMIN может удалять логи
  if (session.user.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { olderThanDays = 30 } = body

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    // Удаляем только успешно синхронизированные записи старше указанного срока
    const result = await prisma.letterChangeLog.deleteMany({
      where: {
        syncStatus: 'SYNCED',
        syncedAt: { lt: cutoffDate },
      },
    })

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `Удалено ${result.count} записей старше ${olderThanDays} дней`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

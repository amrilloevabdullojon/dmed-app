import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSyncStats } from '@/lib/prisma'
import {
  processPendingChanges,
  startSyncWorker,
  stopSyncWorker,
  isSyncWorkerRunning,
} from '@/lib/sync-worker'

/**
 * GET /api/sync/auto - Получить статус автосинхронизации
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  try {
    const stats = await getSyncStats()
    const isRunning = isSyncWorkerRunning()

    return NextResponse.json({
      worker: {
        running: isRunning,
      },
      stats: {
        pending: stats.pending,
        failed: stats.failed,
        synced: stats.synced,
        total: stats.total,
        lastSyncedAt: stats.lastSyncedAt,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Ошибка получения статуса' }, { status: 500 })
  }
}

/**
 * POST /api/sync/auto - Управление автосинхронизацией
 * Body: { action: 'start' | 'stop' | 'trigger' }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  // Только админы могут управлять синхронизацией
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'start': {
        const intervalMs = body.intervalMs || 30000
        startSyncWorker(intervalMs)
        return NextResponse.json({
          success: true,
          message: `Sync worker запущен с интервалом ${intervalMs}ms`,
        })
      }

      case 'stop': {
        stopSyncWorker()
        return NextResponse.json({
          success: true,
          message: 'Sync worker остановлен',
        })
      }

      case 'trigger': {
        // Запустить синхронизацию вручную (одноразово)
        const batchSize = body.batchSize || 50
        const result = await processPendingChanges(batchSize)

        return NextResponse.json({
          success: true,
          result: {
            processed: result.processed,
            synced: result.synced,
            failed: result.failed,
            errors: result.errors,
          },
        })
      }

      default:
        return NextResponse.json(
          { error: 'Неизвестное действие. Используйте: start, stop, trigger' },
          { status: 400 }
        )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

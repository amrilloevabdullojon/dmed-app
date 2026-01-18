import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { syncToGoogleSheets, importFromGoogleSheets } from '@/lib/google-sheets'
import { prisma } from '@/lib/prisma'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger.server'

// POST /api/sync - синхронизация с Google Sheets
export async function POST(request: NextRequest) {
  let logId: string | null = null

  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    // Только админ может синхронизировать
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { direction } = body // 'to_sheets' или 'from_sheets'

    if (direction !== 'to_sheets' && direction !== 'from_sheets') {
      return NextResponse.json(
        { error: 'Invalid direction. Use "to_sheets" or "from_sheets"' },
        { status: 400 }
      )
    }

    // Создать запись лога
    const log = await prisma.syncLog.create({
      data: {
        direction: direction === 'to_sheets' ? 'TO_SHEETS' : 'FROM_SHEETS',
        status: 'IN_PROGRESS',
      },
    })
    logId = log.id

    let result

    // ИСПРАВЛЕНИЕ БАГА: to_sheets должен ЭКСПОРТИРОВАТЬ, from_sheets - ИМПОРТИРОВАТЬ
    if (direction === 'to_sheets') {
      // Экспортируем данные в Google Sheets
      result = await syncToGoogleSheets()
    } else {
      // Импортируем данные из Google Sheets
      result = await importFromGoogleSheets()
    }

    // Обновить лог с результатом
    await prisma.syncLog.update({
      where: { id: logId },
      data: {
        status: result.success ? 'COMPLETED' : 'FAILED',
        rowsAffected:
          ('rowsAffected' in result ? result.rowsAffected : 0) ||
          ('imported' in result ? result.imported : 0),
        error: result.success ? null : 'error' in result ? String(result.error) : 'Unknown error',
        finishedAt: new Date(),
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    logger.error('POST /api/sync', error)

    // Обновить лог с ошибкой если он был создан
    if (logId) {
      await prisma.syncLog.update({
        where: { id: logId },
        data: {
          status: 'FAILED',
          error: String(error),
          finishedAt: new Date(),
        },
      })
    }

    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// GET /api/sync - получить историю синхронизаций
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const logs = await prisma.syncLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({ logs })
  } catch (error) {
    logger.error('GET /api/sync', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

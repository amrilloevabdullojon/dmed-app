import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger.server'

export const dynamic = 'force-dynamic'

// GET /api/sync/logs - получить логи синхронизации
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Только админ может смотреть логи
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')

    const logs = await prisma.syncLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ logs })
  } catch (error) {
    logger.error('GET /api/sync/logs', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

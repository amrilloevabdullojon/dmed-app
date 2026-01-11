import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/permission-guard'
import { logger } from '@/lib/logger.server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const permissionError = requirePermission(session.user.role, 'VIEW_LETTERS')
    if (permissionError) {
      return permissionError
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Проверяем существование письма
    const letter = await prisma.letter.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 })
    }

    // Получаем историю изменений
    const history = await prisma.history.findMany({
      where: { letterId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    // Общее количество записей
    const total = await prisma.history.count({
      where: { letterId: id },
    })

    return NextResponse.json({
      history,
      total,
      hasMore: offset + history.length < total,
    })
  } catch (error) {
    logger.error('GET /api/letters/[id]/history', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

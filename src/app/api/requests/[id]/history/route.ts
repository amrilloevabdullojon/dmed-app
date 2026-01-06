import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { hasPermission } from '@/lib/permissions'

// GET /api/requests/[id]/history - история изменений заявки
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user.role, 'VIEW_REQUESTS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    // Проверяем существование заявки
    const request = await prisma.request.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!request) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 })
    }

    const history = await prisma.requestHistory.findMany({
      where: { requestId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json({ history })
  } catch (error) {
    logger.error('GET /api/requests/[id]/history', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

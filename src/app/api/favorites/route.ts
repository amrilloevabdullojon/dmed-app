import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/permission-guard'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger.server'

// GET /api/favorites - получить избранные письма пользователя
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionError = requirePermission(session.user.role, 'VIEW_LETTERS')
    if (permissionError) {
      return permissionError
    }

    const favorites = await prisma.favorite.findMany({
      where: { userId: session.user.id },
      include: {
        letter: {
          include: {
            owner: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      favorites: favorites.map((f) => ({
        ...f.letter,
        favoritedAt: f.createdAt,
      })),
    })
  } catch (error) {
    logger.error('GET /api/favorites', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/favorites - добавить/удалить из избранного (toggle)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    const permissionError = requirePermission(session.user.role, 'VIEW_LETTERS')
    if (permissionError) {
      return permissionError
    }

    const { letterId } = await request.json()

    if (!letterId) {
      return NextResponse.json({ error: 'Letter ID required' }, { status: 400 })
    }

    // Проверить существование письма
    const letter = await prisma.letter.findUnique({
      where: { id: letterId },
    })

    if (!letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 })
    }

    // Проверить есть ли уже в избранном
    const existing = await prisma.favorite.findUnique({
      where: {
        letterId_userId: {
          letterId,
          userId: session.user.id,
        },
      },
    })

    if (existing) {
      // Удалить из избранного
      await prisma.favorite.delete({
        where: { id: existing.id },
      })

      return NextResponse.json({
        success: true,
        isFavorite: false,
        message: 'Удалено из избранного',
      })
    } else {
      // Добавить в избранное
      await prisma.favorite.create({
        data: {
          letterId,
          userId: session.user.id,
        },
      })

      return NextResponse.json({
        success: true,
        isFavorite: true,
        message: 'Добавлено в избранное',
      })
    }
  } catch (error) {
    logger.error('POST /api/favorites', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

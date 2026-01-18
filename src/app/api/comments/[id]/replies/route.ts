import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/permission-guard'
import { logger } from '@/lib/logger.server'

/**
 * GET /api/comments/[id]/replies - получить ответы на комментарий
 *
 * Query parameters:
 * - page: номер страницы (default: 1)
 * - limit: количество на странице (default: 20, max: 50)
 *
 * Performance: Отдельная загрузка ответов предотвращает N*M query проблему
 * при загрузке письма со многими комментариями
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: commentId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionError = requirePermission(session.user.role, 'VIEW_LETTERS')
    if (permissionError) {
      return permissionError
    }

    // Verify comment exists
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, letterId: true },
    })

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    // Parse pagination parameters
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const skip = (page - 1) * limit

    // Fetch replies
    const replies = await prisma.comment.findMany({
      where: {
        parentId: commentId,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip,
    })

    // Get total count for pagination
    const total = await prisma.comment.count({
      where: {
        parentId: commentId,
      },
    })

    return NextResponse.json({
      replies,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + replies.length < total,
      },
    })
  } catch (error) {
    logger.error('GET /api/comments/[id]/replies', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

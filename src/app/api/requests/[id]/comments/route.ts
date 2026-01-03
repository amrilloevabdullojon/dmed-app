import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const createCommentSchema = z.object({
  text: z.string().min(1, 'Комментарий не может быть пустым').max(5000),
})

// GET /api/requests/[id]/comments - список комментариев
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    const comments = await prisma.requestComment.findMany({
      where: { requestId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json({ comments })
  } catch (error) {
    logger.error('GET /api/requests/[id]/comments', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/requests/[id]/comments - добавить комментарий
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()

    const validation = createCommentSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Invalid data' },
        { status: 400 }
      )
    }

    // Проверяем существование заявки
    const requestRecord = await prisma.request.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    })

    if (!requestRecord) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 })
    }

    if (requestRecord.deletedAt) {
      return NextResponse.json(
        { error: 'Нельзя комментировать удалённую заявку' },
        { status: 400 }
      )
    }

    const comment = await prisma.requestComment.create({
      data: {
        text: validation.data.text,
        requestId: id,
        authorId: session.user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    })

    logger.info('POST /api/requests/[id]/comments', 'Comment created', {
      requestId: id,
      commentId: comment.id,
      authorId: session.user.id,
    })

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    logger.error('POST /api/requests/[id]/comments', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

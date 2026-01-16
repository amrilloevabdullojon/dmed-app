import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger.server'
import { requirePermission } from '@/lib/permission-guard'
import { csrfGuard } from '@/lib/security'
import { z } from 'zod'
import { sendRequestCommentEmail } from '@/lib/request-email'

const createCommentSchema = z.object({
  text: z.string().min(1, 'Комментарий не может быть пустым').max(5000),
})

// GET /api/requests/[id]/comments - список комментариев
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionError = requirePermission(session.user.role, 'VIEW_REQUESTS')
    if (permissionError) {
      return permissionError
    }

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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/requests/[id]/comments - добавить комментарий
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    const permissionError = requirePermission(session.user.role, 'MANAGE_REQUESTS')
    if (permissionError) {
      return permissionError
    }
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
      select: {
        id: true,
        deletedAt: true,
        organization: true,
        contactName: true,
        contactEmail: true,
      },
    })

    if (!requestRecord) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 })
    }

    if (requestRecord.deletedAt) {
      return NextResponse.json({ error: 'Нельзя комментировать удалённую заявку' }, { status: 400 })
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

    // Устанавливаем firstResponseAt если это первый комментарий
    const firstComment = await prisma.requestComment.count({
      where: { requestId: id },
    })

    if (firstComment === 1) {
      await prisma.request.update({
        where: { id },
        data: { firstResponseAt: new Date() },
      })
    }

    // Отправляем email уведомление заявителю
    sendRequestCommentEmail({
      id: requestRecord.id,
      organization: requestRecord.organization,
      contactName: requestRecord.contactName,
      contactEmail: requestRecord.contactEmail,
      commentText: validation.data.text,
      commentAuthor: comment.author.name || comment.author.email || 'Оператор',
    }).catch((err) => {
      logger.error('POST /api/requests/[id]/comments', 'Failed to send email', err)
    })

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    logger.error('POST /api/requests/[id]/comments', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

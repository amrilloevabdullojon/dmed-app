import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger.server'
import { NotificationType } from '@prisma/client'
import { z } from 'zod'

const updateSchema = z.object({
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
  filter: z.enum(['unread', 'deadlines', 'comments', 'statuses', 'assignments', 'system']).optional(),
  action: z.enum(['read', 'archive', 'delete']).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limitParam = Number.parseInt(searchParams.get('limit') || '30', 10)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 30

    const notifications = await prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        priority: true,
        isRead: true,
        createdAt: true,
        letter: {
          select: {
            id: true,
            number: true,
            org: true,
            owner: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })

    return NextResponse.json({ notifications })
  } catch (error) {
    logger.error('GET /api/notifications', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    const body = await request.json()
    const result = updateSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 })
    }

    const { ids, all, filter, action = 'read' } = result.data

    const buildWhere = () => {
      const where: {
        userId: string
        type?: NotificationType
        isRead?: boolean
        id?: { in: string[] }
      } = {
        userId: session.user.id,
      }

      if (ids && ids.length > 0) {
        where.id = { in: ids }
      } else if (all) {
        if (filter === 'unread') {
          where.isRead = false
        } else if (filter === 'comments') {
          where.type = NotificationType.COMMENT
        } else if (filter === 'statuses') {
          where.type = NotificationType.STATUS
        } else if (filter === 'assignments') {
          where.type = NotificationType.ASSIGNMENT
        } else if (filter === 'system') {
          where.type = NotificationType.SYSTEM
        }
      }

      return where
    }

    const where = buildWhere()

    if (action === 'delete') {
      await prisma.notification.deleteMany({ where })
    } else if (action === 'read') {
      await prisma.notification.updateMany({
        where,
        data: { isRead: true },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('PATCH /api/notifications', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

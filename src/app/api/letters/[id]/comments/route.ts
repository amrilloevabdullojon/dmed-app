import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sanitizeInput } from '@/lib/utils'
import { formatNewCommentMessage, sendTelegramMessage } from '@/lib/telegram'
import { sendMultiChannelNotification } from '@/lib/notifications'
import { requirePermission } from '@/lib/permission-guard'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger.server'
import { z } from 'zod'

const commentSchema = z.object({
  text: z.string().min(1).max(2000),
  parentId: z.string().optional().nullable(),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const authorId =
      session.user.id ||
      (session.user.email
        ? (
            await prisma.user.findUnique({
              where: { email: session.user.email },
              select: { id: true },
            })
          )?.id
        : null)
    if (!authorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    const permissionError = requirePermission(session.user.role, 'MANAGE_LETTERS')
    if (permissionError) {
      return permissionError
    }

    const body = await request.json()
    const result = commentSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 })
    }

    const text = sanitizeInput(result.data.text, 2000).trim()
    if (!text) {
      return NextResponse.json({ error: 'Комментарий пустой' }, { status: 400 })
    }

    const letter = await prisma.letter.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        org: true,
        applicantEmail: true,
        applicantPhone: true,
        applicantTelegramChatId: true,
        watchers: {
          include: {
            user: {
              select: { id: true, name: true, email: true, telegramChatId: true },
            },
          },
        },
      },
    })

    if (!letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 })
    }

    if (result.data.parentId) {
      const parent = await prisma.comment.findFirst({
        where: { id: result.data.parentId, letterId: id },
        select: { id: true },
      })
      if (!parent) {
        return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 })
      }
    }

    const comment = await prisma.comment.create({
      data: {
        text,
        letter: { connect: { id } },
        author: { connect: { id: authorId } },
        ...(result.data.parentId ? { parent: { connect: { id: result.data.parentId } } } : {}),
      },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    const createdBy = await prisma.history.findFirst({
      where: { letterId: id, field: 'created' },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, name: true, email: true, telegramChatId: true },
        },
      },
    })

    const notificationUserIds = new Set<string>()

    const recipientChatIds = new Set<string>()

    letter.watchers.forEach((watcher) => {
      if (watcher.notifyOnComment && watcher.user.id !== session.user.id) {
        notificationUserIds.add(watcher.user.id)
        if (watcher.user.telegramChatId) {
          recipientChatIds.add(watcher.user.telegramChatId)
        }
      }
    })

    if (createdBy?.user?.id && createdBy.user.id !== session.user.id) {
      notificationUserIds.add(createdBy.user.id)
      if (createdBy.user.telegramChatId) {
        recipientChatIds.add(createdBy.user.telegramChatId)
      }
    }

    if (notificationUserIds.size > 0) {
      await prisma.notification.createMany({
        data: Array.from(notificationUserIds).map((userId) => ({
          userId,
          letterId: letter.id,
          type: 'COMMENT',
          title: `Новый комментарий к письму №${letter.number}`,
          body: text,
        })),
      })
    }

    if (recipientChatIds.size > 0) {
      const message = formatNewCommentMessage({
        letterNumber: letter.number,
        letterOrg: letter.org,
        author: session.user.name || session.user.email || 'Unknown',
        comment: text,
        isMention: false,
      })

      await Promise.all(
        Array.from(recipientChatIds).map((chatId) => sendTelegramMessage(chatId, message))
      )
    }

    const applicantHasContact = !!(
      letter.applicantEmail ||
      letter.applicantPhone ||
      letter.applicantTelegramChatId
    )

    if (applicantHasContact) {
      const subject = `Новый комментарий к обращению №${letter.number}`
      const bodyText = `Добавлен новый комментарий к вашему обращению.

Номер: ${letter.number}
Организация: ${letter.org}

${text}`
      const telegram = `
<b>Новый комментарий</b>

№${letter.number}
${letter.org}

${text}`

      await sendMultiChannelNotification(
        {
          email: letter.applicantEmail,
          phone: letter.applicantPhone,
          telegramChatId: letter.applicantTelegramChatId,
        },
        { subject, text: bodyText, telegram }
      )
    }

    return NextResponse.json({ success: true, comment })
  } catch (error) {
    logger.error('POST /api/letters/[id]/comments', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

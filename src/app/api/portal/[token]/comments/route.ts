import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sanitizeInput } from '@/lib/utils'
import { withValidation } from '@/lib/api-handler'
import { dispatchNotification } from '@/lib/notification-dispatcher'

const commentSchema = z.object({
  text: z.string().min(1).max(2000),
})

const APPLICANT_EMAIL = 'applicant@portal.local'
const APPLICANT_NAME = '\u0417\u0430\u044f\u0432\u0438\u0442\u0435\u043b\u044c'

function getTokenFromPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean)
  return parts[2] || null
}

async function getApplicantUser() {
  return prisma.user.upsert({
    where: { email: APPLICANT_EMAIL },
    update: { name: APPLICANT_NAME, canLogin: false },
    create: {
      email: APPLICANT_EMAIL,
      name: APPLICANT_NAME,
      role: 'VIEWER',
      canLogin: false,
      notifyEmail: false,
      notifyTelegram: false,
      notifySms: false,
      notifyInApp: false,
    },
    select: { id: true, name: true, email: true },
  })
}

export const POST = withValidation(
  async (request: NextRequest, _session, { body }) => {
    const token = getTokenFromPath(request.nextUrl.pathname)

    if (!token) {
      return NextResponse.json(
        {
          error: '\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u0442\u043e\u043a\u0435\u043d',
        },
        { status: 400 }
      )
    }

    const letter = await prisma.letter.findFirst({
      where: { applicantAccessToken: token },
      select: {
        id: true,
        number: true,
        org: true,
        applicantName: true,
        applicantAccessTokenExpiresAt: true,
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
      return NextResponse.json(
        {
          error:
            '\u041f\u0438\u0441\u044c\u043c\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e',
        },
        { status: 404 }
      )
    }

    if (letter.applicantAccessTokenExpiresAt && letter.applicantAccessTokenExpiresAt < new Date()) {
      return NextResponse.json(
        {
          error: '\u0421\u0441\u044b\u043b\u043a\u0430 \u0438\u0441\u0442\u0435\u043a\u043b\u0430',
        },
        { status: 410 }
      )
    }

    const text = sanitizeInput(body.text, 2000).trim()
    if (!text) {
      return NextResponse.json(
        {
          error:
            '\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u043f\u0443\u0441\u0442\u043e\u0439',
        },
        { status: 400 }
      )
    }

    const applicantUser = await getApplicantUser()

    const comment = await prisma.comment.create({
      data: {
        text,
        letterId: letter.id,
        authorId: applicantUser.id,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    const createdBy = await prisma.history.findFirst({
      where: { letterId: letter.id, field: 'created' },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, name: true, email: true, telegramChatId: true },
        },
      },
    })

    const notificationUserIds = new Set<string>()

    letter.watchers.forEach((watcher) => {
      if (watcher.notifyOnComment) {
        notificationUserIds.add(watcher.user.id)
      }
    })

    if (createdBy?.user?.id) {
      notificationUserIds.add(createdBy.user.id)
    }

    if (notificationUserIds.size > 0) {
      await dispatchNotification({
        event: 'COMMENT',
        title: `\u041d\u043e\u0432\u044b\u0439 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u043e\u0442 \u0437\u0430\u044f\u0432\u0438\u0442\u0435\u043b\u044f \u043f\u043e \u043f\u0438\u0441\u044c\u043c\u0443 \u2116-${letter.number}`,
        body: text,
        letterId: letter.id,
        actorId: null,
        userIds: Array.from(notificationUserIds),
        metadata: { commentId: comment.id, source: 'portal' },
        dedupeKey: `COMMENT:${comment.id}`,
      })
    }

    return NextResponse.json({ success: true, comment })
  },
  {
    public: true,
    rateLimit: { limit: 6, windowMs: 60 * 1000 },
    bodySchema: commentSchema,
  }
)

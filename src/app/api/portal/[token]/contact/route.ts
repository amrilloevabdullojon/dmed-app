import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sanitizeInput } from '@/lib/utils'
import { withValidation } from '@/lib/api-handler'
import { buildApplicantPortalLink, sendMultiChannelNotification } from '@/lib/notifications'

const contactSchema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  telegramChatId: z.string().max(50).optional().or(z.literal('')),
})

function getTokenFromPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean)
  return parts[2] || null
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
        applicantAccessTokenExpiresAt: true,
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

    const email = body.email ? sanitizeInput(body.email, 320).trim() : ''
    const telegramChatId = body.telegramChatId ? sanitizeInput(body.telegramChatId, 50).trim() : ''

    if (!email && !telegramChatId) {
      return NextResponse.json(
        {
          error: '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 email \u0438\u043b\u0438 Telegram ID',
        },
        { status: 400 }
      )
    }

    await prisma.letter.update({
      where: { id: letter.id },
      data: {
        applicantEmail: email || null,
        applicantTelegramChatId: telegramChatId || null,
      },
    })

    const link = buildApplicantPortalLink(token)
    const subject = `\u041f\u043e\u0434\u043f\u0438\u0441\u043a\u0430 \u043d\u0430 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f \u043f\u043e \u043f\u0438\u0441\u044c\u043c\u0443 \u2116-${letter.number}`
    const text = `\u0412\u044b \u043f\u043e\u0434\u043f\u0438\u0441\u0430\u043b\u0438\u0441\u044c \u043d\u0430 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f \u043f\u043e \u043f\u0438\u0441\u044c\u043c\u0443 \u2116-${letter.number}.\n\n${link}`
    const telegram = `\n<b>\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f \u043f\u043e \u043f\u0438\u0441\u044c\u043c\u0443 \u2116-${letter.number}</b>\n${letter.org}\n\n<a href="${link}">\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u043e\u0440\u0442\u0430\u043b</a>`

    await sendMultiChannelNotification(
      { email: email || null, telegramChatId: telegramChatId || null },
      { subject, text, telegram }
    )

    return NextResponse.json({
      success: true,
      contact: { email: email || null, telegramChatId: telegramChatId || null },
    })
  },
  {
    public: true,
    rateLimit: { limit: 5, windowMs: 10 * 60 * 1000 },
    bodySchema: contactSchema,
  }
)

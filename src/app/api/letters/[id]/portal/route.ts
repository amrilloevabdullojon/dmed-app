import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildApplicantPortalLink, sendMultiChannelNotification } from '@/lib/notifications'
import { hasPermission } from '@/lib/permissions'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    if (!hasPermission(session.user.role, 'MANAGE_LETTERS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const letter = await prisma.letter.findUnique({
      where: { id: params.id },
    })

    if (!letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 })
    }

    const token = randomUUID()
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90)

    const updated = await prisma.letter.update({
      where: { id: params.id },
      data: {
        applicantAccessToken: token,
        applicantAccessTokenExpiresAt: expiresAt,
      },
    })

    const link = buildApplicantPortalLink(token)

    const hasApplicantContact = !!(
      updated.applicantEmail ||
      updated.applicantPhone ||
      updated.applicantTelegramChatId
    )

    if (hasApplicantContact) {
      const subject = `Ссылка на статус обращения №${updated.number}`
      const text = `Ссылка для просмотра статуса обращения.\n\nНомер: ${updated.number}\nОрганизация: ${updated.org}\n\n${link}`
      const telegram = `\n<b>Ссылка на статус обращения</b>\n\n№${updated.number}\n${updated.org}\n\n<a href="${link}">Открыть статус</a>`

      await sendMultiChannelNotification(
        {
          email: updated.applicantEmail,
          phone: updated.applicantPhone,
          telegramChatId: updated.applicantTelegramChatId,
        },
        { subject, text, telegram }
      )
    }

    return NextResponse.json({
      success: true,
      link,
      expiresAt,
      notified: hasApplicantContact,
    })
  } catch (error) {
    logger.error('POST /api/letters/[id]/portal', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

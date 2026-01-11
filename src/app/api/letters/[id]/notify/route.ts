import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendTelegramMessage, formatNewLetterMessage } from '@/lib/telegram'
import { formatDate } from '@/lib/utils'
import { requirePermission } from '@/lib/permission-guard'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger.server'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
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

    const letter = await prisma.letter.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true, telegramChatId: true },
        },
      },
    })

    if (!letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 })
    }

    if (!letter.owner?.telegramChatId) {
      return NextResponse.json(
        {
          error:
            '\u0423 \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430 \u043d\u0435\u0442 Telegram ID',
        },
        { status: 400 }
      )
    }

    const message = formatNewLetterMessage({
      number: letter.number,
      org: letter.org,
      deadline: formatDate(letter.deadlineDate),
      owner: letter.owner.name || letter.owner.email || undefined,
    })

    const sent = await sendTelegramMessage(letter.owner.telegramChatId, message)
    if (!sent) {
      return NextResponse.json(
        {
          error:
            '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('POST /api/letters/[id]/notify', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

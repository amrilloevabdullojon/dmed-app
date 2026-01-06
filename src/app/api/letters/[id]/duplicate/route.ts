import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/permissions'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger'

// POST /api/letters/[id]/duplicate - дублировать письмо
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params

    // Получить исходное письмо
    const original = await prisma.letter.findUnique({
      where: { id },
      include: {
        tags: true,
      },
    })

    if (!original) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 })
    }

    // Создать копию с новым номером
    const copyNumber = `${original.number}-КОПИЯ`

    const duplicate = await prisma.letter.create({
      data: {
        number: copyNumber,
        org: original.org,
        date: original.date,
        deadlineDate: original.deadlineDate,
        status: 'NOT_REVIEWED', // Сбрасываем статус
        type: original.type,
        content: original.content,
        zordoc: null, // Сбрасываем ZorDoc
        answer: null, // Сбрасываем ответ
        sendStatus: null,
        ijroDate: null,
        comment: original.comment,
        contacts: original.contacts,
        applicantName: original.applicantName,
        applicantEmail: original.applicantEmail,
        applicantPhone: original.applicantPhone,
        applicantTelegramChatId: original.applicantTelegramChatId,
        applicantAccessToken: null,
        applicantAccessTokenExpiresAt: null,
        closeDate: null,
        jiraLink: null, // Сбрасываем Jira
        priority: original.priority,
        ownerId: session.user.id, // Назначаем текущего пользователя
        tags: {
          connect: original.tags.map((tag) => ({ id: tag.id })),
        },
      },
    })

    // Записать в историю
    await prisma.history.create({
      data: {
        letterId: duplicate.id,
        userId: session.user.id,
        field: 'created',
        oldValue: null,
        newValue: `Скопировано из письма №${original.number}`,
      },
    })

    return NextResponse.json({
      success: true,
      id: duplicate.id,
      number: duplicate.number,
    })
  } catch (error) {
    logger.error('POST /api/letters/[id]/duplicate', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

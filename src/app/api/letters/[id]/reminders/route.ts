import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger.server'
import { requirePermission } from '@/lib/permission-guard'
import { csrfGuard } from '@/lib/security'
import { z } from 'zod'
import { LetterReminderType } from '@prisma/client'
import { createReminder, deactivateReminders } from '@/lib/letter-reminders'

const createReminderSchema = z.object({
  type: z.nativeEnum(LetterReminderType),
  triggerDate: z.string().datetime(),
  message: z.string().min(1).max(500),
})

// GET /api/letters/[id]/reminders - получить напоминания письма
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionError = requirePermission(session.user.role, 'VIEW_LETTERS')
    if (permissionError) {
      return permissionError
    }

    // Проверяем существование письма
    const letter = await prisma.letter.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!letter) {
      return NextResponse.json({ error: 'Письмо не найдено' }, { status: 404 })
    }

    const reminders = await prisma.letterReminder.findMany({
      where: { letterId: id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { triggerDate: 'asc' }],
    })

    return NextResponse.json({ reminders })
  } catch (error) {
    logger.error('GET /api/letters/[id]/reminders', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/letters/[id]/reminders - создать напоминание
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const permissionError = requirePermission(session.user.role, 'MANAGE_LETTERS')
    if (permissionError) {
      return permissionError
    }

    // Проверяем существование письма
    const letter = await prisma.letter.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    })

    if (!letter) {
      return NextResponse.json({ error: 'Письмо не найдено' }, { status: 404 })
    }

    if (letter.deletedAt) {
      return NextResponse.json(
        { error: 'Нельзя создать напоминание для удалённого письма' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validation = createReminderSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Invalid data' },
        { status: 400 }
      )
    }

    const reminder = await createReminder({
      letterId: id,
      type: validation.data.type,
      triggerDate: new Date(validation.data.triggerDate),
      message: validation.data.message,
      createdById: session.user.id,
    })

    logger.info('POST /api/letters/[id]/reminders', 'Reminder created', {
      letterId: id,
      reminderId: reminder.id,
      type: validation.data.type,
    })

    return NextResponse.json({ reminder }, { status: 201 })
  } catch (error) {
    logger.error('POST /api/letters/[id]/reminders', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/letters/[id]/reminders?reminderId=xxx - удалить/деактивировать напоминание
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const permissionError = requirePermission(session.user.role, 'MANAGE_LETTERS')
    if (permissionError) {
      return permissionError
    }

    const { searchParams } = new URL(request.url)
    const reminderId = searchParams.get('reminderId')

    if (!reminderId) {
      // Деактивируем все напоминания письма
      await deactivateReminders(id)
      logger.info('DELETE /api/letters/[id]/reminders', 'All reminders deactivated', {
        letterId: id,
      })
      return NextResponse.json({ success: true })
    }

    // Деактивируем конкретное напоминание
    const reminder = await prisma.letterReminder.findUnique({
      where: { id: reminderId },
      select: { id: true, letterId: true },
    })

    if (!reminder || reminder.letterId !== id) {
      return NextResponse.json({ error: 'Напоминание не найдено' }, { status: 404 })
    }

    await prisma.letterReminder.update({
      where: { id: reminderId },
      data: { isActive: false },
    })

    logger.info('DELETE /api/letters/[id]/reminders', 'Reminder deactivated', {
      reminderId,
      letterId: id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('DELETE /api/letters/[id]/reminders', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

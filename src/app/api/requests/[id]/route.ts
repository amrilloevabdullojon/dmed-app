import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { idParamSchema, updateRequestSchema } from '@/lib/schemas'
import { logger } from '@/lib/logger'
import { hasPermission } from '@/lib/permissions'
import { formatRequestStatusChangeMessage, sendTelegramMessage } from '@/lib/telegram'
import type { Prisma, RequestStatus } from '@prisma/client'

const CONTEXT = 'API:Requests:[id]'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paramResult = idParamSchema.safeParse(params)
    if (!paramResult.success) {
      return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 })
    }

    const requestRecord = await prisma.request.findUnique({
      where: { id: params.id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        files: true,
      },
    })

    if (!requestRecord) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    return NextResponse.json({ request: requestRecord })
  } catch (error) {
    logger.error(CONTEXT, error, { method: 'GET', requestId: params.id })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paramResult = idParamSchema.safeParse(params)
    if (!paramResult.success) {
      return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid request data.' },
        { status: 400 }
      )
    }

    // Получаем текущую заявку для аудита
    const currentRequest = await prisma.request.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        organization: true,
        status: true,
        assignedToId: true,
        assignedTo: { select: { name: true, email: true } },
      },
    })

    if (!currentRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    const updateData: Prisma.RequestUpdateInput = {}
    let statusChanged = false
    let assigneeChanged = false

    // Обработка изменения статуса
    if (parsed.data.status && parsed.data.status !== currentRequest.status) {
      updateData.status = parsed.data.status
      statusChanged = true
    }

    // Обработка изменения assignedTo
    if (parsed.data.assignedToId !== undefined) {
      if (parsed.data.assignedToId !== currentRequest.assignedToId) {
        if (parsed.data.assignedToId) {
          // Проверяем существование пользователя
          const assignee = await prisma.user.findUnique({
            where: { id: parsed.data.assignedToId },
            select: { id: true, name: true },
          })

          if (!assignee) {
            return NextResponse.json(
              { error: 'Assigned user not found' },
              { status: 404 }
            )
          }

          updateData.assignedTo = { connect: { id: parsed.data.assignedToId } }
        } else {
          updateData.assignedTo = { disconnect: true }
        }
        assigneeChanged = true
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No updates provided.' }, { status: 400 })
    }

    const updated = await prisma.request.update({
      where: { id: params.id },
      data: updateData,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        files: true,
      },
    })

    // Логируем изменения
    const changes: string[] = []
    if (statusChanged) {
      changes.push(`status: ${currentRequest.status} -> ${updated.status}`)
    }
    if (assigneeChanged) {
      const oldAssignee = currentRequest.assignedTo?.name || currentRequest.assignedTo?.email || 'none'
      const newAssignee = updated.assignedTo?.name || updated.assignedTo?.email || 'none'
      changes.push(`assignee: ${oldAssignee} -> ${newAssignee}`)
    }

    logger.info(CONTEXT, 'Request updated', {
      requestId: params.id,
      actorId: session.user.id,
      changes,
    })

    // Отправляем Telegram уведомление при изменении статуса
    if (statusChanged) {
      const chatId =
        process.env.TELEGRAM_REQUESTS_CHAT_ID ||
        process.env.TELEGRAM_ADMIN_CHAT_ID

      if (chatId) {
        const message = formatRequestStatusChangeMessage({
          id: params.id,
          organization: currentRequest.organization,
          oldStatus: currentRequest.status,
          newStatus: updated.status as string,
          changedBy: session.user.name || session.user.email || 'Unknown',
          assignedTo: updated.assignedTo?.name || updated.assignedTo?.email,
        })

        // Отправляем асинхронно, не блокируя ответ
        sendTelegramMessage(chatId, message).catch((err) => {
          logger.error(CONTEXT, err, { action: 'telegram_notification', requestId: params.id })
        })
      }
    }

    return NextResponse.json({ success: true, request: updated })
  } catch (error) {
    logger.error(CONTEXT, error, { method: 'PATCH', requestId: params.id })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Только админы могут удалять заявки
    if (!hasPermission(session.user.role, 'MANAGE_USERS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const paramResult = idParamSchema.safeParse(params)
    if (!paramResult.success) {
      return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 })
    }

    const requestRecord = await prisma.request.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        organization: true,
        contactName: true,
        contactEmail: true,
        status: true,
        _count: { select: { files: true } },
      },
    })

    if (!requestRecord) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Удаляем заявку (файлы удалятся каскадно)
    await prisma.request.delete({
      where: { id: params.id },
    })

    logger.info(CONTEXT, 'Request deleted', {
      requestId: params.id,
      actorId: session.user.id,
      organization: requestRecord.organization,
      filesCount: requestRecord._count.files,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error(CONTEXT, error, { method: 'DELETE', requestId: params.id })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

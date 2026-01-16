import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { idParamSchema, updateRequestSchema } from '@/lib/schemas'
import { logger } from '@/lib/logger.server'
import { requirePermission } from '@/lib/permission-guard'
import { formatRequestStatusChangeMessage, sendTelegramMessage } from '@/lib/telegram'
import { csrfGuard } from '@/lib/security'
import type { Prisma } from '@prisma/client'
import { calculateSlaDeadline, calculateSlaStatus } from '@/lib/request-sla'

const CONTEXT = 'API:Requests:[id]'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionError = requirePermission(session.user.role, 'VIEW_REQUESTS')
    if (permissionError) {
      return permissionError
    }

    const paramResult = idParamSchema.safeParse({ id })
    if (!paramResult.success) {
      return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 })
    }

    const requestRecord = await prisma.request.findUnique({
      where: { id, deletedAt: null },
      include: {
        assignedTo: { select: { id: true, name: true, email: true, image: true } },
        files: true,
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        tags: true,
        _count: { select: { history: true } },
      },
    })

    if (!requestRecord) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    return NextResponse.json({ request: requestRecord })
  } catch (error) {
    const { id } = await params
    logger.error(CONTEXT, error, { method: 'GET', requestId: id })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const permissionError = requirePermission(session.user.role, 'MANAGE_REQUESTS')
    if (permissionError) {
      return permissionError
    }

    const paramResult = idParamSchema.safeParse({ id })
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
      where: { id, deletedAt: null },
      select: {
        id: true,
        organization: true,
        status: true,
        priority: true,
        category: true,
        assignedToId: true,
        assignedTo: { select: { name: true, email: true } },
        createdAt: true,
        slaDeadline: true,
        resolvedAt: true,
        slaStatus: true,
      },
    })

    if (!currentRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    const updateData: Prisma.RequestUpdateInput = {}
    const historyRecords: { field: string; oldValue: string | null; newValue: string | null }[] = []

    // Обработка изменения статуса
    if (parsed.data.status && parsed.data.status !== currentRequest.status) {
      updateData.status = parsed.data.status
      historyRecords.push({
        field: 'status',
        oldValue: currentRequest.status,
        newValue: parsed.data.status,
      })

      // Если заявка завершена, устанавливаем resolvedAt
      if (parsed.data.status === 'DONE' && !currentRequest.resolvedAt) {
        updateData.resolvedAt = new Date()
      }

      // Если заявка снова открыта, сбрасываем resolvedAt
      if (parsed.data.status !== 'DONE' && currentRequest.resolvedAt) {
        updateData.resolvedAt = null
      }
    }

    // Обработка изменения приоритета
    if (parsed.data.priority && parsed.data.priority !== currentRequest.priority) {
      updateData.priority = parsed.data.priority
      historyRecords.push({
        field: 'priority',
        oldValue: currentRequest.priority,
        newValue: parsed.data.priority,
      })

      // Пересчитываем SLA дедлайн при изменении приоритета
      const newDeadline = calculateSlaDeadline(currentRequest.createdAt, parsed.data.priority)
      updateData.slaDeadline = newDeadline
    }

    // Обработка изменения категории
    if (parsed.data.category && parsed.data.category !== currentRequest.category) {
      updateData.category = parsed.data.category
      historyRecords.push({
        field: 'category',
        oldValue: currentRequest.category,
        newValue: parsed.data.category,
      })
    }

    // Обработка изменения assignedTo
    if (parsed.data.assignedToId !== undefined) {
      if (parsed.data.assignedToId !== currentRequest.assignedToId) {
        if (parsed.data.assignedToId) {
          // Проверяем существование пользователя
          const assignee = await prisma.user.findUnique({
            where: { id: parsed.data.assignedToId },
            select: { id: true, name: true, email: true },
          })

          if (!assignee) {
            return NextResponse.json({ error: 'Assigned user not found' }, { status: 404 })
          }

          updateData.assignedTo = { connect: { id: parsed.data.assignedToId } }
          historyRecords.push({
            field: 'assignedTo',
            oldValue: currentRequest.assignedTo?.name || currentRequest.assignedTo?.email || null,
            newValue: assignee.name || assignee.email,
          })
        } else {
          updateData.assignedTo = { disconnect: true }
          historyRecords.push({
            field: 'assignedTo',
            oldValue: currentRequest.assignedTo?.name || currentRequest.assignedTo?.email || null,
            newValue: null,
          })
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No updates provided.' }, { status: 400 })
    }

    // Обновляем SLA статус если нужно
    const newSlaStatus = calculateSlaStatus(
      updateData.slaDeadline ? (updateData.slaDeadline as Date) : currentRequest.slaDeadline,
      updateData.resolvedAt ? (updateData.resolvedAt as Date) : currentRequest.resolvedAt,
      (updateData.status as string) || currentRequest.status
    )
    if (newSlaStatus !== currentRequest.slaStatus) {
      updateData.slaStatus = newSlaStatus
    }

    // Обновляем заявку и записываем историю в одной транзакции
    const [updated] = await prisma.$transaction([
      prisma.request.update({
        where: { id },
        data: updateData,
        include: {
          assignedTo: { select: { id: true, name: true, email: true, image: true } },
          files: true,
          comments: {
            orderBy: { createdAt: 'asc' },
            include: {
              author: { select: { id: true, name: true, email: true, image: true } },
            },
          },
          _count: { select: { history: true } },
        },
      }),
      // Записываем все изменения в историю
      ...historyRecords.map((record) =>
        prisma.requestHistory.create({
          data: {
            requestId: id,
            userId: session.user.id,
            field: record.field,
            oldValue: record.oldValue,
            newValue: record.newValue,
          },
        })
      ),
    ])

    logger.info(CONTEXT, 'Request updated', {
      requestId: id,
      actorId: session.user.id,
      changes: historyRecords.map((r) => `${r.field}: ${r.oldValue} -> ${r.newValue}`),
    })

    // Отправляем Telegram уведомление при изменении статуса
    const statusChange = historyRecords.find((r) => r.field === 'status')
    if (statusChange) {
      const chatId = process.env.TELEGRAM_REQUESTS_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID

      if (chatId) {
        const message = formatRequestStatusChangeMessage({
          id,
          organization: currentRequest.organization,
          oldStatus: statusChange.oldValue || '',
          newStatus: statusChange.newValue || '',
          changedBy: session.user.name || session.user.email || 'Unknown',
          assignedTo: updated.assignedTo?.name || updated.assignedTo?.email,
        })

        // Отправляем асинхронно, не блокируя ответ
        sendTelegramMessage(chatId, message).catch((err) => {
          logger.error(CONTEXT, err, { action: 'telegram_notification', requestId: id })
        })
      }
    }

    return NextResponse.json({ success: true, request: updated })
  } catch (error) {
    const { id } = await params
    logger.error(CONTEXT, error, { method: 'PATCH', requestId: id })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(_request)
    if (csrfError) {
      return csrfError
    }

    // Только админы могут удалять заявки
    const permissionError = requirePermission(session.user.role, 'MANAGE_REQUESTS')
    if (permissionError) {
      return permissionError
    }

    const paramResult = idParamSchema.safeParse({ id })
    if (!paramResult.success) {
      return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 })
    }

    const requestRecord = await prisma.request.findUnique({
      where: { id, deletedAt: null },
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

    // Soft delete - помечаем как удалённую и записываем в историю
    await prisma.$transaction([
      prisma.request.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      prisma.requestHistory.create({
        data: {
          requestId: id,
          userId: session.user.id,
          field: 'deletedAt',
          oldValue: null,
          newValue: new Date().toISOString(),
        },
      }),
    ])

    logger.info(CONTEXT, 'Request soft deleted', {
      requestId: id,
      actorId: session.user.id,
      organization: requestRecord.organization,
      filesCount: requestRecord._count.files,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const { id } = await params
    logger.error(CONTEXT, error, { method: 'DELETE', requestId: id })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

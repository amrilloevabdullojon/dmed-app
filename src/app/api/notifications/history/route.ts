import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger.server'
import { NotificationChannel, NotificationType, type Prisma } from '@prisma/client'

const isMissingNotificationActorColumn = (error: unknown) =>
  error instanceof Error && error.message.includes('Notification.actorId')

const toCsvValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return ''
  const stringValue = String(value)
  if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/\"/g, '""')}"`
  }
  return stringValue
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()
    const type = searchParams.get('type')
    const channel = searchParams.get('channel')
    const read = searchParams.get('read')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const format = searchParams.get('format')
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 25), 1), 200)
    const offset = Math.max(Number(searchParams.get('offset') || 0), 0)

    const where: Prisma.NotificationWhereInput = {
      userId: session.user.id,
    }

    if (type && type !== 'all') {
      where.type = type as NotificationType
    }

    if (read === 'read') {
      where.isRead = true
    } else if (read === 'unread') {
      where.isRead = false
    }

    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) where.createdAt.lte = new Date(to)
    }

    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { body: { contains: query, mode: 'insensitive' } },
        { letter: { number: { contains: query, mode: 'insensitive' } } },
        { letter: { org: { contains: query, mode: 'insensitive' } } },
      ]
    }

    if (channel && channel !== 'all') {
      where.deliveries = { some: { channel: channel as NotificationChannel } }
    }

    const total = await prisma.notification.count({ where })

    const buildSelect = (includeActor: boolean) => ({
      id: true,
      createdAt: true,
      type: true,
      priority: true,
      title: true,
      body: true,
      letter: { select: { id: true, number: true, org: true } },
      deliveries: {
        select: {
          id: true,
          channel: true,
          status: true,
          recipient: true,
          sentAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      ...(includeActor ? { actor: { select: { id: true, name: true, email: true } } } : {}),
    })

    let notifications: Array<{
      id: string
      createdAt: Date
      type: NotificationType
      priority: string
      title: string
      body: string | null
      letter: { id: string; number: string; org: string } | null
      deliveries: Array<{
        id: string
        channel: NotificationChannel
        status: string
        recipient: string | null
        sentAt: Date | null
        createdAt: Date
      }>
      actor?: { id: string; name: string | null; email: string | null } | null
    }>

    try {
      notifications = await prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: format === 'csv' ? undefined : limit,
        skip: format === 'csv' ? undefined : offset,
        select: buildSelect(true),
      })
    } catch (error) {
      if (!isMissingNotificationActorColumn(error)) {
        throw error
      }

      notifications = await prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: format === 'csv' ? undefined : limit,
        skip: format === 'csv' ? undefined : offset,
        select: buildSelect(false),
      })
    }

    if (format === 'csv') {
      const rows: string[] = []
      rows.push(
        [
          'Notification ID',
          'Created At',
          'Type',
          'Priority',
          'Title',
          'Body',
          'Letter Number',
          'Organization',
          'Actor',
          'Channel',
          'Delivery Status',
          'Recipient',
          'Sent At',
        ]
          .map(toCsvValue)
          .join(',')
      )

      notifications.forEach((notification) => {
        if (notification.deliveries.length === 0) {
          rows.push(
            [
              notification.id,
              notification.createdAt.toISOString(),
              notification.type,
              notification.priority,
              notification.title,
              notification.body || '',
              notification.letter?.number || '',
              notification.letter?.org || '',
              notification.actor?.name || notification.actor?.email || '',
              '',
              '',
              '',
              '',
            ]
              .map(toCsvValue)
              .join(',')
          )
          return
        }

        notification.deliveries.forEach((delivery) => {
          rows.push(
            [
              notification.id,
              notification.createdAt.toISOString(),
              notification.type,
              notification.priority,
              notification.title,
              notification.body || '',
              notification.letter?.number || '',
              notification.letter?.org || '',
              notification.actor?.name || notification.actor?.email || '',
              delivery.channel,
              delivery.status,
              delivery.recipient || '',
              delivery.sentAt ? delivery.sentAt.toISOString() : '',
            ]
              .map(toCsvValue)
              .join(',')
          )
        })
      })

      return new NextResponse(rows.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename=\"notifications-history.csv\"',
        },
      })
    }

    return NextResponse.json({ notifications, total })
  } catch (error) {
    logger.error('GET /api/notifications/history', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

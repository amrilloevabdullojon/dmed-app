import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger.server'
import { requirePermission } from '@/lib/permission-guard'
import { URGENT_DAYS } from '@/lib/constants'
import { getDaysUntilDeadline } from '@/lib/utils'
import { dispatchNotification } from '@/lib/notification-dispatcher'

const SLA_REPEAT_MINUTES = 24 * 60
const SLA_ESCALATION_DAYS = 3

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionError = requirePermission(session.user.role, 'MANAGE_LETTERS')
    if (permissionError) {
      return permissionError
    }

    const now = new Date()
    const urgentEnd = new Date(now.getTime() + URGENT_DAYS * 24 * 60 * 60 * 1000)
    const letters = await prisma.letter.findMany({
      where: {
        deletedAt: null,
        deadlineDate: { not: null, lte: urgentEnd },
        status: { notIn: ['READY', 'DONE'] },
      },
      select: {
        id: true,
        number: true,
        org: true,
        deadlineDate: true,
        ownerId: true,
      },
    })

    const managers = await prisma.user.findMany({
      where: { role: { in: ['MANAGER', 'ADMIN'] }, canLogin: true },
      select: { id: true },
    })
    const managerIds = managers.map((manager) => manager.id)
    const dedupeDate = now.toISOString().slice(0, 10)

    let urgentCount = 0
    let overdueCount = 0
    let escalations = 0

    for (const letter of letters) {
      if (!letter.deadlineDate) continue
      const daysLeft = getDaysUntilDeadline(letter.deadlineDate)
      const isOverdue = daysLeft < 0
      const event = isOverdue ? 'DEADLINE_OVERDUE' : 'DEADLINE_URGENT'
      const title = isOverdue
        ? `Просрочен дедлайн по письму №-${letter.number}`
        : `Срочный дедлайн по письму №-${letter.number}`
      const body = `Организация: ${letter.org}\nДедлайн: ${letter.deadlineDate.toLocaleDateString(
        'ru-RU'
      )}\n${isOverdue ? 'Просрочка' : 'Осталось'}: ${Math.abs(daysLeft)} дн.`

      if (letter.ownerId) {
        await dispatchNotification({
          event,
          title,
          body,
          letterId: letter.id,
          actorId: null,
          userIds: [letter.ownerId],
          metadata: {
            daysLeft,
            level: isOverdue
              ? Math.abs(daysLeft) >= SLA_ESCALATION_DAYS
                ? 'overdue'
                : 'late'
              : 'urgent',
          },
          dedupeKey: `SLA:${event}:${letter.id}:${dedupeDate}`,
          dedupeWindowMinutes: SLA_REPEAT_MINUTES,
        })
      }

      if (isOverdue) {
        overdueCount += 1
        if (Math.abs(daysLeft) >= SLA_ESCALATION_DAYS && managerIds.length > 0) {
          await dispatchNotification({
            event: 'DEADLINE_OVERDUE',
            title: `Эскалация: просрочено письмо №-${letter.number}`,
            body,
            letterId: letter.id,
            actorId: null,
            userIds: managerIds,
            metadata: { daysLeft, level: 'escalation' },
            dedupeKey: `SLA:ESCALATION:${letter.id}:${dedupeDate}`,
            dedupeWindowMinutes: SLA_REPEAT_MINUTES,
            includeSubscriptions: false,
          })
          escalations += 1
        }
      } else {
        urgentCount += 1
      }
    }

    return NextResponse.json({ success: true, urgentCount, overdueCount, escalations })
  } catch (error) {
    logger.error('POST /api/notifications/sla', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

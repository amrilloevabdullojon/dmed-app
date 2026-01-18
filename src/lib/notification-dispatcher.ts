import { prisma } from '@/lib/prisma'
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationEventType,
  NotificationSettings,
  normalizeNotificationSettings,
  isWithinQuietHours,
} from '@/lib/notification-settings'
import { sendEmail, sendSms } from '@/lib/notifications'
import { sendTelegramMessage } from '@/lib/telegram'
import type {
  DigestFrequency,
  NotificationChannel,
  NotificationPriority,
  Prisma,
} from '@prisma/client'

const isMissingNotificationActorColumn = (error: unknown) =>
  error instanceof Error && error.message.includes('Notification.actorId')

type DispatchNotificationInput = {
  event: NotificationEventType
  title: string
  body?: string | null
  letterId?: string | null
  actorId?: string | null
  userIds?: string[]
  metadata?: Record<string, unknown>
  dedupeKey?: string
  dedupeWindowMinutes?: number
  includeSubscriptions?: boolean
}

const priorityMap: Record<
  NotificationSettings['matrix'][number]['priority'],
  NotificationPriority
> = {
  low: 'LOW',
  normal: 'NORMAL',
  high: 'HIGH',
  critical: 'CRITICAL',
}

const buildSettingsFromUser = (user: {
  notifyEmail: boolean
  notifyTelegram: boolean
  notifySms: boolean
  notifyInApp: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
  digestFrequency: DigestFrequency
}): NotificationSettings => {
  const emailDigest =
    user.digestFrequency === 'DAILY'
      ? 'daily'
      : user.digestFrequency === 'WEEKLY'
        ? 'weekly'
        : 'instant'
  return normalizeNotificationSettings({
    inAppNotifications: user.notifyInApp,
    emailNotifications: user.notifyEmail,
    telegramNotifications: user.notifyTelegram,
    smsNotifications: user.notifySms,
    emailDigest,
    quietHoursEnabled: Boolean(user.quietHoursStart && user.quietHoursEnd),
    quietHoursStart: user.quietHoursStart || DEFAULT_NOTIFICATION_SETTINGS.quietHoursStart,
    quietHoursEnd: user.quietHoursEnd || DEFAULT_NOTIFICATION_SETTINGS.quietHoursEnd,
  })
}

const isEventEnabled = (settings: NotificationSettings, event: NotificationEventType) => {
  switch (event) {
    case 'NEW_LETTER':
      return settings.notifyOnNewLetter
    case 'COMMENT':
      return settings.notifyOnComment
    case 'STATUS':
      return settings.notifyOnStatusChange
    case 'ASSIGNMENT':
      return settings.notifyOnAssignment
    case 'DEADLINE_URGENT':
    case 'DEADLINE_OVERDUE':
      return settings.notifyOnDeadline
    case 'SYSTEM':
      return settings.notifyOnSystem
    default:
      return true
  }
}

const isImportantEvent = (event: NotificationEventType, priority: NotificationPriority) => {
  if (event === 'DEADLINE_URGENT' || event === 'DEADLINE_OVERDUE') return true
  return priority === 'HIGH' || priority === 'CRITICAL'
}

const buildMessage = (title: string, body?: string | null) => {
  if (!body) return title
  return `${title}\n\n${body}`
}

const resolveSubscriptions = async (
  event: NotificationEventType,
  actorId?: string | null
): Promise<string[]> => {
  const subscriptions = await prisma.notificationSubscription.findMany({
    where: {
      OR: [{ event: 'ALL' }, { event }],
    },
    select: { userId: true, scope: true, value: true },
  })

  if (subscriptions.length === 0) return []

  const actor = actorId
    ? await prisma.user.findUnique({
        where: { id: actorId },
        select: { id: true, role: true },
      })
    : null

  return subscriptions
    .filter((subscription) => {
      if (subscription.scope === 'ALL') return true
      if (!actor) return false
      if (subscription.scope === 'ROLE') return subscription.value === actor.role
      if (subscription.scope === 'USER') return subscription.value === actor.id
      return false
    })
    .map((subscription) => subscription.userId)
}

export const dispatchNotification = async ({
  event,
  title,
  body,
  letterId,
  actorId,
  userIds = [],
  metadata,
  dedupeKey,
  dedupeWindowMinutes = 10,
  includeSubscriptions = true,
}: DispatchNotificationInput) => {
  const recipients = new Set(userIds.filter(Boolean))

  if (includeSubscriptions) {
    const subscriptionRecipients = await resolveSubscriptions(event, actorId)
    subscriptionRecipients.forEach((id) => recipients.add(id))
  }

  if (recipients.size === 0) return

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(recipients) } },
    select: {
      id: true,
      email: true,
      telegramChatId: true,
      notifyEmail: true,
      notifyTelegram: true,
      notifySms: true,
      notifyInApp: true,
      quietHoursStart: true,
      quietHoursEnd: true,
      digestFrequency: true,
      profile: { select: { phone: true } },
      notificationPreference: { select: { settings: true } },
    },
  })

  const matrixDefaults = new Map(
    DEFAULT_NOTIFICATION_SETTINGS.matrix.map((item) => [item.event, item])
  )
  const now = new Date()
  const dedupeSince =
    dedupeWindowMinutes > 0 ? new Date(now.getTime() - dedupeWindowMinutes * 60 * 1000) : null
  const baseDedupeKey = dedupeKey || [event, letterId || 'none', actorId || 'system'].join(':')

  for (const user of users) {
    const settings = user.notificationPreference?.settings
      ? normalizeNotificationSettings(
          user.notificationPreference.settings as unknown as NotificationSettings
        )
      : buildSettingsFromUser(user)

    if (!isEventEnabled(settings, event)) {
      continue
    }

    const matrixItem =
      settings.matrix.find((item) => item.event === event) || matrixDefaults.get(event)
    if (!matrixItem) continue

    const priority = priorityMap[matrixItem.priority] || 'NORMAL'
    const quietHoursActive =
      settings.quietHoursEnabled &&
      isWithinQuietHours(now, settings.quietHoursStart, settings.quietHoursEnd)

    if (dedupeSince && baseDedupeKey) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: user.id,
          dedupeKey: baseDedupeKey,
          createdAt: { gte: dedupeSince },
        },
        select: { id: true },
      })
      if (existing) {
        continue
      }
    }

    const channelFlags: Record<NotificationChannel, boolean> = {
      IN_APP: settings.inAppNotifications && matrixItem.channels.inApp,
      EMAIL: settings.emailNotifications && matrixItem.channels.email,
      TELEGRAM: settings.telegramNotifications && matrixItem.channels.telegram,
      SMS: settings.smsNotifications && matrixItem.channels.sms,
      PUSH: settings.pushNotifications && matrixItem.channels.push,
    }

    const hasAnyChannel = Object.values(channelFlags).some(Boolean)
    if (!hasAnyChannel) continue

    const data = {
      userId: user.id,
      letterId: letterId || undefined,
      actorId: actorId || undefined,
      type: event,
      title,
      body: body || undefined,
      priority,
      dedupeKey: baseDedupeKey,
      metadata: metadata ? (metadata as unknown as Prisma.InputJsonValue) : undefined,
    }

    let notification: { id: string }

    try {
      notification = await prisma.notification.create({ data })
    } catch (error) {
      if (!isMissingNotificationActorColumn(error)) {
        throw error
      }

      const { actorId: _actorId, ...fallbackData } = data
      notification = await prisma.notification.create({ data: fallbackData })
    }

    const messageText = buildMessage(title, body)
    const shouldMute =
      quietHoursActive && settings.quietMode === 'important' && !isImportantEvent(event, priority)

    const createDelivery = async (data: {
      channel: NotificationChannel
      status: 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED'
      recipient?: string | null
      error?: string | null
    }) => {
      await prisma.notificationDelivery.create({
        data: {
          notificationId: notification.id,
          userId: user.id,
          channel: data.channel,
          status: data.status,
          recipient: data.recipient || undefined,
          error: data.error || undefined,
          sentAt: data.status === 'SENT' ? new Date() : undefined,
        },
      })
    }

    if (channelFlags.IN_APP) {
      await createDelivery({ channel: 'IN_APP', status: 'SENT', recipient: user.id })
    }

    if (channelFlags.EMAIL) {
      if (shouldMute) {
        await createDelivery({
          channel: 'EMAIL',
          status: 'SKIPPED',
          recipient: user.email,
          error: 'quiet_hours',
        })
      } else if (!user.email) {
        await createDelivery({ channel: 'EMAIL', status: 'SKIPPED', error: 'missing_email' })
      } else {
        const success = await sendEmail(user.email, title, messageText)
        await createDelivery({
          channel: 'EMAIL',
          status: success ? 'SENT' : 'FAILED',
          recipient: user.email,
          error: success ? null : 'send_failed',
        })
      }
    }

    if (channelFlags.TELEGRAM) {
      if (shouldMute) {
        await createDelivery({
          channel: 'TELEGRAM',
          status: 'SKIPPED',
          recipient: user.telegramChatId,
          error: 'quiet_hours',
        })
      } else if (!user.telegramChatId) {
        await createDelivery({ channel: 'TELEGRAM', status: 'SKIPPED', error: 'missing_telegram' })
      } else {
        const success = await sendTelegramMessage(user.telegramChatId, messageText)
        await createDelivery({
          channel: 'TELEGRAM',
          status: success ? 'SENT' : 'FAILED',
          recipient: user.telegramChatId,
          error: success ? null : 'send_failed',
        })
      }
    }

    if (channelFlags.SMS) {
      const phone = user.profile?.phone
      if (shouldMute) {
        await createDelivery({
          channel: 'SMS',
          status: 'SKIPPED',
          recipient: phone,
          error: 'quiet_hours',
        })
      } else if (!phone) {
        await createDelivery({ channel: 'SMS', status: 'SKIPPED', error: 'missing_phone' })
      } else {
        const success = await sendSms(phone, messageText)
        await createDelivery({
          channel: 'SMS',
          status: success ? 'SENT' : 'FAILED',
          recipient: phone,
          error: success ? null : 'send_failed',
        })
      }
    }

    if (channelFlags.PUSH) {
      await createDelivery({ channel: 'PUSH', status: 'SKIPPED', error: 'push_not_supported' })
    }
  }
}

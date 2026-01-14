import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger.server'
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  normalizeNotificationSettings,
  NotificationSettings,
} from '@/lib/notification-settings'
import type { DigestFrequency, Role, Prisma } from '@prisma/client'

const eventEnum = z.enum([
  'NEW_LETTER',
  'COMMENT',
  'STATUS',
  'ASSIGNMENT',
  'DEADLINE_URGENT',
  'DEADLINE_OVERDUE',
  'SYSTEM',
])

const priorityEnum = z.enum(['low', 'normal', 'high', 'critical'])

const channelSchema = z.object({
  inApp: z.boolean(),
  email: z.boolean(),
  telegram: z.boolean(),
  sms: z.boolean(),
  push: z.boolean(),
})

const matrixSchema = z.array(
  z.object({
    event: eventEnum,
    channels: channelSchema,
    priority: priorityEnum,
  })
)

const subscriptionSchema = z.object({
  event: z.union([z.literal('ALL'), eventEnum]),
  scope: z.enum(['role', 'user', 'all']),
  value: z.string().optional(),
})

const settingsSchema = z
  .object({
    inAppNotifications: z.boolean(),
    emailNotifications: z.boolean(),
    telegramNotifications: z.boolean(),
    smsNotifications: z.boolean(),
    emailDigest: z.enum(['instant', 'daily', 'weekly', 'never']),
    soundNotifications: z.boolean(),
    pushNotifications: z.boolean(),
    quietHoursEnabled: z.boolean(),
    quietHoursStart: z.string(),
    quietHoursEnd: z.string(),
    quietMode: z.enum(['all', 'important']),
    groupSimilar: z.boolean(),
    showPreviews: z.boolean(),
    showOrganizations: z.boolean(),
    notifyOnNewLetter: z.boolean(),
    notifyOnStatusChange: z.boolean(),
    notifyOnComment: z.boolean(),
    notifyOnAssignment: z.boolean(),
    notifyOnDeadline: z.boolean(),
    notifyOnSystem: z.boolean(),
    matrix: matrixSchema,
    subscriptions: z.array(subscriptionSchema),
  })
  .partial()

const mapDigestFrequency = (digest: NotificationSettings['emailDigest']): DigestFrequency => {
  if (digest === 'daily') return 'DAILY'
  if (digest === 'weekly') return 'WEEKLY'
  return 'NONE'
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

const normalizeSubscriptions = (settings: NotificationSettings) => {
  const validRoles = new Set<Role>([
    'SUPERADMIN',
    'ADMIN',
    'MANAGER',
    'AUDITOR',
    'EMPLOYEE',
    'VIEWER',
  ])
  return settings.subscriptions
    .map((subscription) => ({
      event: subscription.event,
      scope: subscription.scope,
      value: subscription.value?.trim() || null,
    }))
    .filter((subscription) => {
      if (subscription.scope === 'all') return true
      if (!subscription.value) return false
      if (subscription.scope === 'role') return validRoles.has(subscription.value as Role)
      return true
    })
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const preference = await prisma.notificationPreference.findUnique({
      where: { userId: session.user.id },
      select: { settings: true },
    })

    if (preference?.settings) {
      const parsed = settingsSchema.safeParse(preference.settings as unknown)
      if (parsed.success) {
        return NextResponse.json({
          settings: normalizeNotificationSettings(parsed.data),
        })
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        notifyEmail: true,
        notifyTelegram: true,
        notifySms: true,
        notifyInApp: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        digestFrequency: true,
      },
    })

    if (!user) {
      return NextResponse.json({ settings: DEFAULT_NOTIFICATION_SETTINGS })
    }

    return NextResponse.json({ settings: buildSettingsFromUser(user) })
  } catch (error) {
    logger.error('GET /api/notification-settings', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    const body = await request.json()
    const parsed = settingsSchema.safeParse(body?.settings ?? body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 })
    }

    const nextSettings = normalizeNotificationSettings(parsed.data)
    const subscriptions = normalizeSubscriptions(nextSettings)

    await prisma.$transaction([
      prisma.notificationPreference.upsert({
        where: { userId: session.user.id },
        update: { settings: nextSettings as unknown as Prisma.InputJsonValue },
        create: {
          userId: session.user.id,
          settings: nextSettings as unknown as Prisma.InputJsonValue,
        },
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          notifyEmail: nextSettings.emailNotifications,
          notifyTelegram: nextSettings.telegramNotifications,
          notifySms: nextSettings.smsNotifications,
          notifyInApp: nextSettings.inAppNotifications,
          quietHoursStart: nextSettings.quietHoursEnabled ? nextSettings.quietHoursStart : null,
          quietHoursEnd: nextSettings.quietHoursEnabled ? nextSettings.quietHoursEnd : null,
          digestFrequency: mapDigestFrequency(nextSettings.emailDigest),
        },
      }),
      prisma.notificationSubscription.deleteMany({ where: { userId: session.user.id } }),
      ...(subscriptions.length > 0
        ? [
            prisma.notificationSubscription.createMany({
              data: subscriptions.map((subscription) => ({
                userId: session.user.id,
                scope: subscription.scope.toUpperCase() as 'ROLE' | 'USER' | 'ALL',
                value: subscription.value,
                event: subscription.event,
              })),
            }),
          ]
        : []),
    ])

    return NextResponse.json({ settings: nextSettings })
  } catch (error) {
    logger.error('PUT /api/notification-settings', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

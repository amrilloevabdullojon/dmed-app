import webpush from 'web-push'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger.server'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

interface PushNotificationPayload {
  title: string
  body?: string
  icon?: string
  badge?: string
  tag?: string
  data?: {
    url?: string
    priority?: 'low' | 'normal' | 'high'
    [key: string]: unknown
  }
}

export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('VAPID keys not configured, skipping push notification')
    return { sent: 0, failed: 0 }
  }

  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    })

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0 }
    }

    let sent = 0
    let failed = 0

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          const pushSubscription: webpush.PushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          }

          await webpush.sendNotification(pushSubscription, JSON.stringify(payload))
          sent++
        } catch (error) {
          failed++

          if (error && typeof error === 'object' && 'statusCode' in error) {
            const statusCode = (error as { statusCode: number }).statusCode

            if (statusCode === 404 || statusCode === 410) {
              await prisma.pushSubscription.delete({
                where: { id: sub.id },
              }).catch(() => {})
            }
          }

          logger.error('Push', `Failed to send push notification to ${sub.endpoint}`, {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      })
    )

    return { sent, failed }
  } catch (error) {
    logger.error('Push', 'Error sending push notifications', { error })
    return { sent: 0, failed: 0 }
  }
}

export async function sendPushToMany(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
  let totalSent = 0
  let totalFailed = 0

  await Promise.all(
    userIds.map(async (userId) => {
      const result = await sendPushNotification(userId, payload)
      totalSent += result.sent
      totalFailed += result.failed
    })
  )

  return { sent: totalSent, failed: totalFailed }
}

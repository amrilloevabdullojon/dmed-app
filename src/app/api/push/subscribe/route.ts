import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger.server'
import { z } from 'zod'

const subscriptionSchema = z.object({
  endpoint: z.string(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
})

export async function POST(request: NextRequest) {
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
    const result = subscriptionSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid subscription data', details: result.error.errors },
        { status: 400 }
      )
    }

    const subscription = result.data

    await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId: session.user.id,
          endpoint: subscription.endpoint,
        },
      },
      create: {
        userId: session.user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        expirationTime: subscription.expirationTime
          ? new Date(subscription.expirationTime)
          : null,
      },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        expirationTime: subscription.expirationTime
          ? new Date(subscription.expirationTime)
          : null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('POST /api/push/subscribe', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger.server'
import { z } from 'zod'

const unsubscribeSchema = z.object({
  endpoint: z.string(),
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
    const result = unsubscribeSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    await prisma.pushSubscription.deleteMany({
      where: {
        userId: session.user.id,
        endpoint: result.data.endpoint,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('POST /api/push/unsubscribe', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

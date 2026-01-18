import { NextRequest, NextResponse } from 'next/server'
import { sendDailyDigests, sendWeeklyDigests } from '@/lib/cron/email-digest'
import { logger } from '@/lib/logger.server'

const CRON_SECRET = process.env.CRON_SECRET

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'daily'

    let result

    if (type === 'daily') {
      result = await sendDailyDigests()
    } else if (type === 'weekly') {
      result = await sendWeeklyDigests()
    } else {
      return NextResponse.json({ error: 'Invalid digest type' }, { status: 400 })
    }

    logger.info('Cron', `${type} digest sent`, result)

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    logger.error('POST /api/cron/digest', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

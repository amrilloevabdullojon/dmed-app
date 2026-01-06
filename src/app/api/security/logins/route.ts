import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger.server'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 50
const SUMMARY_DAYS = 7

type CursorPayload = {
  id: string
  createdAt: string
}

const decodeCursor = (value: string | null) => {
  if (!value) return null
  try {
    return JSON.parse(Buffer.from(value, 'base64').toString('utf-8')) as CursorPayload
  } catch {
    return null
  }
}

const buildCursor = (payload: CursorPayload) =>
  Buffer.from(JSON.stringify(payload)).toString('base64')

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canView =
      hasPermission(session.user.role, 'VIEW_AUDIT') ||
      hasPermission(session.user.role, 'MANAGE_USERS')
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const search = request.nextUrl.searchParams
    const status = search.get('status')
    const query = search.get('q')?.trim()
    const take = Math.min(Number(search.get('take')) || 20, MAX_TAKE)
    const cursor = decodeCursor(search.get('cursor'))

    const baseFilters: any[] = []

    if (status === 'success') {
      baseFilters.push({ success: true })
    }

    if (status === 'failure') {
      baseFilters.push({ success: false })
    }

    if (query) {
      baseFilters.push({
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { user: { name: { contains: query, mode: 'insensitive' } } },
          { user: { email: { contains: query, mode: 'insensitive' } } },
        ],
      })
    }

    const where: any = {}
    const andFilters = [...baseFilters]

    if (cursor) {
      const cursorDate = new Date(cursor.createdAt)
      andFilters.push({
        OR: [{ createdAt: { lt: cursorDate } }, { createdAt: cursorDate, id: { lt: cursor.id } }],
      })
    }

    if (andFilters.length > 0) {
      where.AND = andFilters
    }

    const events = await prisma.loginAudit.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    const hasMore = events.length > take
    const items = hasMore ? events.slice(0, take) : events
    const last = items[items.length - 1]
    const nextCursor =
      hasMore && last ? buildCursor({ id: last.id, createdAt: last.createdAt.toISOString() }) : null

    const summarySince = new Date()
    summarySince.setDate(summarySince.getDate() - SUMMARY_DAYS)
    const summaryFilters = [...baseFilters, { createdAt: { gte: summarySince } }]
    const summaryWhere: any = summaryFilters.length > 0 ? { AND: summaryFilters } : {}
    const summaryEvents = await prisma.loginAudit.findMany({
      where: summaryWhere,
      select: { createdAt: true, success: true },
      take: 2000,
    })

    const summaryMap = new Map<string, { date: string; success: number; failure: number }>()
    summaryEvents.forEach((event) => {
      const date = event.createdAt.toISOString().slice(0, 10)
      const entry = summaryMap.get(date) || { date, success: 0, failure: 0 }
      if (event.success) {
        entry.success += 1
      } else {
        entry.failure += 1
      }
      summaryMap.set(date, entry)
    })

    const summary = Array.from(summaryMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({ events: items, nextCursor, summary })
  } catch (error) {
    logger.error('GET /api/security/logins', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

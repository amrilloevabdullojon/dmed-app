import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'

// GET /api/users/[id]/audit - audit log for a user
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canViewAudit = hasPermission(session.user.role, 'VIEW_AUDIT') ||
      hasPermission(session.user.role, 'MANAGE_USERS')
    if (!canViewAudit && session.user.id !== params.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const search = request.nextUrl.searchParams
    const action = search.get('action')
    const field = search.get('field')
    const query = search.get('q')
    const actorQuery = search.get('actor')
    const take = Math.min(Number(search.get('take')) || 20, 50)

    let cursor: { id: string; createdAt: string } | null = null
    const cursorParam = search.get('cursor')
    if (cursorParam) {
      try {
        cursor = JSON.parse(Buffer.from(cursorParam, 'base64').toString('utf-8'))
      } catch {
        cursor = null
      }
    }

    const where: any = { userId: params.id }
    const andFilters: any[] = []

    if (action && action !== 'all') {
      andFilters.push({ action })
    }

    if (field && field !== 'all') {
      andFilters.push({ field })
    }

    if (query) {
      andFilters.push({
        OR: [
          { oldValue: { contains: query, mode: 'insensitive' } },
          { newValue: { contains: query, mode: 'insensitive' } },
        ],
      })
    }

    if (actorQuery) {
      andFilters.push({
        actor: {
          OR: [
            { name: { contains: actorQuery, mode: 'insensitive' } },
            { email: { contains: actorQuery, mode: 'insensitive' } },
          ],
        },
      })
    }

    if (cursor) {
      const cursorDate = new Date(cursor.createdAt)
      andFilters.push({
        OR: [
          { createdAt: { lt: cursorDate } },
          { createdAt: cursorDate, id: { lt: cursor.id } },
        ],
      })
    }

    if (andFilters.length > 0) {
      where.AND = andFilters
    }

    const audits = await prisma.userAudit.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    })

    const hasMore = audits.length > take
    const items = hasMore ? audits.slice(0, take) : audits
    const last = items[items.length - 1]
    const nextCursor = hasMore && last
      ? Buffer.from(
          JSON.stringify({ id: last.id, createdAt: last.createdAt })
        ).toString('base64')
      : null

    return NextResponse.json({ audits: items, nextCursor })
  } catch (error) {
    console.error('GET /api/users/[id]/audit error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

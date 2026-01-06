import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!hasPermission(session.user.role, 'VIEW_LETTERS')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const org = searchParams.get('org')
  const exclude = searchParams.get('exclude')
  const limitParam = parseInt(searchParams.get('limit') || '10', 10)
  const limit = Number.isFinite(limitParam) ? Math.min(limitParam, 20) : 10

  if (!org) {
    return NextResponse.json({ error: 'Organization is required' }, { status: 400 })
  }

  try {
    const letters = await prisma.letter.findMany({
      where: {
        org: {
          contains: org,
          mode: 'insensitive',
        },
        ...(exclude && { id: { not: exclude } }),
      },
      select: {
        id: true,
        number: true,
        org: true,
        date: true,
        status: true,
        content: true,
      },
      orderBy: {
        date: 'desc',
      },
      take: limit,
    })

    return NextResponse.json({
      letters: letters.map((letter) => ({
        ...letter,
        date: letter.date.toISOString(),
        content: letter.content ? letter.content.slice(0, 100) : null,
      })),
    })
  } catch (error) {
    logger.error('GET /api/letters/related', error)
    return NextResponse.json({ error: 'Failed to fetch related letters' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger.server'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] })
  }

  try {
    // Get unique organizations matching the query, ordered by frequency
    const organizations = await prisma.letter.groupBy({
      by: ['org'],
      where: {
        org: {
          contains: query,
          mode: 'insensitive',
        },
      },
      _count: {
        org: true,
      },
      orderBy: {
        _count: {
          org: 'desc',
        },
      },
      take: 10,
    })

    const suggestions = organizations.map((org) => ({
      name: org.org,
      count: org._count.org,
    }))

    return NextResponse.json({ suggestions })
  } catch (error) {
    logger.error('GET /api/organizations/suggest', error)
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 })
  }
}

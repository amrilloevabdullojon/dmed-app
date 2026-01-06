import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger.server'

// GET /api/templates - получить все шаблоны (свои + публичные)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')

    const where: any = {
      OR: [{ createdById: session.user.id }, { isPublic: true }],
    }

    if (category) {
      where.category = category
    }

    const templates = await prisma.answerTemplate.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })

    // Получить уникальные категории
    const categories = await prisma.answerTemplate.findMany({
      where: {
        OR: [{ createdById: session.user.id }, { isPublic: true }],
        category: { not: null },
      },
      select: { category: true },
      distinct: ['category'],
    })

    return NextResponse.json({
      templates,
      categories: categories.map((c) => c.category).filter(Boolean),
    })
  } catch (error) {
    logger.error('GET /api/templates', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/templates - создать шаблон
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
    const { name, content, category, isPublic } = body

    if (!name || !content) {
      return NextResponse.json({ error: 'Name and content are required' }, { status: 400 })
    }

    const template = await prisma.answerTemplate.create({
      data: {
        name: name.slice(0, 100),
        content: content.slice(0, 10000),
        category: category?.slice(0, 50) || null,
        isPublic: Boolean(isPublic),
        createdById: session.user.id,
      },
    })

    return NextResponse.json({ success: true, template }, { status: 201 })
  } catch (error) {
    logger.error('POST /api/templates', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

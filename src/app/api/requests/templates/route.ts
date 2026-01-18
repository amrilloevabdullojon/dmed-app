import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger.server'
import { z } from 'zod'
import { RequestCategory } from '@prisma/client'

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1),
  category: z.nativeEnum(RequestCategory).optional().nullable(),
  isPublic: z.boolean().default(false),
})

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  content: z.string().min(1).optional(),
  category: z.nativeEnum(RequestCategory).optional().nullable(),
  isPublic: z.boolean().optional(),
})

// GET /api/requests/templates - список шаблонов
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as RequestCategory | null

    const where: {
      OR?: Array<{ createdById: string } | { isPublic: boolean }>
      category?: RequestCategory
    } = {
      OR: [{ createdById: session.user.id }, { isPublic: true }],
    }

    if (category) {
      where.category = category
    }

    const templates = await prisma.requestResponseTemplate.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ isPublic: 'desc' }, { name: 'asc' }],
    })

    return NextResponse.json({ templates })
  } catch (error) {
    logger.error('GET /api/requests/templates', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/requests/templates - создание шаблона
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
    const result = createTemplateSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      )
    }

    const { name, content, category, isPublic } = result.data

    const template = await prisma.requestResponseTemplate.create({
      data: {
        name,
        content,
        category: category || null,
        isPublic,
        createdById: session.user.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    logger.error('POST /api/requests/templates', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/requests/templates/:id - обновление шаблона
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Template ID required' }, { status: 400 })
    }

    const existing = await prisma.requestResponseTemplate.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    if (existing.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const result = updateTemplateSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      )
    }

    const template = await prisma.requestResponseTemplate.update({
      where: { id },
      data: result.data,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({ template })
  } catch (error) {
    logger.error('PATCH /api/requests/templates', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/requests/templates/:id - удаление шаблона
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Template ID required' }, { status: 400 })
    }

    const existing = await prisma.requestResponseTemplate.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    if (existing.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.requestResponseTemplate.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('DELETE /api/requests/templates', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

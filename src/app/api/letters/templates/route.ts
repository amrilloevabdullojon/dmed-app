import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger.server'
import { requirePermission } from '@/lib/permission-guard'
import { csrfGuard } from '@/lib/security'
import { z } from 'zod'

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Название обязательно').max(200),
  subject: z.string().max(500).optional(),
  body: z.string().min(1, 'Тело шаблона обязательно').max(50000),
  signature: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  variables: z.array(z.string()).default([]),
  isPublic: z.boolean().default(false),
})

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  subject: z.string().max(500).optional().nullable(),
  body: z.string().min(1).max(50000).optional(),
  signature: z.string().max(5000).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  variables: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
})

// GET /api/letters/templates - получить список шаблонов
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionError = requirePermission(session.user.role, 'VIEW_LETTERS')
    if (permissionError) {
      return permissionError
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const whereClause = {
      AND: [
        {
          OR: [
            { createdById: session.user.id },
            { isPublic: true },
          ],
        },
        category ? { category } : {},
      ],
    }

    const templates = await prisma.letterTemplate.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { usageCount: 'desc' },
        { updatedAt: 'desc' },
      ],
    })

    return NextResponse.json({ templates })
  } catch (error) {
    logger.error('GET /api/letters/templates', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/letters/templates - создать шаблон
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    const permissionError = requirePermission(session.user.role, 'MANAGE_LETTERS')
    if (permissionError) {
      return permissionError
    }

    const body = await request.json()
    const validation = createTemplateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Invalid data' },
        { status: 400 }
      )
    }

    const template = await prisma.letterTemplate.create({
      data: {
        ...validation.data,
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

    logger.info('POST /api/letters/templates', 'Template created', {
      templateId: template.id,
      name: template.name,
      createdBy: session.user.id,
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    logger.error('POST /api/letters/templates', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/letters/templates?id=xxx - обновить шаблон
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    const permissionError = requirePermission(session.user.role, 'MANAGE_LETTERS')
    if (permissionError) {
      return permissionError
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 })
    }

    // Проверяем существование и права доступа
    const existing = await prisma.letterTemplate.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Шаблон не найден' }, { status: 404 })
    }

    if (existing.createdById !== session.user.id && session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Нет доступа для редактирования' }, { status: 403 })
    }

    const body = await request.json()
    const validation = updateTemplateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Invalid data' },
        { status: 400 }
      )
    }

    const template = await prisma.letterTemplate.update({
      where: { id },
      data: validation.data,
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

    logger.info('PATCH /api/letters/templates', 'Template updated', {
      templateId: id,
      updatedBy: session.user.id,
    })

    return NextResponse.json({ template })
  } catch (error) {
    logger.error('PATCH /api/letters/templates', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/letters/templates?id=xxx - удалить шаблон
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    const permissionError = requirePermission(session.user.role, 'MANAGE_LETTERS')
    if (permissionError) {
      return permissionError
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 })
    }

    // Проверяем существование и права доступа
    const existing = await prisma.letterTemplate.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Шаблон не найден' }, { status: 404 })
    }

    if (existing.createdById !== session.user.id && session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Нет доступа для удаления' }, { status: 403 })
    }

    await prisma.letterTemplate.delete({
      where: { id },
    })

    logger.info('DELETE /api/letters/templates', 'Template deleted', {
      templateId: id,
      deletedBy: session.user.id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('DELETE /api/letters/templates', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

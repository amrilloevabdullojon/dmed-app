import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger.server'

// GET /api/templates/[id] - получить шаблон
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const template = await prisma.answerTemplate.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Проверить доступ
    if (!template.isPublic && template.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(template)
  } catch (error) {
    logger.error('GET /api/templates/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/templates/[id] - обновить шаблон
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    const { id } = await params

    const template = await prisma.answerTemplate.findUnique({
      where: { id },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Только создатель может редактировать
    if (template.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, content, category, isPublic } = body

    const updated = await prisma.answerTemplate.update({
      where: { id },
      data: {
        ...(name && { name: name.slice(0, 100) }),
        ...(content && { content: content.slice(0, 10000) }),
        ...(category !== undefined && { category: category?.slice(0, 50) || null }),
        ...(isPublic !== undefined && { isPublic: Boolean(isPublic) }),
      },
    })

    return NextResponse.json({ success: true, template: updated })
  } catch (error) {
    logger.error('PATCH /api/templates/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/templates/[id] - удалить шаблон
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    const { id } = await params

    const template = await prisma.answerTemplate.findUnique({
      where: { id },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Только создатель или админ может удалять
    if (
      template.createdById !== session.user.id &&
      session.user.role !== 'ADMIN' &&
      session.user.role !== 'SUPERADMIN'
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.answerTemplate.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('DELETE /api/templates/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

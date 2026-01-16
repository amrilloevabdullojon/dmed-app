import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger.server'
import { requirePermission } from '@/lib/permission-guard'

// POST /api/letters/templates/[id]/use - отметить использование шаблона
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionError = requirePermission(session.user.role, 'MANAGE_LETTERS')
    if (permissionError) {
      return permissionError
    }

    const template = await prisma.letterTemplate.findUnique({
      where: { id },
      select: { id: true, createdById: true, isPublic: true },
    })

    if (!template) {
      return NextResponse.json({ error: 'Шаблон не найден' }, { status: 404 })
    }

    // Проверяем доступ
    if (!template.isPublic && template.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Нет доступа к шаблону' }, { status: 403 })
    }

    // Увеличиваем счётчик использований
    await prisma.letterTemplate.update({
      where: { id },
      data: {
        usageCount: {
          increment: 1,
        },
      },
    })

    logger.info('POST /api/letters/templates/[id]/use', 'Template usage incremented', {
      templateId: id,
      userId: session.user.id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('POST /api/letters/templates/[id]/use', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

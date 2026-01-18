import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger.server'
import { z } from 'zod'

const updateTagsSchema = z.object({
  tagIds: z.array(z.string()),
})

// PUT /api/requests/:id/tags - обновить теги заявки
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    const requestId = id

    const existingRequest = await prisma.request.findUnique({
      where: { id: requestId },
    })

    if (!existingRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    const body = await request.json()
    const result = updateTagsSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      )
    }

    const { tagIds } = result.data

    // Обновляем связи с тегами
    await prisma.request.update({
      where: { id: requestId },
      data: {
        tags: {
          set: tagIds.map((id) => ({ id })),
        },
      },
    })

    // Получаем обновленный запрос с тегами
    const updatedRequest = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        tags: true,
      },
    })

    return NextResponse.json({ request: updatedRequest })
  } catch (error) {
    logger.error('PUT /api/requests/:id/tags', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

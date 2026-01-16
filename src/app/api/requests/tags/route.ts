import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger.server'
import { z } from 'zod'

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#6B7280'),
})

const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

// GET /api/requests/tags - список тегов
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tags = await prisma.requestTag.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { requests: true },
        },
      },
    })

    return NextResponse.json({ tags })
  } catch (error) {
    logger.error('GET /api/requests/tags', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/requests/tags - создание тега
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
    const result = createTagSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      )
    }

    const { name, color } = result.data

    // Проверка уникальности
    const existing = await prisma.requestTag.findUnique({
      where: { name },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Тег с таким названием уже существует' },
        { status: 400 }
      )
    }

    const tag = await prisma.requestTag.create({
      data: { name, color },
      include: {
        _count: {
          select: { requests: true },
        },
      },
    })

    return NextResponse.json({ tag }, { status: 201 })
  } catch (error) {
    logger.error('POST /api/requests/tags', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/requests/tags/:id - обновление тега
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
      return NextResponse.json({ error: 'Tag ID required' }, { status: 400 })
    }

    const existing = await prisma.requestTag.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    const body = await request.json()
    const result = updateTagSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      )
    }

    // Проверка уникальности имени
    if (result.data.name && result.data.name !== existing.name) {
      const duplicate = await prisma.requestTag.findUnique({
        where: { name: result.data.name },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: 'Тег с таким названием уже существует' },
          { status: 400 }
        )
      }
    }

    const tag = await prisma.requestTag.update({
      where: { id },
      data: result.data,
      include: {
        _count: {
          select: { requests: true },
        },
      },
    })

    return NextResponse.json({ tag })
  } catch (error) {
    logger.error('PATCH /api/requests/tags', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/requests/tags/:id - удаление тега
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
      return NextResponse.json({ error: 'Tag ID required' }, { status: 400 })
    }

    const existing = await prisma.requestTag.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    await prisma.requestTag.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('DELETE /api/requests/tags', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

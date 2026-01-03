import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { idParamSchema, updateRequestSchema } from '@/lib/schemas'
import type { Prisma } from '@prisma/client'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paramResult = idParamSchema.safeParse(params)
    if (!paramResult.success) {
      return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 })
    }

    const requestRecord = await prisma.request.findUnique({
      where: { id: params.id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        files: true,
      },
    })

    if (!requestRecord) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    return NextResponse.json({ request: requestRecord })
  } catch (error) {
    console.error('GET /api/requests/[id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paramResult = idParamSchema.safeParse(params)
    if (!paramResult.success) {
      return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = updateRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid request data.' },
        { status: 400 }
      )
    }

    const updateData: Prisma.RequestUpdateInput = {}
    if (parsed.data.status) {
      updateData.status = parsed.data.status
    }

    if (parsed.data.assignedToId !== undefined) {
      updateData.assignedToId = parsed.data.assignedToId || null
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No updates provided.' }, { status: 400 })
    }

    const updated = await prisma.request.update({
      where: { id: params.id },
      data: updateData,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        files: true,
      },
    })

    return NextResponse.json({ success: true, request: updated })
  } catch (error) {
    console.error('PATCH /api/requests/[id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

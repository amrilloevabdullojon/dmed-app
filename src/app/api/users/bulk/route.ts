import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const bulkSchema = z.object({
  ids: z.array(z.string()).min(1),
  action: z.enum(['role', 'canLogin', 'delete']),
  value: z.any().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = bulkSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const { ids, action, value } = parsed.data

    if (action === 'delete') {
      if (ids.includes(session.user.id)) {
        return NextResponse.json(
          { error: 'Cannot delete yourself' },
          { status: 400 }
        )
      }

      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN' },
      })
      const adminsToDelete = await prisma.user.count({
        where: { id: { in: ids }, role: 'ADMIN' },
      })
      if (adminCount - adminsToDelete <= 0) {
        return NextResponse.json(
          { error: 'Cannot delete the last admin' },
          { status: 400 }
        )
      }

      const result = await prisma.user.deleteMany({
        where: { id: { in: ids } },
      })
      return NextResponse.json({ success: true, deleted: result.count })
    }

    if (action === 'role') {
      const role = value === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE'

      if (role === 'EMPLOYEE') {
        const adminCount = await prisma.user.count({
          where: { role: 'ADMIN' },
        })
        const adminsToDemote = await prisma.user.count({
          where: { id: { in: ids }, role: 'ADMIN' },
        })
        if (adminCount - adminsToDemote <= 0) {
          return NextResponse.json(
            { error: 'At least one admin is required' },
            { status: 400 }
          )
        }
      }

      const result = await prisma.user.updateMany({
        where: { id: { in: ids } },
        data: { role },
      })
      return NextResponse.json({ success: true, updated: result.count })
    }

    if (action === 'canLogin') {
      const canLogin = value === true || value === 'true' || value === 'enable'
      const result = await prisma.user.updateMany({
        where: { id: { in: ids } },
        data: { canLogin },
      })
      return NextResponse.json({ success: true, updated: result.count })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/users/bulk error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger.server'

export const dynamic = 'force-dynamic'

// GET /api/users/approvals - list pending admin approvals
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const approvals = await prisma.adminApproval.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        targetUser: {
          select: { id: true, name: true, email: true, role: true },
        },
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json({ approvals })
  } catch (error) {
    logger.error('GET /api/users/approvals', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

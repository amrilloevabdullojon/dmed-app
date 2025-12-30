import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'

const emptyProfile = {
  bio: null,
  phone: null,
  position: null,
  department: null,
  location: null,
  timezone: null,
  skills: [] as string[],
  publicEmail: false,
  publicPhone: false,
  visibility: 'INTERNAL' as const,
}

// GET /api/users/[id]/profile - view user profile
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        lastLoginAt: true,
        _count: {
          select: {
            letters: true,
            comments: true,
            sessions: true,
          },
        },
        profile: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const profile = user.profile ?? emptyProfile
    const isSelf = session.user.id === user.id
    const isPrivileged = hasPermission(session.user.role, 'MANAGE_USERS')

    if (profile.visibility === 'PRIVATE' && !isSelf && !isPrivileged) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const canShowEmail = isSelf || isPrivileged || profile.publicEmail
    const canShowPhone = isSelf || isPrivileged || profile.publicPhone

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: canShowEmail ? user.email : null,
        image: user.image,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
        _count: user._count,
      },
      profile: {
        ...profile,
        phone: canShowPhone ? profile.phone : null,
      },
    })
  } catch (error) {
    console.error('GET /api/users/[id]/profile error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

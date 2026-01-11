import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { resolveProfileAssetUrl } from '@/lib/profile-assets'
import { logger } from '@/lib/logger.server'

const emptyProfile = {
  bio: null,
  phone: null,
  position: null,
  department: null,
  location: null,
  timezone: null,
  skills: [] as string[],
  avatarUrl: null,
  coverUrl: null,
  publicEmail: false,
  publicPhone: false,
  publicBio: true,
  publicPosition: true,
  publicDepartment: true,
  publicLocation: true,
  publicTimezone: true,
  publicSkills: true,
  publicLastLogin: false,
  publicProfileEnabled: false,
  publicProfileToken: null,
  visibility: 'INTERNAL' as const,
}

const buildActivity = async (userId: string) => {
  const [letters, comments, assignments] = await Promise.all([
    prisma.letter.findMany({
      where: { ownerId: userId, deletedAt: null },
      select: {
        id: true,
        number: true,
        org: true,
        status: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.comment.findMany({
      where: { authorId: userId },
      select: {
        id: true,
        text: true,
        createdAt: true,
        letter: {
          select: { id: true, number: true, org: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.history.findMany({
      where: { field: 'owner', newValue: userId },
      select: {
        id: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        letter: { select: { id: true, number: true, org: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  return { letters, comments, assignments }
}

// GET /api/users/[id]/profile - view user profile
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id },
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
    const profileUpdatedAt = user.profile?.updatedAt ?? null
    const isSelf = session.user.id === user.id
    const isPrivileged = hasPermission(session.user.role, 'MANAGE_USERS')

    if (profile.visibility === 'PRIVATE' && !isSelf && !isPrivileged) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const canViewAll = isSelf || isPrivileged
    const canShowEmail = canViewAll || profile.publicEmail
    const canShowPhone = canViewAll || profile.publicPhone
    const canShowLastLogin = canViewAll || profile.publicLastLogin

    const allowField = (flag: boolean | null | undefined) => (canViewAll ? true : flag === true)

    const filteredProfile = {
      ...profile,
      bio: allowField(profile.publicBio) ? profile.bio : null,
      position: allowField(profile.publicPosition) ? profile.position : null,
      department: allowField(profile.publicDepartment) ? profile.department : null,
      location: allowField(profile.publicLocation) ? profile.location : null,
      timezone: allowField(profile.publicTimezone) ? profile.timezone : null,
      skills: allowField(profile.publicSkills) ? profile.skills : [],
      phone: canShowPhone ? profile.phone : null,
      publicProfileToken: canViewAll ? profile.publicProfileToken : null,
    }
    const normalizedProfile = {
      ...filteredProfile,
      avatarUrl: resolveProfileAssetUrl(filteredProfile.avatarUrl, profileUpdatedAt),
      coverUrl: resolveProfileAssetUrl(filteredProfile.coverUrl, profileUpdatedAt),
    }

    const activity = await buildActivity(user.id)

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: canShowEmail ? user.email : null,
        image: user.image,
        role: user.role,
        lastLoginAt: canShowLastLogin ? user.lastLoginAt : null,
        _count: user._count,
      },
      profile: normalizedProfile,
      activity,
    })
  } catch (error) {
    logger.error('GET /api/users/[id]/profile', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

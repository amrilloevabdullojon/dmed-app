import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { randomUUID } from 'crypto'
import { resolveProfileAssetUrl } from '@/lib/profile-assets'

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

const normalizeOptional = (value: unknown) => {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

const parseSkills = (value: unknown) => {
  if (!value) return []
  const raw = Array.isArray(value) ? value : String(value).split(',')
  const unique = new Set(
    raw
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0)
  )
  return Array.from(unique)
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

// GET /api/profile - current user profile
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
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

    const activity = await buildActivity(user.id)

    const profile = user.profile ?? emptyProfile
    const profileUpdatedAt = user.profile?.updatedAt ?? null
    const normalizedProfile = {
      ...profile,
      avatarUrl: resolveProfileAssetUrl(profile.avatarUrl, profileUpdatedAt),
      coverUrl: resolveProfileAssetUrl(profile.coverUrl, profileUpdatedAt),
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
        _count: user._count,
      },
      profile: normalizedProfile,
      activity,
    })
  } catch (error) {
    console.error('GET /api/profile error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/profile - update current user profile
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data: {
      bio?: string | null
      phone?: string | null
      position?: string | null
      department?: string | null
      location?: string | null
      timezone?: string | null
      skills?: string[]
      avatarUrl?: string | null
      coverUrl?: string | null
      publicEmail?: boolean
      publicPhone?: boolean
      publicBio?: boolean
      publicPosition?: boolean
      publicDepartment?: boolean
      publicLocation?: boolean
      publicTimezone?: boolean
      publicSkills?: boolean
      publicLastLogin?: boolean
      publicProfileEnabled?: boolean
      publicProfileToken?: string | null
      visibility?: 'INTERNAL' | 'PRIVATE'
    } = {}

    if ('bio' in body) data.bio = normalizeOptional(body.bio)
    if ('phone' in body) data.phone = normalizeOptional(body.phone)
    if ('position' in body) data.position = normalizeOptional(body.position)
    if ('department' in body) data.department = normalizeOptional(body.department)
    if ('location' in body) data.location = normalizeOptional(body.location)
    if ('timezone' in body) data.timezone = normalizeOptional(body.timezone)
    if ('skills' in body) data.skills = parseSkills(body.skills)
    if ('avatarUrl' in body) data.avatarUrl = normalizeOptional(body.avatarUrl)
    if ('coverUrl' in body) data.coverUrl = normalizeOptional(body.coverUrl)

    if (typeof body.publicEmail === 'boolean') data.publicEmail = body.publicEmail
    if (typeof body.publicPhone === 'boolean') data.publicPhone = body.publicPhone
    if (typeof body.publicBio === 'boolean') data.publicBio = body.publicBio
    if (typeof body.publicPosition === 'boolean') data.publicPosition = body.publicPosition
    if (typeof body.publicDepartment === 'boolean') data.publicDepartment = body.publicDepartment
    if (typeof body.publicLocation === 'boolean') data.publicLocation = body.publicLocation
    if (typeof body.publicTimezone === 'boolean') data.publicTimezone = body.publicTimezone
    if (typeof body.publicSkills === 'boolean') data.publicSkills = body.publicSkills
    if (typeof body.publicLastLogin === 'boolean') {
      data.publicLastLogin = body.publicLastLogin
    }
    if (typeof body.publicProfileEnabled === 'boolean') {
      data.publicProfileEnabled = body.publicProfileEnabled
    }
    if (body.visibility === 'INTERNAL' || body.visibility === 'PRIVATE') {
      data.visibility = body.visibility
    }

    if (body.rotatePublicToken === true) {
      data.publicProfileToken = randomUUID()
      data.publicProfileEnabled = true
    }

    const profile = await prisma.userProfile.upsert({
      where: { userId: session.user.id },
      update: data,
      create: {
        userId: session.user.id,
        ...emptyProfile,
        ...data,
        publicProfileToken:
          data.publicProfileToken || (data.publicProfileEnabled ? randomUUID() : null),
      },
    })

    if (data.publicProfileEnabled && !profile.publicProfileToken) {
      const updated = await prisma.userProfile.update({
        where: { id: profile.id },
        data: { publicProfileToken: randomUUID() },
      })
      return NextResponse.json({ success: true, profile: updated })
    }

    return NextResponse.json({ success: true, profile })
  } catch (error) {
    console.error('PATCH /api/profile error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

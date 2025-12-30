import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

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
      profile: user.profile ?? emptyProfile,
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
      publicEmail?: boolean
      publicPhone?: boolean
      visibility?: 'INTERNAL' | 'PRIVATE'
    } = {}

    if ('bio' in body) data.bio = normalizeOptional(body.bio)
    if ('phone' in body) data.phone = normalizeOptional(body.phone)
    if ('position' in body) data.position = normalizeOptional(body.position)
    if ('department' in body) data.department = normalizeOptional(body.department)
    if ('location' in body) data.location = normalizeOptional(body.location)
    if ('timezone' in body) data.timezone = normalizeOptional(body.timezone)
    if ('skills' in body) data.skills = parseSkills(body.skills)

    if (typeof body.publicEmail === 'boolean') data.publicEmail = body.publicEmail
    if (typeof body.publicPhone === 'boolean') data.publicPhone = body.publicPhone
    if (body.visibility === 'INTERNAL' || body.visibility === 'PRIVATE') {
      data.visibility = body.visibility
    }

    const profile = await prisma.userProfile.upsert({
      where: { userId: session.user.id },
      update: data,
      create: {
        userId: session.user.id,
        ...emptyProfile,
        ...data,
      },
    })

    return NextResponse.json({ success: true, profile })
  } catch (error) {
    console.error('PATCH /api/profile error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

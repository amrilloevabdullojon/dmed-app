import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { resolveProfileAssetUrl } from '@/lib/profile-assets'

// GET /api/users - получить всех пользователей
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user.role, 'MANAGE_USERS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        canLogin: true,
        telegramChatId: true,
        createdAt: true,
        lastLoginAt: true,
        notifyEmail: true,
        notifyTelegram: true,
        notifySms: true,
        notifyInApp: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        digestFrequency: true,
        _count: {
          select: {
            letters: true,
            comments: true,
            sessions: true,
          },
        },
        profile: {
          select: {
            avatarUrl: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const normalizedUsers = users.map((user) => ({
      ...user,
      image:
        resolveProfileAssetUrl(user.profile?.avatarUrl ?? null, user.profile?.updatedAt ?? null) ||
        user.image,
      profile: undefined,
    }))

    return NextResponse.json({ users: normalizedUsers })
  } catch (error) {
    console.error('GET /api/users error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/users - создать пользователя (только админ)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user.role, 'MANAGE_USERS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const isSuperAdmin = session.user.role === 'SUPERADMIN'
    const requestedRole =
      body.role === 'SUPERADMIN'
        ? 'SUPERADMIN'
        : body.role === 'ADMIN'
          ? 'ADMIN'
          : body.role === 'MANAGER'
            ? 'MANAGER'
            : body.role === 'AUDITOR'
              ? 'AUDITOR'
              : body.role === 'VIEWER'
                ? 'VIEWER'
                : 'EMPLOYEE'
    if (!isSuperAdmin && body.role && requestedRole !== 'EMPLOYEE') {
      return NextResponse.json({ error: 'Only superadmin can assign roles' }, { status: 403 })
    }
    const role = isSuperAdmin ? requestedRole : 'EMPLOYEE'
    const telegramChatId =
      typeof body.telegramChatId === 'string' && body.telegramChatId.trim()
        ? body.telegramChatId.trim()
        : null
    const canLogin = body.canLogin === false ? false : true

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }

    const user = await prisma.user.create({
      data: {
        name: name || null,
        email,
        role,
        telegramChatId,
        canLogin,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        canLogin: true,
        telegramChatId: true,
        createdAt: true,
        lastLoginAt: true,
        notifyEmail: true,
        notifyTelegram: true,
        notifySms: true,
        notifyInApp: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        digestFrequency: true,
        _count: {
          select: {
            letters: true,
            comments: true,
            sessions: true,
          },
        },
      },
    })

    await prisma.userAudit.create({
      data: {
        userId: user.id,
        actorId: session.user.id,
        action: 'CREATE',
        newValue: JSON.stringify({
          name: user.name,
          email: user.email,
          role: user.role,
          canLogin: user.canLogin,
          telegramChatId: user.telegramChatId,
          notifyEmail: user.notifyEmail,
          notifyTelegram: user.notifyTelegram,
          notifySms: user.notifySms,
          notifyInApp: user.notifyInApp,
          quietHoursStart: user.quietHoursStart,
          quietHoursEnd: user.quietHoursEnd,
          digestFrequency: user.digestFrequency,
        }),
      },
    })

    return NextResponse.json({ success: true, user }, { status: 201 })
  } catch (error) {
    console.error('POST /api/users error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

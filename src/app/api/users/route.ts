import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { requirePermission } from '@/lib/permission-guard'
import { resolveProfileAssetUrl } from '@/lib/profile-assets'
import { logger } from '@/lib/logger.server'
import { csrfGuard } from '@/lib/security'
import { createUserSchema, usersQuerySchema } from '@/lib/schemas'
import { USER_ROLES } from '@/lib/constants'

const CONTEXT = 'API:Users'

// GET /api/users - получить всех пользователей с пагинацией
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionError = requirePermission(session.user.role, 'MANAGE_USERS')
    if (permissionError) {
      return permissionError
    }

    // Парсим и валидируем query параметры
    const searchParams = Object.fromEntries(request.nextUrl.searchParams)
    const queryResult = usersQuerySchema.safeParse(searchParams)

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      )
    }

    const { page, limit, search } = queryResult.data
    const skip = (page - 1) * limit

    // Формируем условие поиска
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    // Выполняем запросы параллельно
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
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
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    const normalizedUsers = users.map((user) => ({
      ...user,
      image:
        resolveProfileAssetUrl(user.profile?.avatarUrl ?? null, user.profile?.updatedAt ?? null) ||
        user.image,
      profile: undefined,
    }))

    return NextResponse.json({
      users: normalizedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    logger.error(CONTEXT, error, { method: 'GET' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/users - создать пользователя (только админ)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionError = requirePermission(session.user.role, 'MANAGE_USERS')
    if (permissionError) {
      return permissionError
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    const body = await request.json()

    // Валидация через Zod
    const parseResult = createUserSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { name, email, role: requestedRole, canLogin, telegramChatId } = parseResult.data
    const normalizedEmail = email.toLowerCase()

    // Проверка прав на назначение роли
    const isSuperAdmin = session.user.role === 'SUPERADMIN'
    const validRoles = Object.keys(USER_ROLES) as Array<keyof typeof USER_ROLES>

    let role: keyof typeof USER_ROLES = 'EMPLOYEE'
    if (requestedRole && validRoles.includes(requestedRole)) {
      if (!isSuperAdmin && requestedRole !== 'EMPLOYEE') {
        return NextResponse.json({ error: 'Only superadmin can assign roles' }, { status: 403 })
      }
      role = requestedRole
    }

    // Проверка на существующего пользователя
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }

    const user = await prisma.user.create({
      data: {
        name: name || null,
        email: normalizedEmail,
        role,
        telegramChatId: telegramChatId || null,
        canLogin: canLogin ?? true,
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

    logger.info(CONTEXT, 'User created', { userId: user.id, actorId: session.user.id })

    return NextResponse.json({ success: true, user }, { status: 201 })
  } catch (error) {
    logger.error(CONTEXT, error, { method: 'POST' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

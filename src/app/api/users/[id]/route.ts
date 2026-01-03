import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { resolveProfileAssetUrl } from '@/lib/profile-assets'
import { logger } from '@/lib/logger'
import { updateUserSchema, idParamSchema } from '@/lib/schemas'
import { USER_ROLES } from '@/lib/constants'
import type { Role } from '@prisma/client'

const CONTEXT = 'API:Users:[id]'

// GET /api/users/[id] - получить пользователя по ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paramResult = idParamSchema.safeParse({ id: params.id })
    if (!paramResult.success) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    if (
      !hasPermission(session.user.role, 'MANAGE_USERS') &&
      session.user.id !== params.id
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
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
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const normalizedUser = {
      ...user,
      image:
        resolveProfileAssetUrl(user.profile?.avatarUrl ?? null, user.profile?.updatedAt ?? null) ||
        user.image,
      profile: undefined,
    }

    return NextResponse.json(normalizedUser)
  } catch (error) {
    logger.error(CONTEXT, error, { method: 'GET', userId: params.id })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/users/[id] - обновить пользователя (только админ)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Только админ может редактировать пользователей
    if (!hasPermission(session.user.role, 'MANAGE_USERS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const paramResult = idParamSchema.safeParse({ id: params.id })
    if (!paramResult.success) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const body = await request.json()

    // Валидация тела запроса через Zod
    const parseResult = updateUserSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const validatedData = parseResult.data
    const isSuperAdmin = session.user.role === 'SUPERADMIN'

    const currentUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        canLogin: true,
        telegramChatId: true,
        notifyEmail: true,
        notifyTelegram: true,
        notifySms: true,
        notifyInApp: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        digestFrequency: true,
        tokenVersion: true,
      },
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updateData: Partial<{
      role: Role
      name: string | null
      telegramChatId: string | null
      canLogin: boolean
      notifyEmail: boolean
      notifyTelegram: boolean
      notifySms: boolean
      notifyInApp: boolean
      quietHoursStart: string | null
      quietHoursEnd: string | null
      digestFrequency: 'NONE' | 'DAILY' | 'WEEKLY'
      tokenVersion: number
    }> = {}

    // Обработка смены роли
    const validRoles = Object.keys(USER_ROLES) as Role[]
    const requestedRole = validatedData.role

    if (requestedRole && validRoles.includes(requestedRole)) {
      if (requestedRole !== currentUser.role && !isSuperAdmin) {
        return NextResponse.json({ error: 'Only superadmin can change roles' }, { status: 403 })
      }

      if (requestedRole !== currentUser.role) {
        // Проверка на последнего админа/суперадмина
        if (currentUser.role === 'ADMIN' && requestedRole !== 'ADMIN') {
          const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } })
          if (adminCount <= 1) {
            return NextResponse.json(
              { error: 'At least one admin is required' },
              { status: 400 }
            )
          }
        }

        if (currentUser.role === 'SUPERADMIN' && requestedRole !== 'SUPERADMIN') {
          const superAdminCount = await prisma.user.count({ where: { role: 'SUPERADMIN' } })
          if (superAdminCount <= 1) {
            return NextResponse.json(
              { error: 'At least one superadmin is required' },
              { status: 400 }
            )
          }
        }

        updateData.role = requestedRole
        // Инкрементируем tokenVersion для инвалидации JWT при смене роли
        updateData.tokenVersion = currentUser.tokenVersion + 1
      }
    }

    // Обработка остальных полей
    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name || null
    }

    if (validatedData.telegramChatId !== undefined) {
      updateData.telegramChatId = validatedData.telegramChatId || null
    }

    if (validatedData.canLogin !== undefined) {
      updateData.canLogin = validatedData.canLogin
      // Также инвалидируем токен при отключении доступа
      if (!validatedData.canLogin && currentUser.canLogin) {
        updateData.tokenVersion = (updateData.tokenVersion ?? currentUser.tokenVersion) + 1
      }
    }

    if (validatedData.notifyEmail !== undefined) {
      updateData.notifyEmail = validatedData.notifyEmail
    }

    if (validatedData.notifyTelegram !== undefined) {
      updateData.notifyTelegram = validatedData.notifyTelegram
    }

    if (validatedData.notifySms !== undefined) {
      updateData.notifySms = validatedData.notifySms
    }

    if (validatedData.notifyInApp !== undefined) {
      updateData.notifyInApp = validatedData.notifyInApp
    }

    if (validatedData.quietHoursStart !== undefined) {
      updateData.quietHoursStart = validatedData.quietHoursStart
    }

    if (validatedData.quietHoursEnd !== undefined) {
      updateData.quietHoursEnd = validatedData.quietHoursEnd
    }

    if (validatedData.digestFrequency !== undefined) {
      updateData.digestFrequency = validatedData.digestFrequency
    }

    let user = { ...currentUser }

    if (Object.keys(updateData).length > 0) {
      user = await prisma.user.update({
        where: { id: params.id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          canLogin: true,
          telegramChatId: true,
          lastLoginAt: true,
          notifyEmail: true,
          notifyTelegram: true,
          notifySms: true,
          notifyInApp: true,
          quietHoursStart: true,
          quietHoursEnd: true,
          digestFrequency: true,
          tokenVersion: true,
        },
      })
    }

    // Создаём записи аудита
    const auditEntries: Array<{
      userId: string
      actorId: string
      action: string
      field: string
      oldValue: string | null
      newValue: string | null
    }> = []

    const normalizeValue = (value: string | boolean | number | null | undefined) =>
      value === null || value === undefined ? null : String(value)

    const fieldsToAudit: Array<{
      field: string
      action: string
      oldValue: unknown
      newValue: unknown
    }> = [
      { field: 'name', action: 'UPDATE', oldValue: currentUser.name, newValue: user.name },
      { field: 'role', action: 'ROLE', oldValue: currentUser.role, newValue: user.role },
      { field: 'canLogin', action: 'ACCESS', oldValue: currentUser.canLogin, newValue: user.canLogin },
      { field: 'telegramChatId', action: 'UPDATE', oldValue: currentUser.telegramChatId, newValue: user.telegramChatId },
      { field: 'notifyEmail', action: 'UPDATE', oldValue: currentUser.notifyEmail, newValue: user.notifyEmail },
      { field: 'notifyTelegram', action: 'UPDATE', oldValue: currentUser.notifyTelegram, newValue: user.notifyTelegram },
      { field: 'notifySms', action: 'UPDATE', oldValue: currentUser.notifySms, newValue: user.notifySms },
      { field: 'notifyInApp', action: 'UPDATE', oldValue: currentUser.notifyInApp, newValue: user.notifyInApp },
      { field: 'quietHoursStart', action: 'UPDATE', oldValue: currentUser.quietHoursStart, newValue: user.quietHoursStart },
      { field: 'quietHoursEnd', action: 'UPDATE', oldValue: currentUser.quietHoursEnd, newValue: user.quietHoursEnd },
      { field: 'digestFrequency', action: 'UPDATE', oldValue: currentUser.digestFrequency, newValue: user.digestFrequency },
    ]

    for (const { field, action, oldValue, newValue } of fieldsToAudit) {
      if (oldValue !== newValue) {
        auditEntries.push({
          userId: currentUser.id,
          actorId: session.user.id,
          action,
          field,
          oldValue: normalizeValue(oldValue as string | boolean | null),
          newValue: normalizeValue(newValue as string | boolean | null),
        })
      }
    }

    if (auditEntries.length > 0) {
      await prisma.userAudit.createMany({ data: auditEntries })
    }

    logger.info(CONTEXT, 'User updated', {
      userId: params.id,
      actorId: session.user.id,
      changedFields: auditEntries.map(e => e.field),
    })

    return NextResponse.json({ success: true, user }, { status: 200 })
  } catch (error) {
    logger.error(CONTEXT, error, { method: 'PATCH', userId: params.id })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/users/[id] - удалить пользователя (только админ)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paramResult = idParamSchema.safeParse({ id: params.id })
    if (!paramResult.success) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const isSuperAdmin = session.user.role === 'SUPERADMIN'

    // Только админ может удалять пользователей
    if (!hasPermission(session.user.role, 'MANAGE_USERS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Нельзя удалить себя
    if (params.id === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot delete yourself' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        role: true,
        name: true,
        email: true,
        telegramChatId: true,
        canLogin: true,
        notifyEmail: true,
        notifyTelegram: true,
        notifySms: true,
        notifyInApp: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        digestFrequency: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.role === 'SUPERADMIN') {
      if (!isSuperAdmin) {
        return NextResponse.json({ error: 'Only superadmin can delete a superadmin' }, { status: 403 })
      }
      const superAdminCount = await prisma.user.count({ where: { role: 'SUPERADMIN' } })
      if (superAdminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last superadmin' },
          { status: 400 }
        )
      }
    }

    if (user.role === 'ADMIN' && !isSuperAdmin) {
      return NextResponse.json({ error: 'Only superadmin can delete an admin' }, { status: 403 })
    }

    if (user.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } })
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last admin' },
          { status: 400 }
        )
      }
    }

    await prisma.userAudit.create({
      data: {
        userId: params.id,
        actorId: session.user.id,
        action: 'DELETE',
        oldValue: JSON.stringify({
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

    await prisma.user.delete({
      where: { id: params.id },
    })

    logger.info(CONTEXT, 'User deleted', { userId: params.id, actorId: session.user.id })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error(CONTEXT, error, { method: 'DELETE', userId: params.id })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

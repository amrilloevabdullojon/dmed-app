import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'

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
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('GET /api/users/[id] error:', error)
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

    const body = await request.json()
    const {
      role,
      name,
      telegramChatId,
      email,
      canLogin,
      notifyEmail,
      notifyTelegram,
      notifySms,
      notifyInApp,
      quietHoursStart,
      quietHoursEnd,
      digestFrequency,
    } = body

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
      },
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updateData: any = {}

    if (
      role === 'ADMIN' ||
      role === 'MANAGER' ||
      role === 'AUDITOR' ||
      role === 'EMPLOYEE' ||
      role === 'VIEWER'
    ) {
      updateData.role = role
    }

    if (name !== undefined) {
      updateData.name = name
    }

    if (telegramChatId !== undefined) {
      updateData.telegramChatId = telegramChatId || null
    }

    if (typeof canLogin === 'boolean') {
      updateData.canLogin = canLogin
    }

    if (typeof notifyEmail === 'boolean') {
      updateData.notifyEmail = notifyEmail
    }

    if (typeof notifyTelegram === 'boolean') {
      updateData.notifyTelegram = notifyTelegram
    }

    if (typeof notifySms === 'boolean') {
      updateData.notifySms = notifySms
    }

    if (typeof notifyInApp === 'boolean') {
      updateData.notifyInApp = notifyInApp
    }

    if (quietHoursStart !== undefined) {
      updateData.quietHoursStart = quietHoursStart || null
    }

    if (quietHoursEnd !== undefined) {
      updateData.quietHoursEnd = quietHoursEnd || null
    }

    if (
      digestFrequency === 'NONE' ||
      digestFrequency === 'DAILY' ||
      digestFrequency === 'WEEKLY'
    ) {
      updateData.digestFrequency = digestFrequency
    }

    if (email !== undefined) {
      const normalizedEmail = String(email || '').trim().toLowerCase()
      if (normalizedEmail) {
        const existing = await prisma.user.findFirst({
          where: {
            email: normalizedEmail,
            id: { not: params.id },
          },
          select: { id: true },
        })
        if (existing) {
          return NextResponse.json(
            { error: 'Email already in use' },
            { status: 409 }
          )
        }
        updateData.email = normalizedEmail
      } else {
        updateData.email = null
      }
    }

    let approvalRecord: { id: string } | null = null

    if (updateData.role && updateData.role !== 'ADMIN' && currentUser.role === 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN' },
      })
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'At least one admin is required' },
          { status: 400 }
        )
      }

      const existingApproval = await prisma.adminApproval.findFirst({
        where: {
          targetUserId: params.id,
          action: 'DEMOTE_ADMIN',
          status: 'PENDING',
        },
        select: { id: true },
      })

      if (existingApproval) {
        approvalRecord = existingApproval
      } else {
        approvalRecord = await prisma.adminApproval.create({
          data: {
            action: 'DEMOTE_ADMIN',
            targetUserId: params.id,
            requestedById: session.user.id,
            payload: { newRole: updateData.role },
          },
          select: { id: true },
        })
      }

      delete updateData.role
    }

    let user = {
      ...currentUser,
    }

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
        },
      })
    }

    const auditEntries: Array<{
      userId: string
      actorId: string
      action: string
      field: string
      oldValue: string | null
      newValue: string | null
    }> = []

    const normalizeValue = (value: string | boolean | null | undefined) =>
      value === null || value === undefined ? null : String(value)

    const nextName = updateData.name ?? currentUser.name
    const nextEmail = updateData.email ?? currentUser.email
    const nextRole = updateData.role ?? currentUser.role
    const nextCanLogin = updateData.canLogin ?? currentUser.canLogin
    const nextTelegram = updateData.telegramChatId ?? currentUser.telegramChatId
    const nextNotifyEmail = updateData.notifyEmail ?? currentUser.notifyEmail
    const nextNotifyTelegram = updateData.notifyTelegram ?? currentUser.notifyTelegram
    const nextNotifySms = updateData.notifySms ?? currentUser.notifySms
    const nextNotifyInApp = updateData.notifyInApp ?? currentUser.notifyInApp
    const nextQuietHoursStart = updateData.quietHoursStart ?? currentUser.quietHoursStart
    const nextQuietHoursEnd = updateData.quietHoursEnd ?? currentUser.quietHoursEnd
    const nextDigestFrequency = updateData.digestFrequency ?? currentUser.digestFrequency

    if (currentUser.name !== nextName) {
      auditEntries.push({
        userId: currentUser.id,
        actorId: session.user.id,
        action: 'UPDATE',
        field: 'name',
        oldValue: normalizeValue(currentUser.name),
        newValue: normalizeValue(nextName),
      })
    }

    if (currentUser.email !== nextEmail) {
      auditEntries.push({
        userId: currentUser.id,
        actorId: session.user.id,
        action: 'UPDATE',
        field: 'email',
        oldValue: normalizeValue(currentUser.email),
        newValue: normalizeValue(nextEmail),
      })
    }

    if (currentUser.role !== nextRole) {
      auditEntries.push({
        userId: currentUser.id,
        actorId: session.user.id,
        action: 'ROLE',
        field: 'role',
        oldValue: normalizeValue(currentUser.role),
        newValue: normalizeValue(nextRole),
      })
    }

    if (currentUser.canLogin !== nextCanLogin) {
      auditEntries.push({
        userId: currentUser.id,
        actorId: session.user.id,
        action: 'ACCESS',
        field: 'canLogin',
        oldValue: normalizeValue(currentUser.canLogin),
        newValue: normalizeValue(nextCanLogin),
      })
    }

    if (currentUser.telegramChatId !== nextTelegram) {
      auditEntries.push({
        userId: currentUser.id,
        actorId: session.user.id,
        action: 'UPDATE',
        field: 'telegramChatId',
        oldValue: normalizeValue(currentUser.telegramChatId),
        newValue: normalizeValue(nextTelegram),
      })
    }

    if (currentUser.notifyEmail !== nextNotifyEmail) {
      auditEntries.push({
        userId: currentUser.id,
        actorId: session.user.id,
        action: 'UPDATE',
        field: 'notifyEmail',
        oldValue: normalizeValue(currentUser.notifyEmail),
        newValue: normalizeValue(nextNotifyEmail),
      })
    }

    if (currentUser.notifyTelegram !== nextNotifyTelegram) {
      auditEntries.push({
        userId: currentUser.id,
        actorId: session.user.id,
        action: 'UPDATE',
        field: 'notifyTelegram',
        oldValue: normalizeValue(currentUser.notifyTelegram),
        newValue: normalizeValue(nextNotifyTelegram),
      })
    }

    if (currentUser.notifySms !== nextNotifySms) {
      auditEntries.push({
        userId: currentUser.id,
        actorId: session.user.id,
        action: 'UPDATE',
        field: 'notifySms',
        oldValue: normalizeValue(currentUser.notifySms),
        newValue: normalizeValue(nextNotifySms),
      })
    }

    if (currentUser.notifyInApp !== nextNotifyInApp) {
      auditEntries.push({
        userId: currentUser.id,
        actorId: session.user.id,
        action: 'UPDATE',
        field: 'notifyInApp',
        oldValue: normalizeValue(currentUser.notifyInApp),
        newValue: normalizeValue(nextNotifyInApp),
      })
    }

    if (currentUser.quietHoursStart !== nextQuietHoursStart) {
      auditEntries.push({
        userId: currentUser.id,
        actorId: session.user.id,
        action: 'UPDATE',
        field: 'quietHoursStart',
        oldValue: normalizeValue(currentUser.quietHoursStart),
        newValue: normalizeValue(nextQuietHoursStart),
      })
    }

    if (currentUser.quietHoursEnd !== nextQuietHoursEnd) {
      auditEntries.push({
        userId: currentUser.id,
        actorId: session.user.id,
        action: 'UPDATE',
        field: 'quietHoursEnd',
        oldValue: normalizeValue(currentUser.quietHoursEnd),
        newValue: normalizeValue(nextQuietHoursEnd),
      })
    }

    if (currentUser.digestFrequency !== nextDigestFrequency) {
      auditEntries.push({
        userId: currentUser.id,
        actorId: session.user.id,
        action: 'UPDATE',
        field: 'digestFrequency',
        oldValue: normalizeValue(currentUser.digestFrequency),
        newValue: normalizeValue(nextDigestFrequency),
      })
    }

    if (auditEntries.length > 0) {
      await prisma.userAudit.createMany({ data: auditEntries })
    }

    return NextResponse.json(
      {
        success: true,
        user,
        requiresApproval: !!approvalRecord,
        approvalId: approvalRecord?.id || null,
      },
      { status: approvalRecord ? 202 : 200 }
    )
  } catch (error) {
    console.error('PATCH /api/users/[id] error:', error)
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

    if (user.role === 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN' },
      })
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last admin' },
          { status: 400 }
        )
      }
    }

    if (user.role === 'ADMIN') {
      const existingApproval = await prisma.adminApproval.findFirst({
        where: {
          targetUserId: params.id,
          action: 'DELETE_ADMIN',
          status: 'PENDING',
        },
        select: { id: true },
      })

      const approval = existingApproval
        ? existingApproval
        : await prisma.adminApproval.create({
            data: {
              action: 'DELETE_ADMIN',
              targetUserId: params.id,
              requestedById: session.user.id,
            },
            select: { id: true },
          })

      return NextResponse.json(
        {
          success: false,
          requiresApproval: true,
          approvalId: approval.id,
        },
        { status: 202 }
      )
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/users/[id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

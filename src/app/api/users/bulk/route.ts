import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { hasPermission } from '@/lib/permissions'

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

    if (!hasPermission(session.user.role, 'MANAGE_USERS')) {
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

    const targetUsers = await prisma.user.findMany({
      where: { id: { in: ids } },
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

    if (action === 'delete') {
      if (ids.includes(session.user.id)) {
        return NextResponse.json(
          { error: 'Cannot delete yourself' },
          { status: 400 }
        )
      }

      const adminTargets = targetUsers.filter((user) => user.role === 'ADMIN')
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN' },
      })
      if (adminTargets.length > 0 && adminCount - adminTargets.length <= 0) {
        return NextResponse.json(
          { error: 'Cannot delete the last admin' },
          { status: 400 }
        )
      }

      const nonAdminTargets = targetUsers.filter((user) => user.role !== 'ADMIN')

      if (adminTargets.length > 0) {
        const existingApprovals = await prisma.adminApproval.findMany({
          where: {
            targetUserId: { in: adminTargets.map((user) => user.id) },
            action: 'DELETE_ADMIN',
            status: 'PENDING',
          },
          select: { targetUserId: true },
        })

        const existingIds = new Set(existingApprovals.map((item) => item.targetUserId))
        const approvalsToCreate = adminTargets
          .filter((user) => !existingIds.has(user.id))
          .map((user) => ({
            action: 'DELETE_ADMIN' as const,
            targetUserId: user.id,
            requestedById: session.user.id,
          }))

        if (approvalsToCreate.length > 0) {
          await prisma.adminApproval.createMany({ data: approvalsToCreate })
        }
      }

      if (nonAdminTargets.length > 0) {
        await prisma.userAudit.createMany({
          data: nonAdminTargets.map((user) => ({
            userId: user.id,
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
          })),
        })
      }

      const result = await prisma.user.deleteMany({
        where: { id: { in: nonAdminTargets.map((user) => user.id) } },
      })
      return NextResponse.json({
        success: true,
        deleted: result.count,
        requiresApproval: adminTargets.length > 0,
        pendingApprovals: adminTargets.length,
      }, { status: adminTargets.length > 0 ? 202 : 200 })
    }

    if (action === 'role') {
      const role = value === 'ADMIN' ? 'ADMIN' : value === 'MANAGER'
        ? 'MANAGER'
        : value === 'AUDITOR'
          ? 'AUDITOR'
          : value === 'VIEWER'
            ? 'VIEWER'
            : 'EMPLOYEE'

      const adminTargets = role !== 'ADMIN'
        ? targetUsers.filter((user) => user.role === 'ADMIN')
        : []

      if (adminTargets.length > 0) {
        const adminCount = await prisma.user.count({
          where: { role: 'ADMIN' },
        })
        if (adminCount - adminTargets.length <= 0) {
          return NextResponse.json(
            { error: 'At least one admin is required' },
            { status: 400 }
          )
        }

        const existingApprovals = await prisma.adminApproval.findMany({
          where: {
            targetUserId: { in: adminTargets.map((user) => user.id) },
            action: 'DEMOTE_ADMIN',
            status: 'PENDING',
          },
          select: { targetUserId: true },
        })

        const existingIds = new Set(existingApprovals.map((item) => item.targetUserId))
        const approvalsToCreate = adminTargets
          .filter((user) => !existingIds.has(user.id))
          .map((user) => ({
            action: 'DEMOTE_ADMIN' as const,
            targetUserId: user.id,
            requestedById: session.user.id,
            payload: { newRole: role },
          }))

        if (approvalsToCreate.length > 0) {
          await prisma.adminApproval.createMany({ data: approvalsToCreate })
        }
      }

      const nonAdminTargets = adminTargets.length > 0
        ? targetUsers.filter((user) => user.role !== 'ADMIN')
        : targetUsers
      const changedUsers = nonAdminTargets.filter((user) => user.role !== role)
      if (changedUsers.length > 0) {
        await prisma.userAudit.createMany({
          data: changedUsers.map((user) => ({
            userId: user.id,
            actorId: session.user.id,
            action: 'ROLE',
            field: 'role',
            oldValue: user.role,
            newValue: role,
          })),
        })
      }

      const result = await prisma.user.updateMany({
        where: { id: { in: nonAdminTargets.map((user) => user.id) } },
        data: { role },
      })
      return NextResponse.json({
        success: true,
        updated: result.count,
        requiresApproval: adminTargets.length > 0,
        pendingApprovals: adminTargets.length,
      }, { status: adminTargets.length > 0 ? 202 : 200 })
    }

    if (action === 'canLogin') {
      const canLogin = value === true || value === 'true' || value === 'enable'
      const changedUsers = targetUsers.filter((user) => user.canLogin !== canLogin)
      if (changedUsers.length > 0) {
        await prisma.userAudit.createMany({
          data: changedUsers.map((user) => ({
            userId: user.id,
            actorId: session.user.id,
            action: 'ACCESS',
            field: 'canLogin',
            oldValue: String(user.canLogin),
            newValue: String(canLogin),
          })),
        })
      }
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

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { requirePermission } from '@/lib/permission-guard'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger.server'

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

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    const permissionError = requirePermission(session.user.role, 'MANAGE_USERS')
    if (permissionError) {
      return permissionError
    }
    const isSuperAdmin = session.user.role === 'SUPERADMIN'

    const body = await request.json()
    const parsed = bulkSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
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
        return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
      }

      const adminTargets = targetUsers.filter((user) => user.role === 'ADMIN')
      const superAdminTargets = targetUsers.filter((user) => user.role === 'SUPERADMIN')

      if (!isSuperAdmin && (adminTargets.length > 0 || superAdminTargets.length > 0)) {
        return NextResponse.json(
          { error: 'Only superadmin can delete admin accounts' },
          { status: 403 }
        )
      }

      if (adminTargets.length > 0) {
        const adminCount = await prisma.user.count({
          where: { role: 'ADMIN' },
        })
        if (adminCount - adminTargets.length <= 0) {
          return NextResponse.json({ error: 'Cannot delete the last admin' }, { status: 400 })
        }
      }

      if (superAdminTargets.length > 0) {
        const superAdminCount = await prisma.user.count({
          where: { role: 'SUPERADMIN' },
        })
        if (superAdminCount - superAdminTargets.length <= 0) {
          return NextResponse.json({ error: 'Cannot delete the last superadmin' }, { status: 400 })
        }
      }

      if (targetUsers.length > 0) {
        await prisma.userAudit.createMany({
          data: targetUsers.map((user) => ({
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
        where: { id: { in: targetUsers.map((user) => user.id) } },
      })
      return NextResponse.json({
        success: true,
        deleted: result.count,
      })
    }

    if (action === 'role') {
      if (!isSuperAdmin) {
        return NextResponse.json({ error: 'Only superadmin can change roles' }, { status: 403 })
      }

      const role =
        value === 'SUPERADMIN'
          ? 'SUPERADMIN'
          : value === 'ADMIN'
            ? 'ADMIN'
            : value === 'MANAGER'
              ? 'MANAGER'
              : value === 'AUDITOR'
                ? 'AUDITOR'
                : value === 'VIEWER'
                  ? 'VIEWER'
                  : 'EMPLOYEE'

      const adminTargets =
        role !== 'ADMIN' ? targetUsers.filter((user) => user.role === 'ADMIN') : []
      const superAdminTargets =
        role !== 'SUPERADMIN' ? targetUsers.filter((user) => user.role === 'SUPERADMIN') : []

      if (adminTargets.length > 0) {
        const adminCount = await prisma.user.count({
          where: { role: 'ADMIN' },
        })
        if (adminCount - adminTargets.length <= 0) {
          return NextResponse.json({ error: 'At least one admin is required' }, { status: 400 })
        }
      }

      if (superAdminTargets.length > 0) {
        const superAdminCount = await prisma.user.count({
          where: { role: 'SUPERADMIN' },
        })
        if (superAdminCount - superAdminTargets.length <= 0) {
          return NextResponse.json(
            { error: 'At least one superadmin is required' },
            { status: 400 }
          )
        }
      }

      const changedUsers = targetUsers.filter((user) => user.role !== role)
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
        where: { id: { in: targetUsers.map((user) => user.id) } },
        data: { role },
      })
      return NextResponse.json({
        success: true,
        updated: result.count,
      })
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
    logger.error('POST /api/users/bulk', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

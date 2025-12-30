import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { Role } from '@prisma/client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user.role, 'MANAGE_USERS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const action = body.action === 'approve' ? 'approve' : body.action === 'reject' ? 'reject' : null
    if (!action) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const approval = await prisma.adminApproval.findUnique({
      where: { id: params.id },
      include: {
        targetUser: {
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
        },
      },
    })

    if (!approval || approval.status !== 'PENDING') {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 })
    }

    if (approval.requestedById === session.user.id) {
      return NextResponse.json(
        { error: 'Second admin approval required' },
        { status: 400 }
      )
    }

    if (action === 'reject') {
      const updated = await prisma.adminApproval.update({
        where: { id: approval.id },
        data: {
          status: 'REJECTED',
          approvedById: session.user.id,
          resolvedAt: new Date(),
        },
      })
      return NextResponse.json({ success: true, approval: updated })
    }

    const approvalPayload = approval.payload as { newRole?: string } | null
    if (approval.action === 'DEMOTE_ADMIN') {
      const newRole = approvalPayload?.newRole as Role | undefined
      const allowedRoles: Role[] = ['MANAGER', 'AUDITOR', 'EMPLOYEE', 'VIEWER']
      if (!newRole || !allowedRoles.includes(newRole)) {
        return NextResponse.json({ error: 'Invalid role in approval' }, { status: 400 })
      }

      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN' },
      })
      if (approval.targetUser.role === 'ADMIN' && adminCount <= 1) {
        return NextResponse.json(
          { error: 'At least one admin is required' },
          { status: 400 }
        )
      }

      const result = await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: approval.targetUserId },
          data: { role: newRole },
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

        await tx.userAudit.create({
          data: {
            userId: approval.targetUserId,
            actorId: session.user.id,
            action: 'ROLE',
            field: 'role',
            oldValue: approval.targetUser.role,
            newValue: newRole,
          },
        })

        const updatedApproval = await tx.adminApproval.update({
          where: { id: approval.id },
          data: {
            status: 'APPROVED',
            approvedById: session.user.id,
            resolvedAt: new Date(),
          },
        })

        return { updatedUser, updatedApproval }
      })

      return NextResponse.json({ success: true, ...result })
    }

    if (approval.action === 'DELETE_ADMIN') {
      if (!approval.targetUser) {
        return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
      }

      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN' },
      })
      if (approval.targetUser.role === 'ADMIN' && adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last admin' },
          { status: 400 }
        )
      }

      const result = await prisma.$transaction(async (tx) => {
        await tx.userAudit.create({
          data: {
            userId: approval.targetUserId,
            actorId: session.user.id,
            action: 'DELETE',
            oldValue: JSON.stringify({
              name: approval.targetUser.name,
              email: approval.targetUser.email,
              role: approval.targetUser.role,
              canLogin: approval.targetUser.canLogin,
              telegramChatId: approval.targetUser.telegramChatId,
              notifyEmail: approval.targetUser.notifyEmail,
              notifyTelegram: approval.targetUser.notifyTelegram,
              notifySms: approval.targetUser.notifySms,
              notifyInApp: approval.targetUser.notifyInApp,
              quietHoursStart: approval.targetUser.quietHoursStart,
              quietHoursEnd: approval.targetUser.quietHoursEnd,
              digestFrequency: approval.targetUser.digestFrequency,
            }),
          },
        })

        await tx.user.delete({ where: { id: approval.targetUserId } })

        const updatedApproval = await tx.adminApproval.update({
          where: { id: approval.id },
          data: {
            status: 'APPROVED',
            approvedById: session.user.id,
            resolvedAt: new Date(),
          },
        })

        return { updatedApproval }
      })

      return NextResponse.json({ success: true, ...result })
    }

    return NextResponse.json({ error: 'Unsupported approval action' }, { status: 400 })
  } catch (error) {
    console.error('PATCH /api/users/approvals/[id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

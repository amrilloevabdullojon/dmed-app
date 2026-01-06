import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Role } from '@prisma/client'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger.server'

// Все доступные разрешения
const ALL_PERMISSIONS = [
  'MANAGE_USERS',
  'VIEW_AUDIT',
  'VIEW_REPORTS',
  'MANAGE_SETTINGS',
  'MANAGE_LETTERS',
  'VIEW_LETTERS',
  'MANAGE_REQUESTS',
  'VIEW_REQUESTS',
  'SYNC_SHEETS',
] as const

type Permission = (typeof ALL_PERMISSIONS)[number]

// Описания разрешений
const PERMISSION_LABELS: Record<Permission, string> = {
  MANAGE_USERS: 'Управление пользователями',
  VIEW_AUDIT: 'Просмотр аудита',
  VIEW_REPORTS: 'Просмотр отчётов',
  MANAGE_SETTINGS: 'Управление настройками',
  MANAGE_LETTERS: 'Управление письмами',
  VIEW_LETTERS: 'Просмотр писем',
  MANAGE_REQUESTS: 'Управление заявками',
  VIEW_REQUESTS: 'Просмотр заявок',
  SYNC_SHEETS: 'Синхронизация с Google Sheets',
}

// Разрешения по умолчанию для каждой роли
const DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
  SUPERADMIN: [...ALL_PERMISSIONS],
  ADMIN: [
    'MANAGE_USERS',
    'VIEW_AUDIT',
    'VIEW_REPORTS',
    'MANAGE_SETTINGS',
    'MANAGE_LETTERS',
    'VIEW_LETTERS',
    'MANAGE_REQUESTS',
    'VIEW_REQUESTS',
    'SYNC_SHEETS',
  ],
  MANAGER: ['VIEW_REPORTS', 'MANAGE_LETTERS', 'VIEW_LETTERS', 'MANAGE_REQUESTS', 'VIEW_REQUESTS'],
  AUDITOR: ['VIEW_AUDIT', 'VIEW_REPORTS', 'VIEW_LETTERS', 'VIEW_REQUESTS'],
  EMPLOYEE: ['MANAGE_LETTERS', 'VIEW_LETTERS', 'VIEW_REQUESTS'],
  VIEWER: ['VIEW_REPORTS', 'VIEW_LETTERS', 'VIEW_REQUESTS'],
}

// GET - получить все разрешения для всех ролей
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Только SUPERADMIN может просматривать настройки разрешений
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Получаем все настроенные разрешения из БД
    const dbPermissions = await prisma.rolePermission.findMany()

    // Формируем матрицу разрешений
    const roles: Role[] = ['SUPERADMIN', 'ADMIN', 'MANAGER', 'AUDITOR', 'EMPLOYEE', 'VIEWER']
    const permissions: Record<Role, Record<Permission, boolean>> = {} as Record<
      Role,
      Record<Permission, boolean>
    >

    for (const role of roles) {
      permissions[role] = {} as Record<Permission, boolean>

      for (const permission of ALL_PERMISSIONS) {
        // Ищем настройку в БД
        const dbEntry = dbPermissions.find((p) => p.role === role && p.permission === permission)

        if (dbEntry !== undefined) {
          // Используем значение из БД
          permissions[role][permission] = dbEntry.enabled
        } else {
          // Используем значение по умолчанию
          permissions[role][permission] = DEFAULT_PERMISSIONS[role].includes(permission)
        }
      }
    }

    return NextResponse.json({
      permissions,
      allPermissions: ALL_PERMISSIONS,
      permissionLabels: PERMISSION_LABELS,
    })
  } catch (error) {
    logger.error('GET /api/permissions', error)
    return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 })
  }
}

// PUT - обновить разрешение для роли
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    // Только SUPERADMIN может изменять разрешения
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { role, permission, enabled } = body as {
      role: Role
      permission: Permission
      enabled: boolean
    }

    if (!role || !permission || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    // Нельзя менять разрешения SUPERADMIN - они всегда полные
    if (role === 'SUPERADMIN') {
      return NextResponse.json({ error: 'Cannot modify SUPERADMIN permissions' }, { status: 400 })
    }

    // Получаем текущее значение
    const currentPermission = await prisma.rolePermission.findUnique({
      where: { role_permission: { role, permission } },
    })

    const oldValue =
      currentPermission?.enabled ?? DEFAULT_PERMISSIONS[role].includes(permission as Permission)

    // Обновляем или создаём запись
    await prisma.rolePermission.upsert({
      where: { role_permission: { role, permission } },
      update: { enabled },
      create: { role, permission, enabled },
    })

    // Записываем в аудит
    await prisma.permissionAudit.create({
      data: {
        role,
        permission,
        oldValue,
        newValue: enabled,
        actorId: session.user.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('PUT /api/permissions', error)
    return NextResponse.json({ error: 'Failed to update permission' }, { status: 500 })
  }
}

// POST - сбросить разрешения для роли к значениям по умолчанию
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

    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { role } = body as { role?: Role }

    if (role === 'SUPERADMIN') {
      return NextResponse.json({ error: 'Cannot reset SUPERADMIN permissions' }, { status: 400 })
    }

    if (role) {
      // Сбрасываем разрешения только для указанной роли
      await prisma.rolePermission.deleteMany({ where: { role } })
    } else {
      // Сбрасываем все разрешения (кроме SUPERADMIN)
      await prisma.rolePermission.deleteMany({
        where: { role: { not: 'SUPERADMIN' } },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('POST /api/permissions', error)
    return NextResponse.json({ error: 'Failed to reset permissions' }, { status: 500 })
  }
}

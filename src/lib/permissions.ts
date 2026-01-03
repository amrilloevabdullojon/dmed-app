import type { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type Permission =
  | 'MANAGE_USERS'
  | 'VIEW_AUDIT'
  | 'VIEW_REPORTS'
  | 'MANAGE_SETTINGS'
  | 'MANAGE_LETTERS'
  | 'VIEW_LETTERS'
  | 'MANAGE_REQUESTS'
  | 'VIEW_REQUESTS'
  | 'SYNC_SHEETS'

// Разрешения по умолчанию для каждой роли (используются если нет записи в БД)
const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPERADMIN: [
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

// Кэш разрешений (обновляется при изменениях)
let permissionsCache: Record<Role, Permission[]> | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60000 // 1 минута

/**
 * Получить разрешения для роли из БД или кэша
 */
async function loadPermissions(): Promise<Record<Role, Permission[]>> {
  const now = Date.now()

  // Проверяем кэш
  if (permissionsCache && now - cacheTimestamp < CACHE_TTL) {
    return permissionsCache
  }

  try {
    // Загружаем все настроенные разрешения из БД
    const dbPermissions = await prisma.rolePermission.findMany()

    // Формируем матрицу разрешений
    const roles: Role[] = ['SUPERADMIN', 'ADMIN', 'MANAGER', 'AUDITOR', 'EMPLOYEE', 'VIEWER']
    const permissions: Record<Role, Permission[]> = {} as Record<Role, Permission[]>

    for (const role of roles) {
      // SUPERADMIN всегда имеет все разрешения
      if (role === 'SUPERADMIN') {
        permissions[role] = [...DEFAULT_ROLE_PERMISSIONS.SUPERADMIN]
        continue
      }

      const rolePermissions: Permission[] = []

      for (const permission of DEFAULT_ROLE_PERMISSIONS.SUPERADMIN) {
        // Ищем настройку в БД
        const dbEntry = dbPermissions.find(
          (p) => p.role === role && p.permission === permission
        )

        if (dbEntry !== undefined) {
          // Используем значение из БД
          if (dbEntry.enabled) {
            rolePermissions.push(permission as Permission)
          }
        } else {
          // Используем значение по умолчанию
          if (DEFAULT_ROLE_PERMISSIONS[role].includes(permission as Permission)) {
            rolePermissions.push(permission as Permission)
          }
        }
      }

      permissions[role] = rolePermissions
    }

    // Обновляем кэш
    permissionsCache = permissions
    cacheTimestamp = now

    return permissions
  } catch (error) {
    console.error('Error loading permissions from DB:', error)
    // Возвращаем дефолтные разрешения при ошибке
    return DEFAULT_ROLE_PERMISSIONS
  }
}

/**
 * Сбросить кэш разрешений (вызывать после изменения разрешений)
 */
export function invalidatePermissionsCache() {
  permissionsCache = null
  cacheTimestamp = 0
}

/**
 * Проверить разрешение для роли (синхронная версия, использует кэш или дефолты)
 */
export const hasPermission = (role: Role | null | undefined, permission: Permission): boolean => {
  if (!role) return false

  // SUPERADMIN всегда имеет все разрешения
  if (role === 'SUPERADMIN') return true

  // Если кэш доступен - используем его
  if (permissionsCache) {
    return permissionsCache[role]?.includes(permission) ?? false
  }

  // Иначе используем дефолтные разрешения
  return DEFAULT_ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

/**
 * Проверить разрешение для роли (асинхронная версия, загружает из БД)
 */
export const hasPermissionAsync = async (
  role: Role | null | undefined,
  permission: Permission
): Promise<boolean> => {
  if (!role) return false

  // SUPERADMIN всегда имеет все разрешения
  if (role === 'SUPERADMIN') return true

  const permissions = await loadPermissions()
  return permissions[role]?.includes(permission) ?? false
}

/**
 * Получить все разрешения для роли (синхронная версия)
 */
export const getRolePermissions = (role: Role | null | undefined): Permission[] => {
  if (!role) return []

  // Если кэш доступен - используем его
  if (permissionsCache) {
    return permissionsCache[role] ?? []
  }

  // Иначе используем дефолтные разрешения
  return DEFAULT_ROLE_PERMISSIONS[role] ?? []
}

/**
 * Получить все разрешения для роли (асинхронная версия)
 */
export const getRolePermissionsAsync = async (role: Role | null | undefined): Promise<Permission[]> => {
  if (!role) return []

  const permissions = await loadPermissions()
  return permissions[role] ?? []
}

/**
 * Получить дефолтные разрешения (без учёта настроек в БД)
 */
export const getDefaultPermissions = (role: Role | null | undefined): Permission[] => {
  if (!role) return []
  return DEFAULT_ROLE_PERMISSIONS[role] ?? []
}

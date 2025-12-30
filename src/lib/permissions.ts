import type { Role } from '@prisma/client'

export type Permission =
  | 'MANAGE_USERS'
  | 'VIEW_AUDIT'
  | 'VIEW_REPORTS'
  | 'MANAGE_SETTINGS'
  | 'MANAGE_LETTERS'
  | 'VIEW_LETTERS'

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    'MANAGE_USERS',
    'VIEW_AUDIT',
    'VIEW_REPORTS',
    'MANAGE_SETTINGS',
    'MANAGE_LETTERS',
    'VIEW_LETTERS',
  ],
  MANAGER: ['VIEW_REPORTS', 'MANAGE_LETTERS', 'VIEW_LETTERS'],
  AUDITOR: ['VIEW_AUDIT', 'VIEW_REPORTS', 'VIEW_LETTERS'],
  EMPLOYEE: ['MANAGE_LETTERS', 'VIEW_LETTERS'],
  VIEWER: ['VIEW_REPORTS', 'VIEW_LETTERS'],
}

export const hasPermission = (role: Role | null | undefined, permission: Permission) => {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export const getRolePermissions = (role: Role | null | undefined) => {
  if (!role) return []
  return ROLE_PERMISSIONS[role] ?? []
}

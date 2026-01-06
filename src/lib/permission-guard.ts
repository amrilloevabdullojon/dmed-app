import { NextResponse } from 'next/server'
import { hasPermission, type Permission } from '@/lib/permissions'
import type { Role } from '@prisma/client'

export function requirePermission(
  role: Role | null | undefined,
  permission: Permission
): NextResponse<{ error: string }> | null {
  if (hasPermission(role, permission)) {
    return null
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

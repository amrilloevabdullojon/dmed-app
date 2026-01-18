'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Shield, RefreshCw, Check, X, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/Toast'
import type { Role } from '@/types/prisma'

type Permission = string

interface PermissionsData {
  permissions: Record<Role, Record<Permission, boolean>>
  allPermissions: Permission[]
  permissionLabels: Record<Permission, string>
}

const ROLE_LABELS: Record<Role, string> = {
  SUPERADMIN: 'Супер-администратор',
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  AUDITOR: 'Аудитор',
  EMPLOYEE: 'Сотрудник',
  VIEWER: 'Наблюдатель',
}

const ROLE_COLORS: Record<Role, string> = {
  SUPERADMIN: 'text-amber-400',
  ADMIN: 'text-red-400',
  MANAGER: 'text-orange-400',
  AUDITOR: 'text-purple-400',
  EMPLOYEE: 'text-blue-400',
  VIEWER: 'text-slate-400',
}

export function PermissionsManager() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [data, setData] = useState<PermissionsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPermissions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/permissions')
      if (!response.ok) {
        throw new Error('Failed to load permissions')
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      console.error('Error loading permissions:', err)
      setError('Не удалось загрузить настройки разрешений')
      toast.error('Не удалось загрузить настройки разрешений')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadPermissions()
  }, [loadPermissions])

  const handleTogglePermission = async (
    role: Role,
    permission: Permission,
    currentValue: boolean
  ) => {
    if (role === 'SUPERADMIN') {
      toast.warning('Разрешения супер-администратора нельзя изменить')
      return
    }

    const key = `${role}-${permission}`
    setSaving(key)

    try {
      const response = await fetch('/api/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          permission,
          enabled: !currentValue,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update permission')
      }

      // Обновляем локальное состояние
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          permissions: {
            ...prev.permissions,
            [role]: {
              ...prev.permissions[role],
              [permission]: !currentValue,
            },
          },
        }
      })

      toast.success(
        `${data?.permissionLabels[permission] || permission} ${!currentValue ? 'включено' : 'выключено'} для роли ${ROLE_LABELS[role]}`
      )
    } catch (err) {
      console.error('Error updating permission:', err)
      toast.error(err instanceof Error ? err.message : 'Не удалось обновить разрешение')
    } finally {
      setSaving(null)
    }
  }

  const handleResetRole = async (role: Role) => {
    if (role === 'SUPERADMIN') {
      toast.warning('Разрешения супер-администратора нельзя сбросить')
      return
    }

    if (!confirm(`Сбросить все разрешения роли "${ROLE_LABELS[role]}" к значениям по умолчанию?`)) {
      return
    }

    try {
      setSaving(`reset-${role}`)
      const response = await fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })

      if (!response.ok) {
        throw new Error('Failed to reset permissions')
      }

      toast.success(`Разрешения роли "${ROLE_LABELS[role]}" сброшены`)
      loadPermissions()
    } catch (err) {
      console.error('Error resetting permissions:', err)
      toast.error('Не удалось сбросить разрешения')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="panel panel-glass rounded-2xl p-6 text-center">
        <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-400" />
        <p className="text-red-300">{error || 'Данные недоступны'}</p>
        <button
          onClick={loadPermissions}
          className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-white transition hover:bg-white/20"
        >
          Попробовать снова
        </button>
      </div>
    )
  }

  const roles: Role[] = ['ADMIN', 'MANAGER', 'AUDITOR', 'EMPLOYEE', 'VIEWER']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-emerald-400" />
          <h2 className="text-xl font-semibold text-white">Управление разрешениями</h2>
        </div>
        <button
          onClick={loadPermissions}
          className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          title="Обновить"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="panel panel-glass mb-4 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-slate-300">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
        <p>
          Разрешения супер-администратора нельзя изменить. Супер-администратор всегда имеет полный
          доступ ко всем функциям системы.
        </p>
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-2xl border border-white/10 bg-white/5">
        <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-sm">
          <thead className="sticky top-0 z-10 bg-white/5 backdrop-blur">
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                Разрешение
              </th>
              {roles.map((role) => (
                <th key={role} className="min-w-[110px] px-2 py-3 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold ${ROLE_COLORS[role]}`}
                    >
                      {ROLE_LABELS[role]}
                    </span>
                    <button
                      onClick={() => handleResetRole(role)}
                      disabled={saving === `reset-${role}`}
                      className="text-[10px] uppercase tracking-wide text-slate-500 transition hover:text-slate-200 disabled:opacity-50"
                      title="Сбросить к значениям по умолчанию"
                    >
                      {saving === `reset-${role}` ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        'сбросить'
                      )}
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.allPermissions.map((permission) => (
              <tr key={permission} className="group">
                <td className="rounded-l-2xl bg-white/5 px-4 py-3 align-middle group-hover:bg-white/10">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-100">
                      {data.permissionLabels[permission] || permission}
                    </span>
                    {data.permissionLabels[permission] &&
                      data.permissionLabels[permission] !== permission && (
                        <span className="w-fit rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                          {permission}
                        </span>
                      )}
                  </div>
                </td>
                {roles.map((role) => {
                  const enabled = data.permissions[role]?.[permission] ?? false
                  const key = `${role}-${permission}`
                  const isSaving = saving === key

                  return (
                    <td
                      key={role}
                      className="bg-white/5 px-2 py-3 text-center align-middle last:rounded-r-2xl group-hover:bg-white/10"
                    >
                      <button
                        onClick={() => handleTogglePermission(role, permission, enabled)}
                        disabled={isSaving}
                        aria-pressed={enabled}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                          enabled
                            ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.18)] hover:bg-emerald-500/25'
                            : 'border-white/10 bg-white/5 text-slate-500 hover:bg-white/10 hover:text-slate-300'
                        } ${isSaving ? 'cursor-wait opacity-70' : ''}`}
                        title={enabled ? 'Отключить' : 'Включить'}
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : enabled ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}



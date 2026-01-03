'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Shield, RefreshCw, Check, X, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/Toast'
import type { Role } from '@prisma/client'

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

  const handleTogglePermission = async (role: Role, permission: Permission, currentValue: boolean) => {
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
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="panel panel-glass rounded-2xl p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-300">{error || 'Данные недоступны'}</p>
        <button
          onClick={loadPermissions}
          className="mt-4 px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
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
          <Shield className="w-6 h-6 text-emerald-400" />
          <h2 className="text-xl font-semibold text-white">Управление разрешениями</h2>
        </div>
        <button
          onClick={loadPermissions}
          className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition"
          title="Обновить"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="panel panel-glass rounded-2xl p-4 mb-4 text-sm text-slate-400 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <p>
          Разрешения супер-администратора нельзя изменить. Супер-администратор всегда имеет полный доступ ко всем функциям системы.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-3 px-4 text-slate-400 font-medium">Разрешение</th>
              {roles.map((role) => (
                <th key={role} className="text-center py-3 px-2 min-w-[100px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`font-medium ${ROLE_COLORS[role]}`}>{ROLE_LABELS[role]}</span>
                    <button
                      onClick={() => handleResetRole(role)}
                      disabled={saving === `reset-${role}`}
                      className="text-xs text-slate-500 hover:text-slate-300 transition"
                      title="Сбросить к значениям по умолчанию"
                    >
                      {saving === `reset-${role}` ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
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
              <tr key={permission} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-3 px-4">
                  <span className="text-slate-200">
                    {data.permissionLabels[permission] || permission}
                  </span>
                </td>
                {roles.map((role) => {
                  const enabled = data.permissions[role]?.[permission] ?? false
                  const key = `${role}-${permission}`
                  const isSaving = saving === key

                  return (
                    <td key={role} className="text-center py-3 px-2">
                      <button
                        onClick={() => handleTogglePermission(role, permission, enabled)}
                        disabled={isSaving}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                          enabled
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            : 'bg-slate-500/20 text-slate-500 hover:bg-slate-500/30'
                        }`}
                        title={enabled ? 'Отключить' : 'Включить'}
                      >
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : enabled ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <X className="w-4 h-4" />
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

'use client'

import { memo } from 'react'
import type { LetterStatus } from '@/types/prisma'
import { STATUS_LABELS } from '@/lib/utils'
import { CheckSquare, Loader2, Trash2, UserPlus, CheckCircle, X } from 'lucide-react'

interface User {
  id: string
  name: string | null
  email: string | null
}

interface LettersBulkActionsProps {
  selectedCount: number
  bulkAction: 'status' | 'owner' | 'delete' | null
  bulkValue: string
  bulkLoading: boolean
  users: User[]
  userRole: 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'EMPLOYEE' | 'VIEWER'
  statuses: (LetterStatus | 'all')[]
  onBulkActionChange: (action: 'status' | 'owner' | 'delete' | null) => void
  onBulkValueChange: (value: string) => void
  onExecute: () => void
  onClear: () => void
}

export const LettersBulkActions = memo(function LettersBulkActions({
  selectedCount,
  bulkAction,
  bulkValue,
  bulkLoading,
  users,
  userRole,
  statuses,
  onBulkActionChange,
  onBulkValueChange,
  onExecute,
  onClear,
}: LettersBulkActionsProps) {
  if (selectedCount === 0) return null

  return (
    <div className="panel panel-soft mb-4 flex flex-col gap-4 rounded-2xl p-4 lg:flex-row lg:items-center">
      <div className="flex items-center gap-2">
        <CheckSquare className="h-5 w-5 text-teal-300" />
        <span className="font-medium text-white">Выбрано: {selectedCount}</span>
      </div>

      <div className="flex w-full flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={bulkAction || ''}
          onChange={(e) => {
            const value = e.target.value as 'status' | 'owner' | 'delete' | ''
            onBulkActionChange(value || null)
            onBulkValueChange('')
          }}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white sm:w-auto"
          aria-label="Действие"
        >
          <option value="">Выберите действие</option>
          <option value="status">Сменить статус</option>
          <option value="owner">Назначить исполнителя</option>
          {(userRole === 'ADMIN' || userRole === 'SUPERADMIN') && (
            <option value="delete">Удалить</option>
          )}
        </select>

        {bulkAction === 'status' && (
          <select
            value={bulkValue}
            onChange={(e) => onBulkValueChange(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white sm:w-auto"
            aria-label="Статус"
          >
            <option value="">Выберите статус</option>
            {statuses
              .filter((s) => s !== 'all')
              .map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status as LetterStatus]}
                </option>
              ))}
          </select>
        )}

        {bulkAction === 'owner' && (
          <select
            value={bulkValue}
            onChange={(e) => onBulkValueChange(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white sm:w-auto"
            aria-label="Исполнитель"
          >
            <option value="">Выберите исполнителя</option>
            <option value="">Без исполнителя</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name || user.email}
              </option>
            ))}
          </select>
        )}

        {bulkAction && (bulkAction === 'delete' || bulkValue) && (
          <button
            onClick={onExecute}
            disabled={bulkLoading}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-white transition sm:w-auto ${
              bulkAction === 'delete'
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-emerald-500 hover:bg-emerald-600'
            } disabled:opacity-50`}
          >
            {bulkLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : bulkAction === 'delete' ? (
              <Trash2 className="h-4 w-4" />
            ) : bulkAction === 'owner' ? (
              <UserPlus className="h-4 w-4" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Применить
          </button>
        )}
      </div>

      <button
        onClick={onClear}
        className="self-start rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white lg:self-auto"
        aria-label="Снять выбор"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
})



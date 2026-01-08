'use client'

import { useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'
import {
  X,
  Save,
  Loader2,
  Bell,
  Shield,
  Crown,
  Mail,
  MessageSquare,
  User as UserIcon,
  Clock,
} from 'lucide-react'
import type { User, UserEditData, UserRole } from '@/lib/settings-types'
import {
  ROLE_OPTIONS,
  ROLE_BADGE_CLASSES,
  DIGEST_OPTIONS,
  fieldCompact,
} from '@/lib/settings-types'

interface UserEditModalProps {
  user: User
  editData: UserEditData
  editSnapshot: UserEditData | null
  saving: boolean
  isSuperAdmin: boolean
  isLastAdmin: boolean
  isLastSuperAdmin: boolean
  onEditDataChange: (data: UserEditData) => void
  onSave: () => void
  onCancel: () => void
}

const controlBase =
  'h-4 w-4 rounded border-white/20 bg-white/5 text-teal-500 focus:ring-teal-400/50'

export function UserEditModal({
  user,
  editData,
  editSnapshot,
  saving,
  isSuperAdmin,
  isLastAdmin,
  isLastSuperAdmin,
  onEditDataChange,
  onSave,
  onCancel,
}: UserEditModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const firstFocusRef = useRef<HTMLInputElement>(null)

  const roleChangeLocked = !isSuperAdmin || isLastAdmin || isLastSuperAdmin
  const accessChangeLocked = user.role === 'ADMIN' || user.role === 'SUPERADMIN'

  const hasChanges = useCallback(() => {
    if (!editSnapshot) return false
    const keys = Object.keys(editData) as (keyof UserEditData)[]
    return keys.some((key) => editData[key] !== editSnapshot[key])
  }, [editData, editSnapshot])

  const isDirty = hasChanges()

  // Focus trap and escape handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    firstFocusRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onCancel])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onCancel()
      }
    },
    [onCancel]
  )

  const updateField = <K extends keyof UserEditData>(field: K, value: UserEditData[K]) => {
    onEditDataChange({ ...editData, [field]: value })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-modal-title"
    >
      <div
        ref={modalRef}
        className="panel panel-glass flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl"
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-start justify-between gap-4 p-6 pb-0">
          <div className="flex items-center gap-3">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name || user.email || 'User'}
                width={48}
                height={48}
                className="h-12 w-12 rounded-full"
                unoptimized
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                <UserIcon className="h-6 w-6 text-gray-400" />
              </div>
            )}
            <div>
              <h2 id="edit-modal-title" className="text-lg font-semibold text-white">
                Редактирование
              </h2>
              <p className="text-sm text-gray-400">{user.email || 'Без email'}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form - Scrollable */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {/* Basic Info Section */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-300">
              <UserIcon className="h-4 w-4 text-teal-400" />
              Основная информация
            </h3>
            <div className="space-y-3">
              <div className="grid gap-1">
                <label htmlFor="edit-name" className="text-xs text-gray-400">
                  Имя
                </label>
                <input
                  ref={firstFocusRef}
                  id="edit-name"
                  type="text"
                  value={editData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className={`${fieldCompact} w-full px-3 py-2`}
                  placeholder="Имя пользователя"
                />
              </div>

              <div className="grid gap-1">
                <label htmlFor="edit-email" className="text-xs text-gray-400">
                  Email
                </label>
                <input
                  id="edit-email"
                  type="email"
                  value={editData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className={`${fieldCompact} w-full px-3 py-2`}
                  placeholder="email@example.com"
                />
              </div>

              <div className="grid gap-1">
                <label htmlFor="edit-role" className="text-xs text-gray-400">
                  Роль
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="edit-role"
                    value={editData.role}
                    onChange={(e) => updateField('role', e.target.value as UserRole)}
                    disabled={roleChangeLocked}
                    className={`${fieldCompact} flex-1 px-3 py-2 disabled:opacity-60`}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  <span
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${ROLE_BADGE_CLASSES[editData.role]}`}
                  >
                    {editData.role === 'SUPERADMIN' ? (
                      <Crown className="h-3 w-3" />
                    ) : (
                      <Shield className="h-3 w-3" />
                    )}
                  </span>
                </div>
                {!isSuperAdmin && (
                  <p className="text-xs text-amber-400">Роли меняет только суперадмин</p>
                )}
                {isSuperAdmin && isLastAdmin && (
                  <p className="text-xs text-amber-400">Единственный админ не может быть понижен</p>
                )}
                {isSuperAdmin && isLastSuperAdmin && (
                  <p className="text-xs text-amber-400">
                    Единственный суперадмин не может быть понижен
                  </p>
                )}
              </div>

              <div className="grid gap-1">
                <label htmlFor="edit-access" className="text-xs text-gray-400">
                  Доступ в систему
                </label>
                <select
                  id="edit-access"
                  value={editData.canLogin ? 'open' : 'closed'}
                  onChange={(e) => updateField('canLogin', e.target.value === 'open')}
                  disabled={accessChangeLocked}
                  className={`${fieldCompact} w-full px-3 py-2 disabled:opacity-60`}
                >
                  <option value="open">Открыт</option>
                  <option value="closed">Закрыт</option>
                </select>
                {accessChangeLocked && (
                  <p className="text-xs text-amber-400">
                    Нельзя блокировать админа или суперадмина
                  </p>
                )}
              </div>

              <div className="grid gap-1">
                <label htmlFor="edit-telegram" className="text-xs text-gray-400">
                  Telegram Chat ID
                </label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-400" />
                  <input
                    id="edit-telegram"
                    type="text"
                    value={editData.telegramChatId}
                    onChange={(e) => updateField('telegramChatId', e.target.value)}
                    className={`${fieldCompact} w-full py-2 pl-10 pr-3`}
                    placeholder="123456789"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Notifications Section */}
          <section className="border-t border-white/10 pt-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-300">
              <Bell className="h-4 w-4 text-teal-400" />
              Уведомления
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={editData.notifyEmail}
                    onChange={(e) => updateField('notifyEmail', e.target.checked)}
                    className={controlBase}
                  />
                  <Mail className="h-4 w-4 text-gray-500" />
                  Email
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={editData.notifyTelegram}
                    onChange={(e) => updateField('notifyTelegram', e.target.checked)}
                    className={controlBase}
                  />
                  <MessageSquare className="h-4 w-4 text-gray-500" />
                  Telegram
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={editData.notifySms}
                    onChange={(e) => updateField('notifySms', e.target.checked)}
                    className={controlBase}
                  />
                  SMS
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={editData.notifyInApp}
                    onChange={(e) => updateField('notifyInApp', e.target.checked)}
                    className={controlBase}
                  />
                  В системе
                </label>
              </div>

              <div className="grid gap-1">
                <label htmlFor="edit-digest" className="text-xs text-gray-400">
                  Дайджест
                </label>
                <select
                  id="edit-digest"
                  value={editData.digestFrequency}
                  onChange={(e) =>
                    updateField(
                      'digestFrequency',
                      e.target.value as UserEditData['digestFrequency']
                    )
                  }
                  className={`${fieldCompact} w-full px-3 py-2`}
                >
                  {DIGEST_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Quiet Hours Section */}
          <section className="border-t border-white/10 pt-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-300">
              <Clock className="h-4 w-4 text-teal-400" />
              Тихие часы
            </h3>
            <p className="mb-3 text-xs text-gray-500">
              В это время уведомления не будут отправляться
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <label htmlFor="edit-quiet-start" className="text-xs text-gray-400">
                  Начало
                </label>
                <input
                  id="edit-quiet-start"
                  type="time"
                  value={editData.quietHoursStart}
                  onChange={(e) => updateField('quietHoursStart', e.target.value)}
                  className={`${fieldCompact} w-full px-3 py-2`}
                />
              </div>
              <div className="grid gap-1">
                <label htmlFor="edit-quiet-end" className="text-xs text-gray-400">
                  Конец
                </label>
                <input
                  id="edit-quiet-end"
                  type="time"
                  value={editData.quietHoursEnd}
                  onChange={(e) => updateField('quietHoursEnd', e.target.value)}
                  className={`${fieldCompact} w-full px-3 py-2`}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Footer - Fixed */}
        <div className="flex flex-shrink-0 items-center justify-between border-t border-white/10 p-6 pt-4">
          <span className="text-xs text-gray-500">
            {saving ? 'Сохранение...' : isDirty ? 'Есть несохранённые изменения' : 'Нет изменений'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              disabled={saving}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              onClick={onSave}
              disabled={!isDirty || saving}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm text-white transition hover:bg-teal-500 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

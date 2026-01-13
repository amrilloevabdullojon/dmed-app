'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Edit2,
  Trash2,
  Lock,
  Unlock,
  Shield,
  Crown,
  Mail,
  Copy,
  MessageSquare,
  Bell,
  Smartphone,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  History,
  RefreshCw,
  ArrowDownToLine,
  User as UserIcon,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import type { User, UserAuditEntry, AuditFilters } from '@/lib/settings-types'
import {
  ROLE_BADGE_CLASSES,
  ROLE_LABELS,
  DIGEST_LABELS,
  AUDIT_ACTION_OPTIONS,
  AUDIT_FIELD_OPTIONS,
  AUDIT_ACTION_BADGES,
  INACTIVE_WARNING_DAYS,
  fieldCompact,
} from '@/lib/settings-types'

interface UserCardProps {
  user: User
  isSelected: boolean
  isRoyal: boolean
  isLastAdmin: boolean
  isLastSuperAdmin: boolean
  isSuperAdmin: boolean
  currentUserId: string
  auditOpen: boolean
  auditEntries: UserAuditEntry[]
  auditLoading: boolean
  auditCursor: string | null
  auditFilters: AuditFilters
  onToggleSelect: (userId: string) => void
  onEdit: (user: User) => void
  onDelete: (userId: string) => void
  onToggleAccess: (user: User) => void
  onToggleAudit: (userId: string) => void
  onLoadAudit: (userId: string, mode: 'replace' | 'more') => void
  onAuditFiltersChange: (filters: AuditFilters) => void
}

const controlBase =
  'h-4 w-4 rounded border-white/20 bg-white/5 text-teal-500 focus:ring-teal-400/50'

function formatDate(date: string | null): string {
  if (!date) return '-'
  return new Date(date).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatShortDate(date: string | null): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  })
}

function formatRoleLabel(role: string): string {
  return ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role
}

function formatBooleanLabel(value: string): string {
  return value === 'true' ? 'Включено' : 'Выключено'
}

function formatAuditValue(field: string | null, value: string | null): string {
  if (!value) return '-'
  if (field === 'role') return formatRoleLabel(value)
  if (field === 'canLogin') return value === 'true' ? 'Открыт' : 'Закрыт'
  if (field === 'digestFrequency')
    return DIGEST_LABELS[value as keyof typeof DIGEST_LABELS] || value
  if (['notifyEmail', 'notifyTelegram', 'notifySms', 'notifyInApp'].includes(field || '')) {
    return formatBooleanLabel(value)
  }
  return value
}

function getAuditSummary(entry: UserAuditEntry): string {
  if (entry.action === 'CREATE') return 'Создан пользователь'
  if (entry.action === 'DELETE') return 'Пользователь удалён'
  if (entry.action === 'ROLE') return 'Смена роли'
  if (entry.action === 'ACCESS') return 'Доступ к системе'

  const fieldLabels: Record<string, string> = {
    name: 'Имя',
    email: 'Email',
    role: 'Роль',
    canLogin: 'Доступ',
    telegramChatId: 'Telegram',
    notifyEmail: 'Email уведомления',
    notifyTelegram: 'Telegram уведомления',
    notifySms: 'SMS уведомления',
    notifyInApp: 'Внутри системы',
    quietHoursStart: 'Тихие часы (с)',
    quietHoursEnd: 'Тихие часы (до)',
    digestFrequency: 'Дайджест',
  }
  const label = entry.field ? fieldLabels[entry.field] || entry.field : 'Поле'
  return `Обновлено поле: ${label}`
}

function getUserStatus(user: User): 'active' | 'invited' | 'blocked' {
  if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') return 'active'
  if (!user.canLogin) return 'blocked'
  if (user._count.sessions === 0) return 'invited'
  return 'active'
}

function getUserStatusBadge(user: User) {
  const status = getUserStatus(user)
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-1 text-xs text-emerald-400">
        <CheckCircle className="h-3 w-3" />
        Активен
      </span>
    )
  }
  if (status === 'invited') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-blue-500/20 px-2 py-1 text-xs text-blue-400">
        <Clock className="h-3 w-3" />
        Приглашён
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-xs text-red-400">
      <XCircle className="h-3 w-3" />
      Блокирован
    </span>
  )
}

function getInactiveBadge(user: User) {
  if (!user.lastLoginAt) return null
  const days = Math.floor(
    (Date.now() - new Date(user.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (days < INACTIVE_WARNING_DAYS) return null
  return (
    <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-1 text-xs text-amber-300">
      <Clock className="h-3 w-3" />
      {days} дней без входа
    </span>
  )
}

export function UserCard({
  user,
  isSelected,
  isRoyal,
  isLastAdmin,
  isLastSuperAdmin,
  isSuperAdmin,
  currentUserId,
  auditOpen,
  auditEntries,
  auditLoading,
  auditCursor,
  auditFilters,
  onToggleSelect,
  onEdit,
  onDelete,
  onToggleAccess,
  onToggleAudit,
  onLoadAudit,
  onAuditFiltersChange,
}: UserCardProps) {
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const toast = useToast()

  const deleteLocked =
    (user.role === 'ADMIN' && (!isSuperAdmin || isLastAdmin)) ||
    (user.role === 'SUPERADMIN' && (!isSuperAdmin || isLastSuperAdmin))

  const hasAuditEntries = auditEntries.length > 0

  const handleDelete = () => {
    if (deleteConfirm) {
      onDelete(user.id)
      setDeleteConfirm(false)
    } else {
      setDeleteConfirm(true)
      setTimeout(() => setDeleteConfirm(false), 3000)
    }
  }

  const handleCopyEmail = async () => {
    if (!user.email) {
      toast.error(
        '\u041d\u0435\u0442 email \u0434\u043b\u044f \u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f'
      )
      return
    }

    try {
      await navigator.clipboard.writeText(user.email)
      toast.success(
        '\u0410\u0434\u0440\u0435\u0441 \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d'
      )
    } catch (error) {
      console.error('Failed to copy email:', error)
      toast.error(
        '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c email'
      )
    }
  }

  return (
    <div
      className={`panel-soft panel-glass overflow-hidden rounded-2xl p-4 transition ${
        isSelected ? 'ring-2 ring-emerald-400/40' : ''
      } ${isRoyal ? 'border-yellow-400/40 bg-gradient-to-br from-yellow-500/10 via-white/5 to-transparent' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name || user.email || 'User'}
              width={44}
              height={44}
              className="h-11 w-11 flex-shrink-0 rounded-full"
              unoptimized
            />
          ) : (
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white/10">
              <span className="text-sm font-semibold text-gray-300">
                {(user.name || user.email || '?')[0].toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-semibold text-white">
                {user.name || '\u041d\u0435\u0442 \u0438\u043c\u0435\u043d\u0438'}
              </h3>
              <span
                className={`inline-flex flex-shrink-0 items-center gap-1 rounded px-2 py-0.5 text-xs ${ROLE_BADGE_CLASSES[user.role]}`}
              >
                {user.role === 'SUPERADMIN' ? (
                  <Crown className="h-3 w-3 text-yellow-200" />
                ) : (
                  <Shield className="h-3 w-3" />
                )}
                {formatRoleLabel(user.role)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Mail className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{user.email || '-'}</span>
            </div>
          </div>
        </div>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(user.id)}
          className={`${controlBase} mt-1 flex-shrink-0`}
          aria-label={`Выбрать ${user.name || user.email || 'пользователя'}`}
        />
      </div>

      {/* Badges */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {getUserStatusBadge(user)}
        {getInactiveBadge(user)}
        {user.lastLoginAt && (
          <span className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-1 text-xs text-gray-400">
            <Clock className="h-3 w-3" />
            {formatShortDate(user.lastLoginAt)}
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-1 text-xs text-gray-300">
          <FileText className="h-3 w-3" />
          {user._count.letters} писем
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-1 text-xs text-gray-400">
          <MessageSquare className="h-3 w-3" />
          {user._count.comments}
        </span>
        <span className="inline-flex items-center gap-2 rounded bg-white/5 px-2 py-1 text-xs text-gray-400">
          <span aria-label="Email">
            <Mail
              className={`h-3.5 w-3.5 ${user.notifyEmail ? 'text-emerald-300' : 'text-slate-600'}`}
            />
          </span>
          <span aria-label="Telegram">
            <MessageSquare
              className={`h-3.5 w-3.5 ${user.notifyTelegram ? 'text-emerald-300' : 'text-slate-600'}`}
            />
          </span>
          <span aria-label="SMS">
            <Smartphone
              className={`h-3.5 w-3.5 ${user.notifySms ? 'text-emerald-300' : 'text-slate-600'}`}
            />
          </span>
          <span aria-label="In-app">
            <Bell
              className={`h-3.5 w-3.5 ${user.notifyInApp ? 'text-emerald-300' : 'text-slate-600'}`}
            />
          </span>
        </span>
      </div>

      {/* Info */}
      <div className="mt-4 grid gap-2 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-400" />
          {user.telegramChatId || '-'}
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Последний вход: {formatDate(user.lastLoginAt)}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-gray-500">Создан: {formatDate(user.createdAt)}</span>
        <div className="flex items-center gap-2">
          <Link
            href={`/users/${user.id}`}
            aria-label="Профиль"
            className="p-2 text-gray-400 transition hover:text-white"
            title="Профиль"
          >
            <UserIcon className="h-4 w-4" />
          </Link>
          <button
            onClick={handleCopyEmail}
            aria-label="\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c email"
            disabled={!user.email}
            className="p-2 text-gray-400 transition hover:text-white disabled:opacity-60"
          >
            <Copy className="h-4 w-4" />
          </button>
          {user.id !== currentUserId && (
            <button
              onClick={() => onToggleAccess(user)}
              aria-label={user.canLogin ? 'Заблокировать' : 'Разблокировать'}
              disabled={user.role === 'ADMIN' || user.role === 'SUPERADMIN'}
              title={
                user.role === 'SUPERADMIN'
                  ? 'Нельзя отключить суперадмина'
                  : user.role === 'ADMIN'
                    ? 'Нельзя отключить админа'
                    : user.canLogin
                      ? 'Закрыть доступ'
                      : 'Открыть доступ'
              }
              className="p-2 text-gray-400 transition hover:text-emerald-300 disabled:opacity-60"
            >
              {user.canLogin ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </button>
          )}
          <button
            onClick={() => onEdit(user)}
            aria-label="Редактировать"
            className="p-2 text-gray-400 transition hover:text-white"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          {user.id !== currentUserId && (
            <button
              onClick={handleDelete}
              aria-label={deleteConfirm ? 'Подтвердить удаление' : 'Удалить'}
              disabled={deleteLocked}
              title={
                !isSuperAdmin && (user.role === 'ADMIN' || user.role === 'SUPERADMIN')
                  ? 'Удалять админов может только суперадмин'
                  : isLastSuperAdmin
                    ? 'Нельзя удалить единственного суперадмина'
                    : isLastAdmin
                      ? 'Нельзя удалить единственного админа'
                      : deleteConfirm
                        ? 'Нажмите ещё раз для подтверждения'
                        : 'Удалить'
              }
              className={`p-2 transition disabled:opacity-60 ${
                deleteConfirm
                  ? 'text-red-400 hover:text-red-300'
                  : 'text-gray-400 hover:text-red-400'
              }`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => onToggleAudit(user.id)}
            aria-label="История изменений"
            className="rounded border border-white/10 px-2 py-1 text-xs text-gray-400 transition hover:text-white"
          >
            {auditOpen ? 'Скрыть историю' : 'История'}
          </button>
        </div>
      </div>

      {/* Audit Panel */}
      {auditOpen && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-200">
              <History className="h-4 w-4 text-emerald-400" />
              История изменений
              <span className="text-xs text-gray-500">{auditEntries.length}</span>
            </div>
            <button
              onClick={() => onLoadAudit(user.id, 'replace')}
              className="inline-flex items-center gap-2 text-xs text-gray-400 transition hover:text-white"
              aria-label="Обновить историю"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Обновить
            </button>
          </div>

          {/* Audit Filters */}
          <div className="panel-soft panel-glass mb-3 grid grid-cols-1 gap-2 rounded-xl p-3 text-xs md:grid-cols-2 xl:grid-cols-4">
            <select
              value={auditFilters.action}
              onChange={(e) => onAuditFiltersChange({ ...auditFilters, action: e.target.value })}
              className={`${fieldCompact} px-3 py-1.5`}
              aria-label="Фильтр по действию"
            >
              {AUDIT_ACTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={auditFilters.field}
              onChange={(e) => onAuditFiltersChange({ ...auditFilters, field: e.target.value })}
              className={`${fieldCompact} px-3 py-1.5`}
              aria-label="Фильтр по полю"
            >
              {AUDIT_FIELD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={auditFilters.actor}
              onChange={(e) => onAuditFiltersChange({ ...auditFilters, actor: e.target.value })}
              className={`${fieldCompact} px-3 py-1.5`}
              placeholder="Автор"
              aria-label="Поиск по автору"
            />
            <input
              type="text"
              value={auditFilters.query}
              onChange={(e) => onAuditFiltersChange({ ...auditFilters, query: e.target.value })}
              className={`${fieldCompact} px-3 py-1.5`}
              placeholder="Поиск по изменениям"
              aria-label="Поиск по изменениям"
            />
          </div>

          {/* Audit Entries */}
          <div
            className={`min-h-[140px] transition-opacity ${auditLoading ? 'opacity-90' : 'opacity-100'}`}
            aria-busy={auditLoading ? 'true' : 'false'}
          >
            {auditLoading && !hasAuditEntries ? (
              <div className="animate-pulse space-y-2">
                <div className="h-12 rounded-xl border border-white/5 bg-white/5" />
                <div className="h-12 rounded-xl border border-white/5 bg-white/5" />
                <div className="h-12 rounded-xl border border-white/5 bg-white/5" />
              </div>
            ) : hasAuditEntries ? (
              <div className="space-y-4">
                {auditEntries.map((entry) => {
                  const actorName = entry.actor?.name || entry.actor?.email || 'Неизвестный автор'
                  const actorInitial = (actorName || '?').trim().charAt(0).toUpperCase()
                  const showValues = entry.action !== 'CREATE' && entry.action !== 'DELETE'
                  const badge = AUDIT_ACTION_BADGES[entry.action] || {
                    label: entry.action,
                    className: 'bg-slate-500/20 text-slate-300',
                  }
                  return (
                    <div key={entry.id} className="relative pl-4">
                      <span className="absolute left-0 top-3 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
                      <div className="panel-soft panel-glass rounded-xl p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-medium text-white">
                            {getAuditSummary(entry)}
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        {showValues && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-300">
                            <span className="rounded border border-white/10 bg-white/10 px-2 py-1">
                              {formatAuditValue(entry.field, entry.oldValue)}
                            </span>
                            <span className="text-gray-500">→</span>
                            <span className="rounded border border-white/10 bg-white/10 px-2 py-1">
                              {formatAuditValue(entry.field, entry.newValue)}
                            </span>
                          </div>
                        )}
                        <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                          {entry.actor?.image ? (
                            <Image
                              src={entry.actor.image}
                              alt={actorName}
                              width={20}
                              height={20}
                              className="h-5 w-5 rounded-full"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] text-gray-200">
                              {actorInitial}
                            </div>
                          )}
                          <span className="truncate">{actorName}</span>
                          <span className="text-gray-600">·</span>
                          <span>{formatDate(entry.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {auditCursor && (
                  <button
                    onClick={() => onLoadAudit(user.id, 'more')}
                    disabled={auditLoading}
                    className="inline-flex items-center gap-2 text-xs text-emerald-400 transition hover:text-emerald-300 disabled:opacity-50"
                  >
                    {auditLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ArrowDownToLine className="h-3.5 w-3.5" />
                    )}
                    Показать ещё
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-gray-500">
                Нет изменений за выбранный период
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

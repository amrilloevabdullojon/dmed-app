'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Users,
  UserPlus,
  Search,
  CheckCircle,
  Loader2,
  Download,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  RefreshCw,
  XCircle,
  Clock,
  LayoutGrid,
  Table2,
  Lock,
  Unlock,
  Edit2,
  Trash2,
  Copy,
  Mail,
  MessageSquare,
  Bell,
  Smartphone,
  User as UserIcon,
} from 'lucide-react'
import { useUsers } from '@/hooks/useUsers'
import { UserCard } from './UserCard'
import { UserEditModal } from './UserEditModal'
import type { User, UserRole, AdminApproval } from '@/lib/settings-types'
import { ROLE_OPTIONS, ROLE_ORDER, ROLE_LABELS, fieldBase } from '@/lib/settings-types'
import { useLocalStorage } from '@/hooks/useLocalStorage'

interface UsersTabProps {
  session: {
    user: {
      id: string
      role: string
    }
  }
  isSuperAdmin: boolean
  onSuccess: (message: string) => void
  onError: (message: string) => void
}

const controlBase =
  'h-4 w-4 rounded border-white/20 bg-white/5 text-teal-500 focus:ring-teal-400/50'

function formatDate(date: string): string {
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

export function UsersTab({ session, isSuperAdmin, onSuccess, onError }: UsersTabProps) {
  const {
    users,
    filteredUsers,
    loading,
    total,
    page,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextPage,
    prevPage,
    searchQuery,
    roleFilter,
    accessFilter,
    telegramFilter,
    emailFilter,
    setSearchQuery,
    setRoleFilter,
    setAccessFilter,
    setTelegramFilter,
    setEmailFilter,
    editingId,
    editData,
    savingId,
    setEditData,
    startEdit,
    cancelEdit,
    saveEdit,
    createData,
    creating,
    setCreateData,
    createUser,
    deleteUser,
    selectedIds,
    bulkAction,
    bulkValue,
    bulkLoading,
    toggleSelect,
    selectAll,
    clearSelection,
    setBulkAction,
    setBulkValue,
    executeBulkAction,
    auditOpenId,
    auditByUser,
    auditLoading,
    auditCursorByUser,
    auditFilters,
    setAuditFilters,
    toggleAudit,
    loadUserAudit,
    loadUsers,
    exportUsers,
  } = useUsers({ onSuccess, onError, hideSuperAdmin: !isSuperAdmin })

  const [viewMode, setViewMode] = useLocalStorage<'cards' | 'table'>('users-view-mode', 'cards')

  // Approvals state
  const [approvals, setApprovals] = useState<AdminApproval[]>([])
  const [approvalsLoading, setApprovalsLoading] = useState(false)
  const [approvalActionId, setApprovalActionId] = useState<string | null>(null)

  // Load users on mount
  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // Load approvals
  const loadApprovals = useCallback(async () => {
    setApprovalsLoading(true)
    try {
      const res = await fetch('/api/approvals?status=PENDING')
      if (res.ok) {
        const data = await res.json()
        setApprovals(data.approvals || [])
      }
    } catch (error) {
      console.error('Failed to load approvals:', error)
    } finally {
      setApprovalsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isSuperAdmin) {
      loadApprovals()
    }
  }, [isSuperAdmin, loadApprovals])

  const roleOptions = useMemo(
    () =>
      isSuperAdmin ? ROLE_OPTIONS : ROLE_OPTIONS.filter((role) => role.value !== 'SUPERADMIN'),
    [isSuperAdmin]
  )

  useEffect(() => {
    if (!isSuperAdmin && roleFilter === 'SUPERADMIN') {
      setRoleFilter('all')
    }
  }, [isSuperAdmin, roleFilter, setRoleFilter])

  // Handle approval
  const handleApproval = useCallback(
    async (approvalId: string, action: 'approve' | 'reject') => {
      setApprovalActionId(approvalId)
      try {
        const res = await fetch(`/api/approvals/${approvalId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        })
        if (res.ok) {
          onSuccess(action === 'approve' ? 'Запрос подтверждён' : 'Запрос отклонён')
          loadApprovals()
          loadUsers()
        } else {
          const data = await res.json().catch(() => ({}))
          onError(data.error || 'Ошибка обработки запроса')
        }
      } catch (error) {
        console.error('Approval action failed:', error)
        onError('Ошибка обработки запроса')
      } finally {
        setApprovalActionId(null)
      }
    },
    [loadApprovals, loadUsers, onSuccess, onError]
  )

  // Toggle user access
  const toggleUserAccess = useCallback(
    async (user: User) => {
      try {
        const res = await fetch(`/api/users/${user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ canLogin: !user.canLogin }),
        })
        if (res.ok) {
          onSuccess(user.canLogin ? 'Доступ закрыт' : 'Доступ открыт')
          loadUsers()
        } else {
          const data = await res.json().catch(() => ({}))
          onError(data.error || 'Ошибка изменения доступа')
        }
      } catch (error) {
        console.error('Toggle access failed:', error)
        onError('Ошибка изменения доступа')
      }
    },
    [loadUsers, onSuccess, onError]
  )

  // Group users by role
  const groupedUsers = useMemo(() => {
    const groups: Record<UserRole, User[]> = {
      SUPERADMIN: [],
      ADMIN: [],
      MANAGER: [],
      AUDITOR: [],
      EMPLOYEE: [],
      VIEWER: [],
    }
    filteredUsers.forEach((user) => {
      groups[user.role].push(user)
    })
    return groups
  }, [filteredUsers])

  // Sort users by role
  const sortedUsers = useMemo(() => {
    return ROLE_ORDER.flatMap((role) => groupedUsers[role])
  }, [groupedUsers])

  // Admin counts
  const adminCount = users.filter((user) => user.role === 'ADMIN').length
  const superAdminCount = users.filter((user) => user.role === 'SUPERADMIN').length
  const visibleTotal = isSuperAdmin ? total : Math.max(0, total - superAdminCount)

  // Selection state
  const allVisibleSelected =
    filteredUsers.length > 0 && filteredUsers.every((user) => selectedIds.has(user.id))

  const selectedAdminCount = users.filter(
    (user) => selectedIds.has(user.id) && user.role === 'ADMIN'
  ).length
  const selectedSuperAdminCount = users.filter(
    (user) => selectedIds.has(user.id) && user.role === 'SUPERADMIN'
  ).length
  const bulkDemoteBlocked =
    bulkAction === 'role' &&
    !!bulkValue &&
    ((bulkValue !== 'ADMIN' && adminCount - selectedAdminCount <= 0) ||
      (bulkValue !== 'SUPERADMIN' && superAdminCount - selectedSuperAdminCount <= 0))

  const toggleSelectAll = useCallback(() => {
    if (allVisibleSelected) {
      clearSelection()
    } else {
      selectAll()
    }
  }, [allVisibleSelected, clearSelection, selectAll])

  const resetFilters = useCallback(() => {
    setSearchQuery('')
    setRoleFilter('all')
    setAccessFilter('all')
    setTelegramFilter('all')
    setEmailFilter('all')
  }, [setSearchQuery, setRoleFilter, setAccessFilter, setTelegramFilter, setEmailFilter])

  const hasFilters =
    searchQuery ||
    roleFilter !== 'all' ||
    accessFilter !== 'all' ||
    telegramFilter !== 'all' ||
    emailFilter !== 'all'

  const toggleAccessFilter = useCallback(
    (value: 'active' | 'invited' | 'blocked') => {
      setAccessFilter(accessFilter === value ? 'all' : value)
    },
    [accessFilter, setAccessFilter]
  )

  const toggleTelegramFilter = useCallback(
    (value: 'has' | 'none') => {
      setTelegramFilter(telegramFilter === value ? 'all' : value)
    },
    [telegramFilter, setTelegramFilter]
  )

  const toggleEmailFilter = useCallback(
    (value: 'has' | 'none') => {
      setEmailFilter(emailFilter === value ? 'all' : value)
    },
    [emailFilter, setEmailFilter]
  )

  const quickFilters = useMemo(
    () => [
      {
        id: 'active',
        label: '\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0435',
        active: accessFilter === 'active',
        onClick: () => toggleAccessFilter('active'),
      },
      {
        id: 'invited',
        label: '\u041f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u044b',
        active: accessFilter === 'invited',
        onClick: () => toggleAccessFilter('invited'),
      },
      {
        id: 'blocked',
        label: '\u0417\u0430\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d\u044b',
        active: accessFilter === 'blocked',
        onClick: () => toggleAccessFilter('blocked'),
      },
      {
        id: 'no-telegram',
        label: '\u0411\u0435\u0437 Telegram',
        active: telegramFilter === 'none',
        onClick: () => toggleTelegramFilter('none'),
      },
      {
        id: 'no-email',
        label:
          '\u0411\u0435\u0437 email-\u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439',
        active: emailFilter === 'none',
        onClick: () => toggleEmailFilter('none'),
      },
    ],
    [
      accessFilter,
      emailFilter,
      telegramFilter,
      toggleAccessFilter,
      toggleEmailFilter,
      toggleTelegramFilter,
    ]
  )

  const searchSuggestions = useMemo(() => {
    const values = new Set<string>()
    roleOptions.forEach((role) => {
      values.add(`role:${role.value.toLowerCase()}`)
    })
    users.forEach((user) => {
      if (user.name) values.add(user.name)
      if (user.email) values.add(user.email)
      if (user.telegramChatId) values.add(user.telegramChatId)
    })
    return Array.from(values).slice(0, 16)
  }, [roleOptions, users])

  const handleCopyEmail = useCallback(
    async (email: string | null) => {
      if (!email) {
        onError(
          '\u041d\u0435\u0442 email \u0434\u043b\u044f \u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f'
        )
        return
      }

      try {
        await navigator.clipboard.writeText(email)
        onSuccess(
          '\u0410\u0434\u0440\u0435\u0441 \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d'
        )
      } catch (error) {
        console.error('Failed to copy email:', error)
        onError(
          '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c email'
        )
      }
    },
    [onError, onSuccess]
  )

  const getStatusMeta = (user: User) => {
    if (!user.canLogin) {
      return {
        label: '\u0411\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d',
        className: 'bg-red-500/15 text-red-300 border border-red-400/30',
        icon: <XCircle className="h-3.5 w-3.5" />,
      }
    }
    if (user._count.sessions === 0) {
      return {
        label: '\u041f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d',
        className: 'bg-blue-500/15 text-blue-300 border border-blue-400/30',
        icon: <Clock className="h-3.5 w-3.5" />,
      }
    }
    return {
      label: '\u0410\u043a\u0442\u0438\u0432\u0435\u043d',
      className: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30',
      icon: <CheckCircle className="h-3.5 w-3.5" />,
    }
  }

  // Find editing user for modal
  const editingUser = editingId ? users.find((u) => u.id === editingId) : null

  return (
    <div className="panel panel-glass mb-8 rounded-2xl p-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Users className="h-6 w-6 text-emerald-400" />
        <h2 className="text-xl font-semibold text-white">Управление пользователями</h2>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-sky-400/20 bg-sky-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sky-300">
          {visibleTotal} пользователей
        </span>
        <div className="ml-2 flex items-center rounded-xl border border-white/10 bg-white/5 p-1">
          <button
            onClick={() => setViewMode('cards')}
            aria-label="\u0412\u0438\u0434 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0438"
            title="\u0412\u0438\u0434 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0438"
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition ${
              viewMode === 'cards'
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            aria-label="\u0412\u0438\u0434 \u0442\u0430\u0431\u043b\u0438\u0446\u0430"
            title="\u0412\u0438\u0434 \u0442\u0430\u0431\u043b\u0438\u0446\u0430"
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition ${
              viewMode === 'table'
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Table2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Approvals Panel (SuperAdmin only) */}
      {isSuperAdmin && (
        <div className="panel-soft panel-glass mb-6 rounded-2xl p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              Запросы на подтверждение
            </div>
            <button
              onClick={loadApprovals}
              aria-label="Обновить запросы"
              className="p-2 text-gray-400 transition hover:text-white"
              title="Обновить"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          {approvalsLoading ? (
            <div className="text-xs text-gray-500">Загрузка...</div>
          ) : approvals.length > 0 ? (
            <div className="space-y-3">
              {approvals.map((approval) => {
                const approvalTitle =
                  approval.action === 'DEMOTE_ADMIN' ? 'Понижение роли админа' : 'Удаление админа'
                const requester =
                  approval.requestedBy.name || approval.requestedBy.email || 'Неизвестный'
                const targetLabel =
                  approval.targetUser.name || approval.targetUser.email || 'Без имени'
                const needsSecondAdmin = approval.requestedBy.id === session.user.id
                return (
                  <div
                    key={approval.id}
                    className="panel-soft panel-glass flex flex-col gap-3 rounded-xl p-3"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-1">
                        <div className="text-sm text-white">{approvalTitle}</div>
                        <div className="text-xs text-gray-400">
                          {targetLabel} · {ROLE_LABELS[approval.targetUser.role]}
                        </div>
                        {approval.action === 'DEMOTE_ADMIN' && approval.payload?.newRole && (
                          <div className="text-xs text-emerald-400">
                            Новая роль: {ROLE_LABELS[approval.payload.newRole]}
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          {requester} · {formatDate(approval.createdAt)}
                          {needsSecondAdmin && (
                            <span className="ml-2 text-amber-400">Нужен второй админ</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproval(approval.id, 'approve')}
                          disabled={approvalActionId === approval.id || needsSecondAdmin}
                          title={needsSecondAdmin ? 'Нужен второй админ' : undefined}
                          className="inline-flex items-center gap-2 rounded bg-emerald-600 px-3 py-1.5 text-xs text-white transition hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {approvalActionId === approval.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle className="h-3 w-3" />
                          )}
                          Подтвердить
                        </button>
                        <button
                          onClick={() => handleApproval(approval.id, 'reject')}
                          disabled={approvalActionId === approval.id || needsSecondAdmin}
                          title={needsSecondAdmin ? 'Нужен второй админ' : undefined}
                          className="btn-secondary inline-flex items-center gap-2 rounded px-3 py-1.5 text-xs transition disabled:opacity-50"
                        >
                          <XCircle className="h-3 w-3" />
                          Отклонить
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-xs text-gray-500">Нет запросов на подтверждение</div>
          )}
        </div>
      )}

      {/* Create User Form */}
      <div className="panel-soft panel-glass mb-6 rounded-2xl p-4">
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-400">
          <UserPlus className="h-4 w-4 text-emerald-400" />
          Добавить пользователя
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <input
            type="text"
            value={createData.name}
            onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
            className={`${fieldBase} w-full px-3 py-2`}
            aria-label="Имя"
            placeholder="Имя"
          />
          <input
            type="email"
            value={createData.email}
            onChange={(e) => setCreateData({ ...createData, email: e.target.value })}
            className={`${fieldBase} w-full px-3 py-2`}
            aria-label="Email"
            placeholder="email@example.com"
          />
          <select
            value={createData.role}
            onChange={(e) => setCreateData({ ...createData, role: e.target.value as UserRole })}
            disabled={!isSuperAdmin}
            className={`${fieldBase} w-full px-3 py-2 disabled:opacity-60`}
            aria-label="Роль"
          >
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={createData.telegramChatId}
            onChange={(e) => setCreateData({ ...createData, telegramChatId: e.target.value })}
            className={`${fieldBase} w-full px-3 py-2`}
            aria-label="Telegram Chat ID"
            placeholder="Telegram Chat ID"
          />
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-xs text-gray-500">
            <p>Для входа через Google требуется email.</p>
            {!isSuperAdmin && <p className="text-amber-400">Роли назначает только суперадмин.</p>}
          </div>
          <button
            onClick={createUser}
            disabled={creating}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Добавить
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="panel-soft panel-glass mb-6 rounded-2xl p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            {
              '\u0411\u044b\u0441\u0442\u0440\u044b\u0435 \u0444\u0438\u043b\u044c\u0442\u0440\u044b'
            }
          </span>
          {quickFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={filter.onClick}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                filter.active
                  ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                  : 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${fieldBase} w-full py-2 pl-9 pr-3`}
              placeholder="Поиск по имени, email, Telegram"
              list="users-search-suggestions"
              aria-label="Поиск пользователей"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
            className={`${fieldBase} w-full px-3 py-2`}
            aria-label="Фильтр по роли"
          >
            <option value="all">Все роли</option>
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <select
            value={accessFilter}
            onChange={(e) =>
              setAccessFilter(e.target.value as 'all' | 'active' | 'invited' | 'blocked')
            }
            className={`${fieldBase} w-full px-3 py-2`}
            aria-label="Фильтр по статусу"
          >
            <option value="all">Все статусы</option>
            <option value="active">Активные</option>
            <option value="invited">Приглашены</option>
            <option value="blocked">Блокированы</option>
          </select>
          <select
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value as 'all' | 'has' | 'none')}
            className={`${fieldBase} w-full px-3 py-2`}
            aria-label="Фильтр по email"
          >
            <option value="all">Все email</option>
            <option value="has">С email</option>
            <option value="none">Без email</option>
          </select>
          <select
            value={telegramFilter}
            onChange={(e) => setTelegramFilter(e.target.value as 'all' | 'has' | 'none')}
            className={`${fieldBase} w-full px-3 py-2`}
            aria-label="Фильтр по Telegram"
          >
            <option value="all">Все Telegram</option>
            <option value="has">С Telegram</option>
            <option value="none">Без Telegram</option>
          </select>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
          <span>
            Показано {filteredUsers.length} из {visibleTotal}
          </span>
          <div className="flex items-center gap-3">
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="text-emerald-400 transition hover:text-emerald-300"
              >
                Сбросить фильтры
              </button>
            )}
            <button
              onClick={exportUsers}
              className="inline-flex items-center gap-1 text-gray-400 transition hover:text-white"
              title="Экспорт в CSV"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
          </div>
        </div>
        <datalist id="users-search-suggestions">
          {searchSuggestions.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="panel-soft panel-glass sticky bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] z-20 mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 shadow-[0_20px_40px_rgba(2,6,23,0.45)] md:bottom-4">
          <span className="text-sm text-white">Выбрано: {selectedIds.size}</span>
          <select
            value={bulkAction}
            onChange={(e) => {
              setBulkAction(e.target.value as 'role' | 'canLogin' | 'delete' | '')
              setBulkValue('')
            }}
            className={`${fieldBase} px-3 py-2`}
            aria-label="Массовое действие"
          >
            <option value="">Действие</option>
            {isSuperAdmin && <option value="role">Сменить роль</option>}
            <option value="canLogin">Доступ</option>
            <option value="delete">Удалить</option>
          </select>
          {bulkAction === 'role' && (
            <select
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              className={`${fieldBase} px-3 py-2`}
              aria-label="Новая роль"
            >
              <option value="">Выберите роль</option>
              {roleOptions.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          )}
          {bulkAction === 'canLogin' && (
            <select
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              className={`${fieldBase} px-3 py-2`}
              aria-label="Доступ"
            >
              <option value="">Выберите доступ</option>
              <option value="enable">Открыть доступ</option>
              <option value="disable">Закрыть доступ</option>
            </select>
          )}
          <button
            onClick={executeBulkAction}
            disabled={!bulkAction || bulkLoading || selectedIds.size === 0 || bulkDemoteBlocked}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {bulkLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Применить
          </button>
          <button
            onClick={clearSelection}
            className="px-3 py-2 text-gray-400 transition hover:text-white"
          >
            Сбросить
          </button>
          {bulkDemoteBlocked && (
            <span className="text-xs text-amber-400">
              Нельзя понизить последнего админа или суперадмина
            </span>
          )}
        </div>
      )}

      {/* Select All & Pagination */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleSelectAll}
            className={controlBase}
            aria-label="Выбрать всех"
          />
          Выбрать всех
        </label>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Выбрано: {selectedIds.size}</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={prevPage}
                disabled={!hasPrevPage || loading}
                className="rounded p-1 text-gray-400 hover:text-white disabled:opacity-50"
                aria-label="Предыдущая страница"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>
                {page} / {totalPages}
              </span>
              <button
                onClick={nextPage}
                disabled={!hasNextPage || loading}
                className="rounded p-1 text-gray-400 hover:text-white disabled:opacity-50"
                aria-label="Следующая страница"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Users Grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="panel-soft panel-glass h-48 animate-pulse rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 rounded bg-white/10" />
                  <div className="h-3 w-32 rounded bg-white/10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'table' ? (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-sm">
            <thead className="sticky top-0 z-10 bg-white/5 backdrop-blur">
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    className={controlBase}
                    aria-label="\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0432\u0441\u0435\u0445"
                  />
                </th>
                <th className="px-3 py-3 text-left">
                  {'\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c'}
                </th>
                <th className="px-3 py-3 text-left">{'\u0420\u043e\u043b\u044c'}</th>
                <th className="px-3 py-3 text-left">{'\u0421\u0442\u0430\u0442\u0443\u0441'}</th>
                <th className="px-3 py-3 text-left">
                  {
                    '\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u0432\u0445\u043e\u0434'
                  }
                </th>
                <th className="px-3 py-3 text-center">{'\u041a\u0430\u043d\u0430\u043b\u044b'}</th>
                <th className="px-3 py-3 text-right">
                  {'\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044f'}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user) => {
                const status = getStatusMeta(user)
                const isLastAdmin = user.role === 'ADMIN' && adminCount <= 1
                const isLastSuperAdmin = user.role === 'SUPERADMIN' && superAdminCount <= 1
                const deleteLocked =
                  (user.role === 'ADMIN' && (!isSuperAdmin || isLastAdmin)) ||
                  (user.role === 'SUPERADMIN' && (!isSuperAdmin || isLastSuperAdmin))
                const canToggleAccess =
                  user.id !== session.user.id && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN'

                return (
                  <tr key={user.id} className="group">
                    <td className="rounded-l-2xl bg-white/5 px-3 py-3 align-middle group-hover:bg-white/10">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(user.id)}
                        onChange={() => toggleSelect(user.id)}
                        className={controlBase}
                        aria-label={`\u0412\u044b\u0431\u0440\u0430\u0442\u044c ${user.name || user.email || 'user'}`}
                      />
                    </td>
                    <td className="bg-white/5 px-3 py-3 align-middle group-hover:bg-white/10">
                      <div className="flex items-center gap-3">
                        {user.image ? (
                          <img
                            src={user.image}
                            alt={user.name || user.email || 'User'}
                            className="h-9 w-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs text-slate-200">
                            {(user.name || user.email || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-white">
                            {user.name || '\u041d\u0435\u0442 \u0438\u043c\u0435\u043d\u0438'}
                          </div>
                          <div className="truncate text-xs text-slate-400">{user.email || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="bg-white/5 px-3 py-3 align-middle group-hover:bg-white/10">
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200">
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="bg-white/5 px-3 py-3 align-middle group-hover:bg-white/10">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs ${status.className}`}
                      >
                        {status.icon}
                        {status.label}
                      </span>
                    </td>
                    <td
                      className="bg-white/5 px-3 py-3 align-middle text-slate-300 group-hover:bg-white/10"
                      title={user.lastLoginAt ? formatDate(user.lastLoginAt) : '-'}
                    >
                      {formatShortDate(user.lastLoginAt)}
                    </td>
                    <td className="bg-white/5 px-3 py-3 align-middle group-hover:bg-white/10">
                      <div className="flex items-center justify-center gap-2">
                        <span aria-label="Email">
                          <Mail
                            className={`h-4 w-4 ${user.notifyEmail ? 'text-emerald-300' : 'text-slate-600'}`}
                          />
                        </span>
                        <span aria-label="Telegram">
                          <MessageSquare
                            className={`h-4 w-4 ${user.notifyTelegram ? 'text-emerald-300' : 'text-slate-600'}`}
                          />
                        </span>
                        <span aria-label="SMS">
                          <Smartphone
                            className={`h-4 w-4 ${user.notifySms ? 'text-emerald-300' : 'text-slate-600'}`}
                          />
                        </span>
                        <span aria-label="In-app">
                          <Bell
                            className={`h-4 w-4 ${user.notifyInApp ? 'text-emerald-300' : 'text-slate-600'}`}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="rounded-r-2xl bg-white/5 px-3 py-3 text-right align-middle group-hover:bg-white/10">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/users/${user.id}`}
                          className="rounded-lg p-2 text-slate-400 transition hover:text-white"
                          aria-label="\u041f\u0440\u043e\u0444\u0438\u043b\u044c"
                        >
                          <UserIcon className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleCopyEmail(user.email)}
                          className="rounded-lg p-2 text-slate-400 transition hover:text-white"
                          aria-label="\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c email"
                          disabled={!user.email}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        {user.id !== session.user.id && (
                          <button
                            onClick={() => toggleUserAccess(user)}
                            aria-label={
                              user.canLogin
                                ? '\u041e\u0442\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0434\u043e\u0441\u0442\u0443\u043f'
                                : '\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0434\u043e\u0441\u0442\u0443\u043f'
                            }
                            disabled={!canToggleAccess}
                            className="rounded-lg p-2 text-slate-400 transition hover:text-emerald-300 disabled:opacity-60"
                          >
                            {user.canLogin ? (
                              <Lock className="h-4 w-4" />
                            ) : (
                              <Unlock className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => startEdit(user)}
                          aria-label="\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c"
                          className="rounded-lg p-2 text-slate-400 transition hover:text-white"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {user.id !== session.user.id && (
                          <button
                            onClick={() => {
                              if (deleteLocked) return
                              if (
                                confirm(
                                  '\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f?'
                                )
                              ) {
                                onDelete(user.id)
                              }
                            }}
                            aria-label="\u0423\u0434\u0430\u043b\u0438\u0442\u044c"
                            disabled={deleteLocked}
                            className="rounded-lg p-2 text-slate-400 transition hover:text-red-400 disabled:opacity-60"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedUsers.flatMap((user, index) => {
            const prevRole = index > 0 ? sortedUsers[index - 1]?.role : null
            const showHeading = user.role !== prevRole
            const roleCount = groupedUsers[user.role]?.length ?? 0
            const isRoyal = user.role === 'SUPERADMIN'
            const isLastAdmin = user.role === 'ADMIN' && adminCount <= 1
            const isLastSuperAdmin = user.role === 'SUPERADMIN' && superAdminCount <= 1

            const items: React.JSX.Element[] = []
            if (showHeading) {
              items.push(
                <div
                  key={`${user.role}-heading`}
                  className="flex items-center justify-between text-sm text-gray-400 md:col-span-2 xl:col-span-3"
                >
                  <span>{ROLE_LABELS[user.role]}</span>
                  <span className="text-xs text-gray-500">{roleCount}</span>
                </div>
              )
            }

            items.push(
              <UserCard
                key={user.id}
                user={user}
                isSelected={selectedIds.has(user.id)}
                isRoyal={isRoyal}
                isLastAdmin={isLastAdmin}
                isLastSuperAdmin={isLastSuperAdmin}
                isSuperAdmin={isSuperAdmin}
                currentUserId={session.user.id}
                auditOpen={auditOpenId === user.id}
                auditEntries={auditByUser[user.id] || []}
                auditLoading={auditLoading[user.id] || false}
                auditCursor={auditCursorByUser[user.id] || null}
                auditFilters={auditFilters}
                onToggleSelect={toggleSelect}
                onEdit={startEdit}
                onDelete={deleteUser}
                onToggleAccess={toggleUserAccess}
                onToggleAudit={toggleAudit}
                onLoadAudit={loadUserAudit}
                onAuditFiltersChange={setAuditFilters}
              />
            )

            return items
          })}
        </div>
      )}

      {filteredUsers.length === 0 && !loading && (
        <div className="py-8 text-center text-gray-500">
          {users.length === 0 ? 'Нет пользователей' : 'Ничего не найдено'}
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <UserEditModal
          user={editingUser}
          editData={editData}
          saving={savingId === editingUser.id}
          isSuperAdmin={isSuperAdmin}
          isLastAdmin={editingUser.role === 'ADMIN' && adminCount <= 1}
          isLastSuperAdmin={editingUser.role === 'SUPERADMIN' && superAdminCount <= 1}
          onSave={(data) => {
            saveEdit(editingUser.id, data)
          }}
          onCancel={cancelEdit}
        />
      )}
    </div>
  )
}

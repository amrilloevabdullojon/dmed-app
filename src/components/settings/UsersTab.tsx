'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'
import { useUsers } from '@/hooks/useUsers'
import { UserCard } from './UserCard'
import { UserEditModal } from './UserEditModal'
import type { User, UserRole, AdminApproval } from '@/lib/settings-types'
import { ROLE_OPTIONS, ROLE_ORDER, ROLE_LABELS, fieldBase } from '@/lib/settings-types'

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
    editSnapshot,
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
  } = useUsers({ onSuccess, onError })

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

  // Find editing user for modal
  const editingUser = editingId ? users.find((u) => u.id === editingId) : null

  return (
    <div className="panel panel-glass mb-8 rounded-2xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Users className="h-6 w-6 text-emerald-400" />
        <h2 className="text-xl font-semibold text-white">Управление пользователями</h2>
        <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/20 bg-sky-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sky-300">
          {total} пользователей
        </span>
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
            {ROLE_OPTIONS.map((role) => (
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${fieldBase} w-full py-2 pl-9 pr-3`}
              placeholder="Поиск по имени, email, Telegram"
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
            {ROLE_OPTIONS.map((role) => (
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
            Показано {filteredUsers.length} из {total}
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
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="panel-soft panel-glass mb-6 flex flex-wrap items-center gap-3 rounded-2xl p-4">
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
              {ROLE_OPTIONS.map((role) => (
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
          editSnapshot={editSnapshot}
          saving={savingId === editingUser.id}
          isSuperAdmin={isSuperAdmin}
          isLastAdmin={editingUser.role === 'ADMIN' && adminCount <= 1}
          isLastSuperAdmin={editingUser.role === 'SUPERADMIN' && superAdminCount <= 1}
          onEditDataChange={setEditData}
          onSave={() => saveEdit(editingUser.id)}
          onCancel={cancelEdit}
        />
      )}
    </div>
  )
}

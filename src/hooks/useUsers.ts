'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import type {
  User,
  UserRole,
  UserEditData,
  UserCreateData,
  UserAuditEntry,
  AuditFilters,
} from '@/lib/settings-types'
import { userToEditData, getInitialEditData, getInitialCreateData } from '@/lib/settings-types'

interface UseUsersOptions {
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

interface UsersState {
  users: User[]
  loading: boolean
  page: number
  limit: number
  total: number
  searchQuery: string
  roleFilter: 'all' | UserRole
  accessFilter: 'all' | 'active' | 'invited' | 'blocked'
  telegramFilter: 'all' | 'has' | 'none'
  emailFilter: 'all' | 'has' | 'none'
}

export function useUsers({ onSuccess, onError }: UseUsersOptions = {}) {
  const [state, setState] = useState<UsersState>({
    users: [],
    loading: true,
    page: 1,
    limit: 20,
    total: 0,
    searchQuery: '',
    roleFilter: 'all',
    accessFilter: 'all',
    telegramFilter: 'all',
    emailFilter: 'all',
  })

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<UserEditData>(getInitialEditData())
  const [editSnapshot, setEditSnapshot] = useState<UserEditData | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  // Create state
  const [createData, setCreateData] = useState<UserCreateData>(getInitialCreateData())
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'role' | 'canLogin' | 'delete' | ''>('')
  const [bulkValue, setBulkValue] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)

  // Audit state per user
  const [auditByUser, setAuditByUser] = useState<Record<string, UserAuditEntry[]>>({})
  const [auditLoading, setAuditLoading] = useState<Record<string, boolean>>({})
  const [auditCursorByUser, setAuditCursorByUser] = useState<Record<string, string | null>>({})
  const [auditOpenId, setAuditOpenId] = useState<string | null>(null)
  const [auditFilters, setAuditFilters] = useState<AuditFilters>({
    action: 'all',
    field: 'all',
    query: '',
    actor: '',
  })
  const auditRequestByUser = useRef<Record<string, number>>({})

  // Load users with pagination and filters
  const loadUsers = useCallback(
    async (resetPage = false) => {
      setState((prev) => ({ ...prev, loading: true }))
      try {
        const params = new URLSearchParams()
        params.set('page', resetPage ? '1' : String(state.page))
        params.set('limit', String(state.limit))

        if (state.searchQuery) params.set('search', state.searchQuery)
        if (state.roleFilter !== 'all') params.set('role', state.roleFilter)
        if (state.accessFilter !== 'all') params.set('access', state.accessFilter)
        if (state.telegramFilter !== 'all') params.set('telegram', state.telegramFilter)
        if (state.emailFilter !== 'all') params.set('email', state.emailFilter)

        const res = await fetch(`/api/users?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setState((prev) => ({
            ...prev,
            users: data.users || [],
            total: data.total || data.users?.length || 0,
            page: resetPage ? 1 : prev.page,
            loading: false,
          }))
        } else {
          setState((prev) => ({ ...prev, loading: false }))
          onError?.('Не удалось загрузить пользователей')
        }
      } catch (error) {
        console.error('Failed to load users:', error)
        setState((prev) => ({ ...prev, loading: false }))
        onError?.('Ошибка загрузки пользователей')
      }
    },
    [
      state.page,
      state.limit,
      state.searchQuery,
      state.roleFilter,
      state.accessFilter,
      state.telegramFilter,
      state.emailFilter,
      onError,
    ]
  )

  // Clear selection when users change
  useEffect(() => {
    setSelectedIds((prev) => {
      const ids = new Set(state.users.map((user) => user.id))
      return new Set(Array.from(prev).filter((id) => ids.has(id)))
    })
  }, [state.users])

  // Filtered users (client-side filtering for quick response)
  const filteredUsers = useMemo(() => {
    let result = state.users

    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase()
      result = result.filter(
        (user) =>
          user.name?.toLowerCase().includes(query) ||
          user.email?.toLowerCase().includes(query) ||
          user.telegramChatId?.toLowerCase().includes(query)
      )
    }

    if (state.roleFilter !== 'all') {
      result = result.filter((user) => user.role === state.roleFilter)
    }

    if (state.accessFilter !== 'all') {
      if (state.accessFilter === 'active') {
        result = result.filter((user) => user.canLogin && user.lastLoginAt)
      } else if (state.accessFilter === 'invited') {
        result = result.filter((user) => user.canLogin && !user.lastLoginAt)
      } else if (state.accessFilter === 'blocked') {
        result = result.filter((user) => !user.canLogin)
      }
    }

    if (state.telegramFilter !== 'all') {
      result = result.filter((user) =>
        state.telegramFilter === 'has' ? user.telegramChatId : !user.telegramChatId
      )
    }

    if (state.emailFilter !== 'all') {
      result = result.filter((user) =>
        state.emailFilter === 'has' ? user.notifyEmail : !user.notifyEmail
      )
    }

    return result
  }, [
    state.users,
    state.searchQuery,
    state.roleFilter,
    state.accessFilter,
    state.telegramFilter,
    state.emailFilter,
  ])

  // Pagination
  const totalPages = Math.ceil(state.total / state.limit)
  const hasNextPage = state.page < totalPages
  const hasPrevPage = state.page > 1

  const goToPage = useCallback(
    (page: number) => {
      setState((prev) => ({ ...prev, page: Math.max(1, Math.min(page, totalPages)) }))
    },
    [totalPages]
  )

  const nextPage = useCallback(() => {
    if (hasNextPage) goToPage(state.page + 1)
  }, [hasNextPage, state.page, goToPage])

  const prevPage = useCallback(() => {
    if (hasPrevPage) goToPage(state.page - 1)
  }, [hasPrevPage, state.page, goToPage])

  // Setters for filters
  const setSearchQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, searchQuery: query, page: 1 }))
  }, [])

  const setRoleFilter = useCallback((role: 'all' | UserRole) => {
    setState((prev) => ({ ...prev, roleFilter: role, page: 1 }))
  }, [])

  const setAccessFilter = useCallback((access: 'all' | 'active' | 'invited' | 'blocked') => {
    setState((prev) => ({ ...prev, accessFilter: access, page: 1 }))
  }, [])

  const setTelegramFilter = useCallback((telegram: 'all' | 'has' | 'none') => {
    setState((prev) => ({ ...prev, telegramFilter: telegram, page: 1 }))
  }, [])

  const setEmailFilter = useCallback((email: 'all' | 'has' | 'none') => {
    setState((prev) => ({ ...prev, emailFilter: email, page: 1 }))
  }, [])

  // Edit user
  const startEdit = useCallback((user: User) => {
    const data = userToEditData(user)
    setEditingId(user.id)
    setEditData(data)
    setEditSnapshot(data)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditData(getInitialEditData())
    setEditSnapshot(null)
  }, [])

  const saveEdit = useCallback(
    async (userId: string) => {
      if (!editSnapshot) return

      setSavingId(userId)
      try {
        // Find changed fields
        const changes: Record<string, unknown> = {}
        const keys = Object.keys(editData) as (keyof UserEditData)[]
        for (const key of keys) {
          if (editData[key] !== editSnapshot[key]) {
            changes[key] = editData[key]
          }
        }

        if (Object.keys(changes).length === 0) {
          cancelEdit()
          return
        }

        const res = await fetch(`/api/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(changes),
        })

        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          onError?.(data.error || 'Не удалось сохранить изменения')
          return
        }

        onSuccess?.('Пользователь обновлён')
        cancelEdit()
        loadUsers()
      } catch (error) {
        console.error('Failed to save user:', error)
        onError?.('Ошибка сохранения')
      } finally {
        setSavingId(null)
      }
    },
    [editData, editSnapshot, cancelEdit, loadUsers, onSuccess, onError]
  )

  // Create user
  const createUser = useCallback(async () => {
    if (!createData.email.trim()) {
      onError?.('Email обязателен')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createData),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        onError?.(data.error || 'Не удалось создать пользователя')
        return
      }

      onSuccess?.('Пользователь создан')
      setCreateData(getInitialCreateData())
      setShowCreateForm(false)
      loadUsers()
    } catch (error) {
      console.error('Failed to create user:', error)
      onError?.('Ошибка создания пользователя')
    } finally {
      setCreating(false)
    }
  }, [createData, loadUsers, onSuccess, onError])

  // Delete user
  const deleteUser = useCallback(
    async (userId: string) => {
      try {
        const res = await fetch(`/api/users/${userId}`, {
          method: 'DELETE',
        })

        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          onError?.(data.error || 'Не удалось удалить пользователя')
          return
        }

        onSuccess?.('Пользователь удалён')
        loadUsers()
      } catch (error) {
        console.error('Failed to delete user:', error)
        onError?.('Ошибка удаления')
      }
    },
    [loadUsers, onSuccess, onError]
  )

  // Selection
  const toggleSelect = useCallback((userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredUsers.map((u) => u.id)))
  }, [filteredUsers])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setBulkAction('')
    setBulkValue('')
  }, [])

  // Bulk actions
  const executeBulkAction = useCallback(async () => {
    if (!bulkAction || selectedIds.size === 0) return

    setBulkLoading(true)
    try {
      const res = await fetch('/api/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action: bulkAction,
          value: bulkValue,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        onError?.(data.error || 'Не удалось выполнить операцию')
        return
      }

      onSuccess?.(`Обновлено ${data.updated || selectedIds.size} пользователей`)
      clearSelection()
      loadUsers()
    } catch (error) {
      console.error('Bulk action error:', error)
      onError?.('Ошибка массовой операции')
    } finally {
      setBulkLoading(false)
    }
  }, [bulkAction, bulkValue, selectedIds, clearSelection, loadUsers, onSuccess, onError])

  // Load audit for user
  const loadUserAudit = useCallback(
    async (userId: string, mode: 'replace' | 'more' = 'replace') => {
      const requestId = (auditRequestByUser.current[userId] || 0) + 1
      auditRequestByUser.current[userId] = requestId

      setAuditLoading((prev) => ({ ...prev, [userId]: true }))

      try {
        const params = new URLSearchParams()
        if (mode === 'more' && auditCursorByUser[userId]) {
          params.set('cursor', auditCursorByUser[userId]!)
        }
        if (auditFilters.action !== 'all') params.set('action', auditFilters.action)
        if (auditFilters.field !== 'all') params.set('field', auditFilters.field)
        if (auditFilters.query) params.set('q', auditFilters.query)
        if (auditFilters.actor) params.set('actor', auditFilters.actor)
        params.set('take', '20')

        const res = await fetch(`/api/users/${userId}/audit?${params.toString()}`)
        if (requestId !== auditRequestByUser.current[userId]) return

        if (res.ok) {
          const data = await res.json()
          setAuditByUser((prev) => ({
            ...prev,
            [userId]: mode === 'more' ? [...(prev[userId] || []), ...data.entries] : data.entries,
          }))
          setAuditCursorByUser((prev) => ({
            ...prev,
            [userId]: data.nextCursor || null,
          }))
        }
      } catch (error) {
        console.error('Failed to load audit:', error)
      } finally {
        if (requestId === auditRequestByUser.current[userId]) {
          setAuditLoading((prev) => ({ ...prev, [userId]: false }))
        }
      }
    },
    [auditCursorByUser, auditFilters]
  )

  const toggleAudit = useCallback(
    (userId: string) => {
      if (auditOpenId === userId) {
        setAuditOpenId(null)
      } else {
        setAuditOpenId(userId)
        if (!auditByUser[userId]) {
          loadUserAudit(userId)
        }
      }
    },
    [auditOpenId, auditByUser, loadUserAudit]
  )

  // Export users to CSV
  const exportUsers = useCallback(() => {
    const headers = ['ID', 'Имя', 'Email', 'Роль', 'Telegram', 'Доступ', 'Создан']
    const rows = filteredUsers.map((user) => [
      user.id,
      user.name || '',
      user.email || '',
      user.role,
      user.telegramChatId || '',
      user.canLogin ? 'Да' : 'Нет',
      new Date(user.createdAt).toLocaleDateString('ru-RU'),
    ])

    const BOM = '\uFEFF'
    const csv =
      BOM +
      [headers.join(','), ...rows.map((row) => row.map((v) => `"${v}"`).join(','))].join('\r\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `users_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [filteredUsers])

  return {
    // State
    users: state.users,
    filteredUsers,
    loading: state.loading,
    total: state.total,

    // Pagination
    page: state.page,
    limit: state.limit,
    totalPages,
    hasNextPage,
    hasPrevPage,
    goToPage,
    nextPage,
    prevPage,

    // Filters
    searchQuery: state.searchQuery,
    roleFilter: state.roleFilter,
    accessFilter: state.accessFilter,
    telegramFilter: state.telegramFilter,
    emailFilter: state.emailFilter,
    setSearchQuery,
    setRoleFilter,
    setAccessFilter,
    setTelegramFilter,
    setEmailFilter,

    // Edit
    editingId,
    editData,
    editSnapshot,
    savingId,
    setEditData,
    startEdit,
    cancelEdit,
    saveEdit,

    // Create
    createData,
    creating,
    showCreateForm,
    setCreateData,
    setShowCreateForm,
    createUser,

    // Delete
    deleteUser,

    // Selection & Bulk
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

    // Audit
    auditOpenId,
    auditByUser,
    auditLoading,
    auditCursorByUser,
    auditFilters,
    setAuditFilters,
    toggleAudit,
    loadUserAudit,

    // Actions
    loadUsers,
    exportUsers,
  }
}

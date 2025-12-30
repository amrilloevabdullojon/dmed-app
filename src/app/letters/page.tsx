'use client'

import { useSession } from 'next-auth/react'
import { Header } from '@/components/Header'
import { VirtualLetterList } from '@/components/VirtualLetterList'
import { StatusBadge } from '@/components/StatusBadge'
import { CardsSkeleton, TableSkeleton } from '@/components/Skeleton'
import { LetterPreview } from '@/components/LetterPreview'
import { useKeyboard } from '@/hooks/useKeyboard'
import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { LetterStatus } from '@prisma/client'
import { STATUS_LABELS, formatDate, getDaysUntilDeadline, pluralizeDays, isDoneStatus } from '@/lib/utils'
import { LETTER_TYPES } from '@/lib/constants'
import {
  Search,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LayoutGrid,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  CheckSquare,
  Square,
  Trash2,
  UserPlus,
  X,
  Download,
  Eye,
  Keyboard,
  FileText,
  Users,
  Star,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface Letter {
  id: string
  number: string
  org: string
  date: string
  deadlineDate: string
  status: LetterStatus
  type: string | null
  content: string | null
  priority: number
  jiraLink: string | null
  owner: {
    id: string
    name: string | null
    email: string | null
  } | null
  _count: {
    comments: number
    watchers: number
  }
}

interface User {
  id: string
  name: string | null
  email: string | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const STATUSES: (LetterStatus | 'all')[] = [
  'all',
  'NOT_REVIEWED',
  'ACCEPTED',
  'IN_PROGRESS',
  'CLARIFICATION',
  'READY',
  'DONE',
]

const FILTERS = [
  { value: '', label: 'Все письма', icon: List },
  { value: 'favorites', label: 'Избранное', icon: Star },
  { value: 'overdue', label: 'Просроченные', icon: AlertTriangle },
  { value: 'urgent', label: 'Срочные (3 дня)', icon: Clock },
  { value: 'active', label: 'В работе', icon: XCircle },
  { value: 'done', label: 'Выполненные', icon: CheckCircle },
]

type ViewMode = 'cards' | 'table'
type SortField = 'created' | 'deadline' | 'date' | 'number' | 'org' | 'status' | 'priority'

function LettersPageContent() {
  const { data: session, status: authStatus } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [letters, setLetters] = useState<Letter[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LetterStatus | 'all'>(
    (searchParams.get('status') as LetterStatus) || 'all'
  )
  const [quickFilter, setQuickFilter] = useState(searchParams.get('filter') || '')
  const [ownerFilter, setOwnerFilter] = useState(searchParams.get('owner') || '')
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [sortBy, setSortBy] = useState<SortField>('created')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  // Массовый выбор
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'status' | 'owner' | 'delete' | null>(null)
  const [bulkValue, setBulkValue] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)

  // Горячие клавиши и быстрый просмотр
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const lettersAbortRef = useRef<AbortController | null>(null)
  const lettersRequestIdRef = useRef(0)

  // Горячие клавиши
  useKeyboard({
    onDown: useCallback(() => {
      setFocusedIndex((prev) => Math.min(prev + 1, letters.length - 1))
    }, [letters.length]),
    onUp: useCallback(() => {
      setFocusedIndex((prev) => Math.max(prev - 1, 0))
    }, []),
    onEnter: useCallback(() => {
      const letter = letters[focusedIndex]
      if (letter) {
        router.push(`/letters/${letter.id}`)
      }
    }, [letters, focusedIndex, router]),
    onSpace: useCallback(() => {
      const letter = letters[focusedIndex]
      if (letter) {
        toggleSelect(letter.id)
      }
    }, [letters, focusedIndex]),
    onEscape: useCallback(() => {
      if (previewId) {
        setPreviewId(null)
      } else if (selectedIds.size > 0) {
        setSelectedIds(new Set())
        setBulkAction(null)
        setBulkValue('')
      }
    }, [previewId, selectedIds.size]),
    onSearch: useCallback(() => {
      searchInputRef.current?.focus()
    }, []),
    onNew: useCallback(() => {
      router.push('/letters/new')
    }, [router]),
    onSelectAll: useCallback(() => {
      if (selectedIds.size === letters.length) {
        setSelectedIds(new Set())
      } else {
        setSelectedIds(new Set(letters.map((l) => l.id)))
      }
    }, [letters, selectedIds.size]),
    enabled: !previewId,
  })

  useEffect(() => {
    if (session) {
      loadLetters()
    }
  }, [session, statusFilter, quickFilter, ownerFilter, typeFilter, page, sortBy, sortOrder])

  useEffect(() => {
    if (session) {
      loadUsers()
    }
  }, [session])

  // Debounced search с индикатором
  useEffect(() => {
    if (search) setIsSearching(true)
    const timer = setTimeout(() => {
      if (session) loadLetters(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const loadLetters = async (showLoading = true) => {
    const requestId = ++lettersRequestIdRef.current
    if (showLoading) setLoading(true)

    const controller = new AbortController()
    if (lettersAbortRef.current) {
      lettersAbortRef.current.abort()
    }
    lettersAbortRef.current = controller

    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '50')
      params.set('sortBy', sortBy)
      params.set('sortOrder', sortOrder)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (quickFilter) params.set('filter', quickFilter)
      if (ownerFilter) params.set('owner', ownerFilter)
      if (typeFilter) params.set('type', typeFilter)
      if (search) params.set('search', search)

      const res = await fetch(`/api/letters?${params}`, { signal: controller.signal })
      if (!res.ok) throw new Error('Failed to load letters')
      const data = await res.json()
      if (requestId !== lettersRequestIdRef.current) return

      setLetters(data.letters || [])
      setPagination(data.pagination)
      setSelectedIds(new Set())
    } catch (error) {
      if (controller.signal.aborted) return
      console.error('Failed to load letters:', error)
      toast.error('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043f\u0438\u0441\u044c\u043c\u0430')
    } finally {
      if (requestId === lettersRequestIdRef.current) {
        setLoading(false)
        setIsSearching(false)
      }
    }
  }

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Failed to load users:', error)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
    setPage(1)
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === letters.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(letters.map((l) => l.id)))
    }
  }

  const executeBulkAction = async () => {
    if (!bulkAction || selectedIds.size === 0) return

    if (bulkAction === 'delete') {
      if (!confirm(`Удалить ${selectedIds.size} писем? Это действие нельзя отменить.`)) {
        return
      }
    }

    setBulkLoading(true)
    try {
      const res = await fetch('/api/letters/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action: bulkAction,
          value: bulkValue,
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success(`Обновлено ${data.updated} писем`)
        setBulkAction(null)
        setBulkValue('')
        setSelectedIds(new Set())
        loadLetters()
      } else {
        toast.error(data.error || 'Ошибка')
      }
    } catch (error) {
      console.error('Bulk action error:', error)
      toast.error('Ошибка при выполнении')
    } finally {
      setBulkLoading(false)
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ArrowUpDown className="w-4 h-4 text-slate-400/70" />
    return sortOrder === 'asc'
      ? <ArrowUp className="w-4 h-4 text-teal-300" />
      : <ArrowDown className="w-4 h-4 text-teal-300" />
  }

  const getDeadlineInfo = (letter: Letter) => {
    const daysLeft = getDaysUntilDeadline(letter.deadlineDate)
    const isDone = isDoneStatus(letter.status)

    if (isDone) {
      return { text: 'Выполнено', className: 'text-teal-300' }
    }
    if (daysLeft < 0) {
      return { text: `Просрочено на ${Math.abs(daysLeft)} ${pluralizeDays(daysLeft)}`, className: 'text-red-400' }
    }
    if (daysLeft <= 2) {
      return { text: `${daysLeft} ${pluralizeDays(daysLeft)}`, className: 'text-yellow-400' }
    }
    return { text: `${daysLeft} ${pluralizeDays(daysLeft)}`, className: 'text-slate-300/70' }
  }

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <p className="text-slate-300/70">Пожалуйста, войдите в систему</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen app-shell">
      <Header />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pageIn relative">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-semibold text-white">Письма</h1>
            {pagination && (
              <p className="text-muted text-sm mt-1">
                Всего: {pagination.total} писем
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/export?${new URLSearchParams({
                ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
                ...(quickFilter ? { filter: quickFilter } : {}),
                ...(ownerFilter ? { owner: ownerFilter } : {}),
                ...(typeFilter ? { type: typeFilter } : {}),
                ...(selectedIds.size > 0 ? { ids: Array.from(selectedIds).join(',') } : {}),
              }).toString()}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition btn-secondary"
            >
              <Download className="w-5 h-5" />
              Экспорт
            </a>
            <Link
              href="/letters/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition btn-primary"
            >
              <Plus className="w-5 h-5" />
              Новое письмо
            </Link>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="panel panel-soft rounded-2xl p-4 mb-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-teal-300" />
              <span className="text-white font-medium">
                Выбрано: {selectedIds.size}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-1">
              <select
                value={bulkAction || ''}
                onChange={(e) => {
                  const value = e.target.value as 'status' | 'owner' | 'delete' | ''
                  setBulkAction(value || null)
                  setBulkValue('')
                }}
                className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white"
              >
                <option value="">Выберите действие</option>
                <option value="status">Изменить статус</option>
                <option value="owner">Назначить ответственного</option>
                {session.user.role === 'ADMIN' && (
                  <option value="delete">Удалить</option>
                )}
              </select>

              {bulkAction === 'status' && (
                <select
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white"
                >
                  <option value="">Выберите статус</option>
                  {STATUSES.filter((s) => s !== 'all').map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status as LetterStatus]}
                    </option>
                  ))}
                </select>
              )}

              {bulkAction === 'owner' && (
                <select
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white"
                >
                  <option value="">Выберите ответственного</option>
                  <option value="">Снять ответственного</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email}
                    </option>
                  ))}
                </select>
              )}

              {bulkAction && (bulkAction === 'delete' || bulkValue) && (
                <button
                  onClick={executeBulkAction}
                  disabled={bulkLoading}
                  className={`px-4 py-2 rounded-lg text-white transition flex items-center gap-2 ${
                    bulkAction === 'delete'
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-emerald-500 hover:bg-emerald-600'
                  } disabled:opacity-50`}
                >
                  {bulkLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : bulkAction === 'delete' ? (
                    <Trash2 className="w-4 h-4" />
                  ) : bulkAction === 'owner' ? (
                    <UserPlus className="w-4 h-4" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Применить
                </button>
              )}
            </div>

            <button
              onClick={() => {
                setSelectedIds(new Set())
                setBulkAction(null)
                setBulkValue('')
              }}
              className="p-2 text-slate-300 hover:text-white transition hover:bg-white/10 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2 mb-4 p-2 rounded-2xl panel-soft panel-glass">
          {FILTERS.map((filter) => {
            const Icon = filter.icon
            return (
              <button
                key={filter.value}
                onClick={() => {
                  setQuickFilter(filter.value)
                  setStatusFilter('all')
                  setPage(1)
                }}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition app-chip ${quickFilter === filter.value ? 'app-chip-active' : ''}`}
              >
                <Icon className="w-4 h-4" />
                {filter.label}
              </button>
            )
          })}
        </div>

        {/* Filters Row */}
        <div className="panel panel-soft panel-glass rounded-2xl p-4 flex flex-col sm:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            {isSearching ? (
              <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-teal-400 animate-spin" />
            ) : (
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            )}
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Поиск по номеру, организации, Jira, ответу... (нажмите /)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-400 focus:outline-none focus:border-teal-400/80 focus:ring-1 focus:ring-teal-400/40"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as LetterStatus | 'all')
                setQuickFilter('')
                setPage(1)
              }}
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-teal-400/80 focus:ring-1 focus:ring-teal-400/40"
            >
              <option value="all">Все статусы</option>
              {STATUSES.filter((s) => s !== 'all').map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status as LetterStatus]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-400" />
            <select
              value={ownerFilter}
              onChange={(e) => {
                setOwnerFilter(e.target.value)
                setPage(1)
              }}
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-teal-400/80 focus:ring-1 focus:ring-teal-400/40"
            >
              <option value="">{'\u0412\u0441\u0435 \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u0438'}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value)
                setPage(1)
              }}
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-teal-400/80 focus:ring-1 focus:ring-teal-400/40"
            >
              <option value="">{'\u0412\u0441\u0435 \u0442\u0438\u043f\u044b'}</option>
              {LETTER_TYPES.filter((item) => item.value !== 'all').map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {/* View toggle */}
          <div className="flex rounded-xl p-1 panel-soft panel-glass">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition ${viewMode === 'table' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white'}`}
              title="Таблица"
            >
              <List className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-lg transition ${viewMode === 'cards' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white'}`}
              title="Карточки"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>

          {/* Keyboard shortcuts help */}
          <div className="relative">
            <button
              onClick={() => setShowShortcuts(!showShortcuts)}
              className={`p-2 rounded-lg transition ${showShortcuts ? 'bg-white/10 text-white' : 'bg-white/5 text-slate-300 hover:text-white'}`}
              title="Горячие клавиши"
            >
              <Keyboard className="w-5 h-5" />
            </button>
            {showShortcuts && (
              <div className="absolute right-0 top-full mt-2 p-4 panel panel-glass rounded-xl shadow-xl z-30 w-64">
                <h4 className="text-white font-medium mb-3">Горячие клавиши</h4>
                <div className="text-xs text-slate-300/70 space-y-2">
                  <div className="flex justify-between"><span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">J</kbd> / <kbd className="px-1.5 py-0.5 bg-white/10 rounded">↓</kbd></span><span>Вниз</span></div>
                  <div className="flex justify-between"><span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">K</kbd> / <kbd className="px-1.5 py-0.5 bg-white/10 rounded">↑</kbd></span><span>Вверх</span></div>
                  <div className="flex justify-between"><span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">Enter</kbd></span><span>Открыть</span></div>
                  <div className="flex justify-between"><span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">Space</kbd></span><span>Выбрать</span></div>
                  <div className="flex justify-between"><span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">Esc</kbd></span><span>Отмена</span></div>
                  <div className="flex justify-between"><span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">/</kbd></span><span>Поиск</span></div>
                  <div className="flex justify-between"><span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">N</kbd></span><span>Новое письмо</span></div>
                  <div className="flex justify-between"><span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 bg-white/10 rounded">A</kbd></span><span>Выбрать все</span></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          viewMode === 'cards' ? (
            <CardsSkeleton count={9} />
          ) : (
            <TableSkeleton rows={10} />
          )
        ) : letters.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-300/70">Письма не найдены</p>
          </div>
        ) : viewMode === 'cards' ? (
          <VirtualLetterList
            letters={letters}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        ) : (
          /* Table View */
          <div className="panel panel-glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/5 backdrop-blur border-b border-white/10">
                    <th className="px-4 py-3 text-left w-10">
                      <button
                        onClick={toggleSelectAll}
                        className={`p-1 rounded ${
                          selectedIds.size === letters.length && letters.length > 0
                            ? 'text-teal-300'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {selectedIds.size === letters.length && letters.length > 0 ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('number')}
                        className="flex items-center gap-1 text-sm font-medium text-slate-300/80 hover:text-white"
                      >
                        Номер
                        <SortIcon field="number" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('org')}
                        className="flex items-center gap-1 text-sm font-medium text-slate-300/80 hover:text-white"
                      >
                        Организация
                        <SortIcon field="org" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('date')}
                        className="flex items-center gap-1 text-sm font-medium text-slate-300/80 hover:text-white"
                      >
                        Дата
                        <SortIcon field="date" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('deadline')}
                        className="flex items-center gap-1 text-sm font-medium text-slate-300/80 hover:text-white"
                      >
                        Дедлайн
                        <SortIcon field="deadline" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('status')}
                        className="flex items-center gap-1 text-sm font-medium text-slate-300/80 hover:text-white"
                      >
                        Статус
                        <SortIcon field="status" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300/70">
                      Тип
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300/70">
                      Ответственный
                    </th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 stagger-animation">
                  {letters.map((letter, index) => {
                    const deadlineInfo = getDeadlineInfo(letter)
                    const isSelected = selectedIds.has(letter.id)
                    const isFocused = index === focusedIndex
                    return (
                      <tr
                        key={letter.id}
                        className={`table-row cursor-pointer ${isSelected ? 'table-row-selected' : ''} ${isFocused ? 'ring-2 ring-teal-400/40 ring-inset' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleSelect(letter.id)
                            }}
                            className={`p-1 rounded ${
                              isSelected
                                ? 'text-teal-300'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={() => router.push(`/letters/${letter.id}`)}
                        >
                          <span className="font-mono text-teal-300">
                            №{letter.number}
                          </span>
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={() => router.push(`/letters/${letter.id}`)}
                        >
                          <div className="max-w-xs truncate text-white">
                            {letter.org}
                          </div>
                        </td>
                        <td
                          className="px-4 py-3 text-slate-300/70 text-sm"
                          onClick={() => router.push(`/letters/${letter.id}`)}
                        >
                          {formatDate(letter.date)}
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={() => router.push(`/letters/${letter.id}`)}
                        >
                          <div className="text-sm">
                            <div className="text-slate-300/70">{formatDate(letter.deadlineDate)}</div>
                            <div className={`text-xs ${deadlineInfo.className}`}>
                              {deadlineInfo.text}
                            </div>
                          </div>
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={() => router.push(`/letters/${letter.id}`)}
                        >
                          <StatusBadge status={letter.status} size="sm" />
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={() => router.push(`/letters/${letter.id}`)}
                        >
                          {letter.type && (
                            <span className="text-xs px-2 py-1 rounded-full data-pill">
                              {letter.type}
                            </span>
                          )}
                        </td>
                        <td
                          className="px-4 py-3 text-slate-300/70 text-sm"
                          onClick={() => router.push(`/letters/${letter.id}`)}
                        >
                          {letter.owner?.name || letter.owner?.email?.split('@')[0] || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setPreviewId(letter.id)
                            }}
                            className="p-1 text-slate-400 hover:text-white transition"
                            title="Быстрый просмотр"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-slate-300/70 text-sm">
              Показано {((page - 1) * 50) + 1}-{Math.min(page * 50, pagination.total)} из {pagination.total}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 bg-white/5 border border-white/10 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <span className="text-slate-300/70 px-2">
                {page} / {pagination.totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="p-2 bg-white/5 border border-white/10 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Letter Preview Panel */}
      <LetterPreview
        letterId={previewId}
        onClose={() => setPreviewId(null)}
      />
    </div>
  )
}

export default function LettersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500"></div>
      </div>
    }>
      <LettersPageContent />
    </Suspense>
  )
}

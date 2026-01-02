'use client'

import { useSession } from 'next-auth/react'
import { Header } from '@/components/Header'
import { VirtualLetterList } from '@/components/VirtualLetterList'
import { StatusBadge } from '@/components/StatusBadge'
import { CardsSkeleton, TableSkeleton } from '@/components/Skeleton'
import { LetterPreview } from '@/components/LetterPreview'
import { BulkCreateLetters } from '@/components/BulkCreateLetters'
import { useConfirmDialog } from '@/components/ConfirmDialog'
import { useKeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp'
import { useKeyboard } from '@/hooks/useKeyboard'
import { useDebouncedCallback } from '@/hooks/useDebounce'
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
  ListPlus,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'

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
  useAuthRedirect(authStatus)
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
  const [isMobile, setIsMobile] = useState(false)
  const [showBulkCreate, setShowBulkCreate] = useState(false)
  const { confirm: confirmDialog, Dialog } = useConfirmDialog()
  const {
    isOpen: shortcutsOpen,
    open: openShortcuts,
    close: closeShortcuts,
    KeyboardShortcutsDialog,
  } = useKeyboardShortcutsHelp()

  // Массовый выбор
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'status' | 'owner' | 'delete' | null>(null)
  const [bulkValue, setBulkValue] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)

  // Selection helpers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === letters.length) {
        return new Set()
      }
      return new Set(letters.map((l) => l.id))
    })
  }, [letters])
  // Горячие клавиши и быстрый просмотр
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [previewId, setPreviewId] = useState<string | null>(null)
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
    }, [letters, focusedIndex, toggleSelect]),
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
      toggleSelectAll()
    }, [toggleSelectAll]),
    enabled: !previewId && !showBulkCreate && !shortcutsOpen,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!showBulkCreate) {
      document.body.style.overflow = ''
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowBulkCreate(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showBulkCreate])

  useEffect(() => {
    if (isMobile && viewMode !== 'cards') {
      setViewMode('cards')
    }
  }, [isMobile, viewMode])

  const loadLetters = useCallback(async (showLoading = true) => {
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
  }, [
    page,
    sortBy,
    sortOrder,
    statusFilter,
    quickFilter,
    ownerFilter,
    typeFilter,
    search,
  ])

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Failed to load users:', error)
    }
  }, [])

  const debouncedSearch = useDebouncedCallback(() => {
    if (session) loadLetters(false)
  }, 300)

  const handleBulkCreateSuccess = useCallback(() => {
    setShowBulkCreate(false)
    loadLetters()
  }, [loadLetters])

  useEffect(() => {
    if (session) {
      loadLetters()
    }
  }, [session, loadLetters])

  useEffect(() => {
    if (session) {
      loadUsers()
    }
  }, [session, loadUsers])

  // Debounced search ? D,DD'D,DDD_D_D
  useEffect(() => {
    if (!session) return
    if (search) setIsSearching(true)
    debouncedSearch()
  }, [search, session, debouncedSearch])

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
    setPage(1)
  }

  const runBulkAction = useCallback(async () => {
    if (!bulkAction || selectedIds.size === 0) return

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
        toast.error(data.error || '\u041e\u0448\u0438\u0431\u043a\u0430')
      }
    } catch (error) {
      console.error('Bulk action error:', error)
      toast.error('\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u0440\u0438 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0438 \u043e\u043f\u0435\u0440\u0430\u0446\u0438\u0438')
    } finally {
      setBulkLoading(false)
    }
  }, [bulkAction, bulkValue, loadLetters, selectedIds])

  const executeBulkAction = useCallback(() => {
    if (!bulkAction || selectedIds.size === 0) return

    if (bulkAction === 'delete') {
      confirmDialog({
        title: '\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043f\u0438\u0441\u044c\u043c\u0430?',
        message: `\u0423\u0434\u0430\u043b\u0438\u0442\u044c ${selectedIds.size} \u043f\u0438\u0441\u0435\u043c? \u042d\u0442\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435\u043b\u044c\u0437\u044f \u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c.`,
        confirmText: '\u0423\u0434\u0430\u043b\u0438\u0442\u044c',
        variant: 'danger',
        onConfirm: runBulkAction,
      })
      return
    }

    runBulkAction()
  }, [bulkAction, confirmDialog, runBulkAction, selectedIds])

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

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-pageIn relative">
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <a
              href={`/api/export?${new URLSearchParams({
                ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
                ...(quickFilter ? { filter: quickFilter } : {}),
                ...(ownerFilter ? { owner: ownerFilter } : {}),
                ...(typeFilter ? { type: typeFilter } : {}),
                ...(selectedIds.size > 0 ? { ids: Array.from(selectedIds).join(',') } : {}),
              }).toString()}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition btn-secondary w-full sm:w-auto"
            >
              <Download className="w-5 h-5" />
              Экспорт
            </a>
            <button
              type="button"
              onClick={() => setShowBulkCreate(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition btn-secondary w-full sm:w-auto"
            >
              <ListPlus className="w-5 h-5" />
              Массовое создание писем
            </button>
            <Link
              href="/letters/new"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition btn-primary w-full sm:w-auto"
            >
              <Plus className="w-5 h-5" />
              Новое письмо
            </Link>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="panel panel-soft rounded-2xl p-4 mb-4 flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-teal-300" />
              <span className="text-white font-medium">
                Выбрано: {selectedIds.size}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 w-full">
              <select
                value={bulkAction || ''}
                onChange={(e) => {
                  const value = e.target.value as 'status' | 'owner' | 'delete' | ''
                  setBulkAction(value || null)
                  setBulkValue('')
                }}
                className="w-full sm:w-auto px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white"
                aria-label="Массовое действие"
              >
                <option value="">Выберите действие</option>
                <option value="status">Изменить статус</option>
                <option value="owner">Назначить ответственного</option>
                {(session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN') && (
                  <option value="delete">Удалить</option>
                )}
              </select>

              {bulkAction === 'status' && (
                <select
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white"
                  aria-label="Статус для массового действия"
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
                  className="w-full sm:w-auto px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white"
                  aria-label="Исполнитель для массового действия"
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
                  className={`w-full sm:w-auto px-4 py-2 rounded-lg text-white transition flex items-center justify-center gap-2 ${
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
              className="p-2 text-slate-300 hover:text-white transition hover:bg-white/10 rounded-lg self-start lg:self-auto"
              aria-label="Скрыть массовые действия"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Quick Filters */}
        <div className="flex gap-2 mb-4 p-2 rounded-2xl panel-soft panel-glass overflow-x-auto no-scrollbar sm:flex-wrap">
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
        <div className="panel panel-soft panel-glass rounded-2xl p-4 flex flex-col sm:flex-row gap-4 mb-6 relative z-20">
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
              aria-label="Поиск"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                aria-label="Очистить поиск"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-5 h-5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as LetterStatus | 'all')
                setQuickFilter('')
                setPage(1)
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-teal-400/80 focus:ring-1 focus:ring-teal-400/40"
              aria-label="Фильтр по статусу"
            >
              <option value="all">Все статусы</option>
              {STATUSES.filter((s) => s !== 'all').map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status as LetterStatus]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Users className="w-5 h-5 text-slate-400" />
            <select
              value={ownerFilter}
              onChange={(e) => {
                setOwnerFilter(e.target.value)
                setPage(1)
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-teal-400/80 focus:ring-1 focus:ring-teal-400/40"
              aria-label="Фильтр по исполнителю"
            >
              <option value="">{'\u0412\u0441\u0435 \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u0438'}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <FileText className="w-5 h-5 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value)
                setPage(1)
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-teal-400/80 focus:ring-1 focus:ring-teal-400/40"
              aria-label="Фильтр по типу"
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
          <div className="hidden sm:flex rounded-xl p-1 panel-soft panel-glass">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition ${viewMode === 'table' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white'}`}
              title="Таблица"
              aria-label="Табличный вид"
            >
              <List className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-lg transition ${viewMode === 'cards' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white'}`}
              title="Карточки"
              aria-label="Карточки"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>

          {/* Keyboard shortcuts help */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => (shortcutsOpen ? closeShortcuts() : openShortcuts())}
              className={`p-2 rounded-lg transition ${shortcutsOpen ? 'bg-white/10 text-white' : 'bg-white/5 text-slate-300 hover:text-white'}`}
              title="Горячие клавиши"
              aria-label="Горячие клавиши"
            >
              <Keyboard className="w-5 h-5" />
            </button>
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
                        aria-label="Выбрать все письма"
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
                        className={`app-row cursor-pointer ${isSelected ? 'app-row-selected' : ''} ${isFocused ? 'ring-2 ring-teal-400/40 ring-inset' : ''}`}
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
                            aria-label={`Выбрать письмо ${letter.number}`}
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
                            aria-label="Быстрый просмотр"
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
                aria-label="Предыдущая страница"
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
                aria-label="Следующая страница"
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

      {showBulkCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowBulkCreate(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Массовое создание писем"
            className="relative z-10 max-h-[90vh] w-full max-w-6xl overflow-auto px-4 sm:px-6"
          >
            <BulkCreateLetters
              onClose={() => setShowBulkCreate(false)}
              onSuccess={handleBulkCreateSuccess}
              pageHref="/letters/bulk"
            />
          </div>
        </div>
      )}

      {KeyboardShortcutsDialog}
      {Dialog}
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

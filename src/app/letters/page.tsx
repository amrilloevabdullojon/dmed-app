'use client'

import { useSession } from 'next-auth/react'
import { Header } from '@/components/Header'
import { VirtualLetterList, VirtualLetterTable } from '@/components/VirtualLetterList'
import { CardsSkeleton, TableSkeleton } from '@/components/Skeleton'
import { LetterPreview } from '@/components/LetterPreview'
import { BulkCreateLetters } from '@/components/BulkCreateLetters'
import { useConfirmDialog } from '@/components/ConfirmDialog'
import { useKeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp'
import { useKeyboard } from '@/hooks/useKeyboard'
import { useDebouncedCallback } from '@/hooks/useDebounce'
import { usePagination } from '@/hooks/usePagination'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useEffect, useState, useRef, useCallback, useMemo, Suspense, startTransition } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { LetterStatus } from '@prisma/client'
import { STATUS_LABELS, getWorkingDaysUntilDeadline, pluralizeDays } from '@/lib/utils'
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
  Keyboard,
  FileText,
  Users,
  Star,
  ListPlus,
  Kanban,
  Bookmark,
  ChevronDown,
  UserCheck,
  UserMinus,
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/Toast'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { LetterKanban } from '@/components/LetterKanban'

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
  { value: 'mine', label: 'Мои письма', icon: UserCheck },
  { value: 'unassigned', label: 'Без исполнителя', icon: UserMinus },
  { value: 'favorites', label: 'Избранные', icon: Star },
  { value: 'overdue', label: 'Просроченные', icon: AlertTriangle },
  { value: 'urgent', label: 'Срочно (3 раб. дня)', icon: Clock },
  { value: 'active', label: 'В работе', icon: XCircle },
  { value: 'done', label: 'Завершённые', icon: CheckCircle },
]

type ViewMode = 'cards' | 'table' | 'kanban'
type SortField = 'created' | 'deadline' | 'date' | 'number' | 'org' | 'status' | 'priority'

type SavedView = {
  id: string
  name: string
  filters: {
    search: string
    status: LetterStatus | 'all'
    quickFilter: string
    owner: string
    type: string
    sortBy: SortField
    sortOrder: 'asc' | 'desc'
    viewMode: ViewMode
  }
}

type SearchSuggestion = {
  id: string
  number: string
  org: string
  status: LetterStatus
  deadlineDate: string
}

const pluralizeLetters = (count: number) => {
  const value = Math.abs(count) % 100
  const lastDigit = value % 10

  if (value > 10 && value < 20) return 'писем'
  if (lastDigit === 1) return 'письмо'
  if (lastDigit > 1 && lastDigit < 5) return 'письма'
  return 'писем'
}

function LettersPageContent() {
  const { data: session, status: authStatus } = useSession()
  useAuthRedirect(authStatus)
  const toast = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [letters, setLetters] = useState<Letter[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [search, setSearch] = useState('')
  const searchRef = useRef(search)
  const querySyncRef = useRef<string | null>(searchParams.toString())
  const [statusFilter, setStatusFilter] = useState<LetterStatus | 'all'>(
    (searchParams.get('status') as LetterStatus) || 'all'
  )
  const [quickFilter, setQuickFilter] = useState(searchParams.get('filter') || '')
  const [ownerFilter, setOwnerFilter] = useState(searchParams.get('owner') || '')
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '')
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>('letters-view-mode', 'table')
  const [sortBy, setSortBy] = useState<SortField>('created')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [savedViews, setSavedViews] = useLocalStorage<SavedView[]>('letters-saved-views', [])
  const [viewsOpen, setViewsOpen] = useState(false)
  const [newViewName, setNewViewName] = useState('')
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const savedViewsRef = useRef<HTMLDivElement>(null)
  const applyingViewRef = useRef(false)
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const suggestionsAbortRef = useRef<AbortController | null>(null)
  const { page, limit, totalPages, nextPage, prevPage, goToPage, hasNext, hasPrev } = usePagination(
    {
      total: pagination?.total || 0,
      initialPage: 1,
      initialLimit: 50,
    }
  )
  const [isMobile, setIsMobile] = useState(false)
  const effectiveViewMode = isMobile && viewMode !== 'kanban' ? 'cards' : viewMode
  const [filtersOpen, setFiltersOpen] = useState(true)
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

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (search) count += 1
    if (statusFilter !== 'all') count += 1
    if (quickFilter) count += 1
    if (ownerFilter) count += 1
    if (typeFilter) count += 1
    return count
  }, [search, statusFilter, quickFilter, ownerFilter, typeFilter])

  const currentViewFilters = useCallback(
    () => ({
      search,
      status: statusFilter,
      quickFilter,
      owner: ownerFilter,
      type: typeFilter,
      sortBy,
      sortOrder,
      viewMode,
    }),
    [search, statusFilter, quickFilter, ownerFilter, typeFilter, sortBy, sortOrder, viewMode]
  )

  const applySavedView = useCallback(
    (view: SavedView) => {
      applyingViewRef.current = true
      setSearch(view.filters.search)
      setStatusFilter(view.filters.status)
      setQuickFilter(view.filters.quickFilter)
      setOwnerFilter(view.filters.owner)
      setTypeFilter(view.filters.type)
      setSortBy(view.filters.sortBy)
      setSortOrder(view.filters.sortOrder)
      setViewMode(view.filters.viewMode)
      setIsSearching(!!view.filters.search)
      setActiveViewId(view.id)
      setViewsOpen(false)
      goToPage(1)
    },
    [goToPage, setViewMode]
  )

  const saveCurrentView = useCallback(() => {
    const name = newViewName.trim()
    if (!name) return

    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`

    const newView: SavedView = {
      id,
      name,
      filters: currentViewFilters(),
    }

    setSavedViews((prev) => [newView, ...prev])
    setNewViewName('')
    setActiveViewId(id)
    setViewsOpen(false)
  }, [currentViewFilters, newViewName, setSavedViews])

  const deleteSavedView = useCallback(
    (id: string) => {
      setSavedViews((prev) => prev.filter((view) => view.id !== id))
      if (activeViewId === id) {
        setActiveViewId(null)
      }
    },
    [activeViewId, setSavedViews]
  )

  useEffect(() => {
    if (!viewsOpen) return
    const handleClick = (event: MouseEvent) => {
      if (!savedViewsRef.current) return
      if (!savedViewsRef.current.contains(event.target as Node)) {
        setViewsOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [viewsOpen])

  useEffect(() => {
    if (applyingViewRef.current) {
      applyingViewRef.current = false
      return
    }
    setActiveViewId(null)
  }, [search, statusFilter, quickFilter, ownerFilter, typeFilter, sortBy, sortOrder, viewMode])

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
    setFiltersOpen(!isMobile)
  }, [isMobile])

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
    searchRef.current = search
  }, [search])

  useEffect(() => {
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (quickFilter) params.set('filter', quickFilter)
    if (ownerFilter) params.set('owner', ownerFilter)
    if (typeFilter) params.set('type', typeFilter)
    if (sortBy !== 'created') params.set('sortBy', sortBy)
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder)
    if (page !== 1) params.set('page', String(page))

    const nextQuery = params.toString()
    if (querySyncRef.current === nextQuery) return
    querySyncRef.current = nextQuery
    router.replace(nextQuery ? `/letters?${nextQuery}` : '/letters')
  }, [statusFilter, quickFilter, ownerFilter, typeFilter, sortBy, sortOrder, page, router])

  const loadLetters = useCallback(
    async (showLoading = true) => {
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
        params.set('limit', String(limit))
        params.set('sortBy', sortBy)
        params.set('sortOrder', sortOrder)
        if (statusFilter !== 'all') params.set('status', statusFilter)
        if (quickFilter) params.set('filter', quickFilter)
        if (ownerFilter) params.set('owner', ownerFilter)
        if (typeFilter) params.set('type', typeFilter)
        const currentSearch = searchRef.current
        if (currentSearch) params.set('search', currentSearch)

        const res = await fetch(`/api/letters?${params}`, { signal: controller.signal })
        if (!res.ok) throw new Error('Failed to load letters')
        const data = await res.json()
        if (requestId !== lettersRequestIdRef.current) return

        startTransition(() => {
          setLetters(data.letters || [])
          setPagination(data.pagination)
          setSelectedIds((prev) => (prev.size ? new Set() : prev))
        })
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Failed to load letters:', error)
        toast.error('Не удалось загрузить список писем')
      } finally {
        if (requestId === lettersRequestIdRef.current) {
          setLoading(false)
          setIsSearching(false)
        }
      }
    },
    [page, limit, sortBy, sortOrder, statusFilter, quickFilter, ownerFilter, typeFilter, toast]
  )

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Failed to load users:', error)
    }
  }, [])

  const fetchSuggestions = useDebouncedCallback(async (query: string) => {
    const trimmed = query.trim()
    if (!trimmed) {
      setSearchSuggestions([])
      setSuggestionsOpen(false)
      setSuggestionsLoading(false)
      return
    }

    if (suggestionsAbortRef.current) {
      suggestionsAbortRef.current.abort()
    }

    const controller = new AbortController()
    suggestionsAbortRef.current = controller
    setSuggestionsLoading(true)

    try {
      const params = new URLSearchParams({
        search: trimmed,
        limit: '6',
        sortBy: 'created',
        sortOrder: 'desc',
      })
      const res = await fetch(`/api/letters?${params}`, { signal: controller.signal })
      if (!res.ok) return
      const data = await res.json()
      const items: SearchSuggestion[] = (data.letters || []).map((item: Letter) => ({
        id: item.id,
        number: item.number,
        org: item.org,
        status: item.status,
        deadlineDate: item.deadlineDate,
      }))
      setSearchSuggestions(items)
      setSuggestionsOpen(true)
    } catch (error) {
      if (controller.signal.aborted) return
      console.error('Failed to load suggestions:', error)
    } finally {
      if (!controller.signal.aborted) {
        setSuggestionsLoading(false)
      }
    }
  }, 250)

  const debouncedSearch = useDebouncedCallback(() => {
    if (session) loadLetters(false)
  }, 300)

  const resetFilters = useCallback(() => {
    setSearch('')
    setStatusFilter('all')
    setQuickFilter('')
    setOwnerFilter('')
    setTypeFilter('')
    setSortBy('created')
    setSortOrder('desc')
    goToPage(1)
  }, [goToPage])

  const handleRowClick = useCallback(
    (id: string) => {
      router.push(`/letters/${id}`)
    },
    [router]
  )

  const handlePreviewOpen = useCallback((id: string) => {
    setPreviewId(id)
  }, [])

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

  useEffect(() => {
    if (!search.trim()) {
      setSearchSuggestions([])
      setSuggestionsOpen(false)
      setSuggestionsLoading(false)
      return
    }
    fetchSuggestions(search)
  }, [search, fetchSuggestions])

  // Debounced search
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
    goToPage(1)
  }

  const handleKanbanStatusChange = useCallback(
    async (letterId: string, newStatus: LetterStatus) => {
      try {
        const res = await fetch(`/api/letters/${letterId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field: 'status', value: newStatus }),
        })

        if (res.ok) {
          setLetters((prev) =>
            prev.map((l) => (l.id === letterId ? { ...l, status: newStatus } : l))
          )
          toast.success('Статус обновлён')
        } else {
          toast.error('Не удалось обновить статус')
        }
      } catch (error) {
        console.error('Failed to update status:', error)
        toast.error('Не удалось обновить статус')
      }
    },
    [toast]
  )

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
        toast.success(`Обновлено ${data.updated} ${pluralizeLetters(data.updated)}`)
        setBulkAction(null)
        setBulkValue('')
        setSelectedIds(new Set())
        loadLetters()
      } else {
        toast.error(data.error || 'Не удалось выполнить операцию')
      }
    } catch (error) {
      console.error('Bulk action error:', error)
      toast.error('Не удалось выполнить операцию')
    } finally {
      setBulkLoading(false)
    }
  }, [bulkAction, bulkValue, loadLetters, selectedIds, toast])

  const executeBulkAction = useCallback(() => {
    if (!bulkAction || selectedIds.size === 0) return

    if (bulkAction === 'delete') {
      confirmDialog({
        title: 'Удалить письма?',
        message: `Удалить ${selectedIds.size} писем? Это действие нельзя отменить.`,
        confirmText: 'Удалить',
        variant: 'danger',
        onConfirm: runBulkAction,
      })
      return
    }

    if (bulkAction === 'status') {
      const statusLabel = STATUS_LABELS[bulkValue as LetterStatus] || bulkValue
      confirmDialog({
        title: 'Изменить статус?',
        message: `Обновить ${selectedIds.size} писем на статус \"${statusLabel}\"?`,
        confirmText: 'Применить',
        onConfirm: runBulkAction,
      })
      return
    }

    if (bulkAction === 'owner') {
      const owner = users.find((user) => user.id === bulkValue)
      const ownerLabel = bulkValue
        ? owner?.name || owner?.email || 'Исполнитель'
        : 'Без исполнителя'
      confirmDialog({
        title: 'Назначить исполнителя?',
        message: `Назначить ${selectedIds.size} писем: ${ownerLabel}?`,
        confirmText: 'Применить',
        variant: 'info',
        onConfirm: runBulkAction,
      })
      return
    }

    runBulkAction()
  }, [bulkAction, bulkValue, confirmDialog, runBulkAction, selectedIds, users])

  if (authStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent">
        <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent">
        <p className="text-slate-300/70">Войдите, чтобы увидеть список писем.</p>
      </div>
    )
  }

  return (
    <div className="app-shell min-h-screen">
      <Header />

      <main className="animate-pageIn relative mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold text-white md:text-4xl">Письма</h1>
            {pagination && (
              <p className="text-muted mt-1 text-sm">{`Всего: ${pagination.total} ${pluralizeLetters(pagination.total)}`}</p>
            )}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <a
              href={`/api/export?${new URLSearchParams({
                ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
                ...(quickFilter ? { filter: quickFilter } : {}),
                ...(ownerFilter ? { owner: ownerFilter } : {}),
                ...(typeFilter ? { type: typeFilter } : {}),
                ...(selectedIds.size > 0 ? { ids: Array.from(selectedIds).join(',') } : {}),
              }).toString()}`}
              className="btn-secondary inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 transition sm:w-auto"
            >
              <Download className="h-5 w-5" />
              Экспорт
            </a>
            <button
              type="button"
              onClick={() => setShowBulkCreate(true)}
              className="btn-secondary inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 transition sm:w-auto"
            >
              <ListPlus className="h-5 w-5" />
              Импорт писем
            </button>
            <Link
              href="/letters/new"
              className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 transition sm:w-auto"
            >
              <Plus className="h-5 w-5" />
              Новое письмо
            </Link>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="panel panel-soft mb-4 flex flex-col gap-4 rounded-2xl p-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-teal-300" />
              <span className="font-medium text-white">Выбрано: {selectedIds.size}</span>
            </div>

            <div className="flex w-full flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={bulkAction || ''}
                onChange={(e) => {
                  const value = e.target.value as 'status' | 'owner' | 'delete' | ''
                  setBulkAction(value || null)
                  setBulkValue('')
                }}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white sm:w-auto"
                aria-label="Действие"
              >
                <option value="">Выберите действие</option>
                <option value="status">Сменить статус</option>
                <option value="owner">Назначить исполнителя</option>
                {(session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN') && (
                  <option value="delete">Удалить</option>
                )}
              </select>

              {bulkAction === 'status' && (
                <select
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white sm:w-auto"
                  aria-label="Статус"
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
                  onClick={executeBulkAction}
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
              onClick={() => {
                setSelectedIds(new Set())
                setBulkAction(null)
                setBulkValue('')
              }}
              className="self-start rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white lg:self-auto"
              aria-label="Снять выбор"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Quick Filters */}

        <div className="panel-soft panel-glass no-scrollbar mb-4 flex gap-2 overflow-x-auto rounded-2xl p-2 sm:flex-wrap sm:overflow-visible">
          {FILTERS.map((filter) => {
            const Icon = filter.icon
            return (
              <button
                key={filter.value}
                onClick={() => {
                  setQuickFilter(filter.value)
                  setStatusFilter('all')
                  if (filter.value === 'mine' || filter.value === 'unassigned') {
                    setOwnerFilter('')
                  }
                  goToPage(1)
                }}
                className={`app-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${quickFilter === filter.value ? 'app-chip-active' : ''}`}
              >
                <Icon className="h-4 w-4" />
                {filter.label}
              </button>
            )
          })}
        </div>

        {/* Filters Row */}
        <div className="panel panel-soft panel-glass relative z-20 mb-6 flex flex-col items-start gap-4 rounded-2xl p-4 lg:flex-row lg:flex-wrap lg:items-center xl:flex-nowrap">
          {/* Search */}
          <div className="relative flex-1">
            {isSearching ? (
              <Loader2 className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-teal-400" />
            ) : (
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            )}
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Поиск по номеру, организации, содержанию, Jira и ответам..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => {
                if (searchSuggestions.length > 0) {
                  setSuggestionsOpen(true)
                }
              }}
              onBlur={() => {
                window.setTimeout(() => setSuggestionsOpen(false), 150)
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-10 pr-10 text-white placeholder-slate-400 focus:border-teal-400/80 focus:outline-none focus:ring-1 focus:ring-teal-400/40"
              aria-label="Поиск"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-white"
                aria-label="Очистить поиск"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {(suggestionsOpen || suggestionsLoading) && search.trim() && (
              <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-slate-800/70 bg-slate-950/95 shadow-2xl shadow-black/40 backdrop-blur">
                <div className="flex items-center justify-between border-b border-slate-800/70 px-3 py-2 text-xs text-slate-400">
                  <span>Подсказки</span>
                  {suggestionsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                </div>
                <div className="max-h-64 overflow-auto">
                  {searchSuggestions.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-slate-500">Ничего не найдено</div>
                  ) : (
                    searchSuggestions.map((item) => {
                      const daysLeft = getWorkingDaysUntilDeadline(item.deadlineDate)
                      const tone =
                        daysLeft < 0
                          ? 'text-red-400'
                          : daysLeft <= 2
                            ? 'text-yellow-400'
                            : 'text-emerald-300'

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault()
                            router.push(`/letters/${item.id}`)
                            setSuggestionsOpen(false)
                          }}
                          className="flex w-full flex-col gap-1 border-b border-slate-900/60 px-3 py-2 text-left text-sm transition hover:bg-slate-900/70"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-teal-300">№{item.number}</span>
                            <span className={`text-[11px] ${tone}`}>
                              {daysLeft} раб. {pluralizeDays(daysLeft)}
                            </span>
                          </div>
                          <div className="truncate text-xs text-slate-300">{item.org}</div>
                          <div className="text-[11px] text-slate-500">
                            {STATUS_LABELS[item.status]}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            <p className="mt-2 hidden text-xs text-slate-500 md:block">
              Можно искать по номеру, организации, содержанию, Jira и ответам.
            </p>
          </div>

          <button
            onClick={() => setFiltersOpen((prev) => !prev)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-slate-200 transition hover:bg-white/10 hover:text-white sm:hidden"
            aria-expanded={filtersOpen}
            aria-controls="letters-filters"
          >
            <Filter className="h-4 w-4" />
            {activeFiltersCount > 0 ? `Фильтры (${activeFiltersCount})` : 'Фильтры'}
          </button>

          <div
            id="letters-filters"
            className={`${filtersOpen ? 'flex' : 'hidden'} w-full flex-col gap-4 sm:flex sm:w-full sm:flex-row sm:flex-wrap lg:w-auto lg:flex-nowrap`}
          >
            {/* Status filter */}
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Filter className="h-5 w-5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as LetterStatus | 'all')
                  setQuickFilter('')
                  goToPage(1)
                }}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-teal-400/80 focus:outline-none focus:ring-1 focus:ring-teal-400/40 sm:w-auto"
                aria-label="Статус"
              >
                <option value="all">Все статусы</option>
                {STATUSES.filter((s) => s !== 'all').map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status as LetterStatus]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Users className="h-5 w-5 text-slate-400" />
              <select
                value={ownerFilter}
                onChange={(e) => {
                  setOwnerFilter(e.target.value)
                  if (quickFilter === 'mine' || quickFilter === 'unassigned') {
                    setQuickFilter('')
                  }
                  goToPage(1)
                }}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-teal-400/80 focus:outline-none focus:ring-1 focus:ring-teal-400/40 sm:w-auto"
                aria-label="Исполнитель"
              >
                <option value="">Все исполнители</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex w-full items-center gap-2 sm:w-auto">
              <FileText className="h-5 w-5 text-slate-400" />
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value)
                  goToPage(1)
                }}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-teal-400/80 focus:outline-none focus:ring-1 focus:ring-teal-400/40 sm:w-auto"
                aria-label="Тип"
              >
                <option value="">Все типы</option>
                {LETTER_TYPES.filter((item) => item.value !== 'all').map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {activeFiltersCount > 0 && (
              <button
                onClick={resetFilters}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-slate-200 transition hover:bg-white/10 hover:text-white sm:w-auto"
                aria-label="Сбросить фильтры"
              >
                <XCircle className="h-4 w-4" />
                {`Сбросить (${activeFiltersCount})`}
              </button>
            )}
          </div>

          <div className="hidden w-full flex-wrap items-center gap-2 sm:ml-auto sm:flex sm:w-auto">
            {/* Saved views */}
            <div ref={savedViewsRef} className="relative hidden sm:block">
              <button
                onClick={() => setViewsOpen((prev) => !prev)}
                className={`inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm transition ${
                  viewsOpen
                    ? 'bg-white/10 text-white'
                    : 'bg-white/5 text-slate-300 hover:text-white'
                }`}
                aria-expanded={viewsOpen}
              >
                <Bookmark className="h-4 w-4" />
                Виды
                <ChevronDown className="h-4 w-4" />
              </button>

              {viewsOpen && (
                <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-slate-800/70 bg-slate-950/95 shadow-2xl shadow-black/40 backdrop-blur">
                  <div className="border-b border-slate-800/70 px-3 py-2 text-xs text-slate-400">
                    Сохранённые виды
                  </div>
                  <div className="max-h-64 overflow-auto">
                    {savedViews.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-slate-500">Нет сохранённых видов</div>
                    ) : (
                      savedViews.map((view) => (
                        <div
                          key={view.id}
                          className="flex items-center gap-2 border-b border-slate-900/60 px-3 py-2"
                        >
                          <button
                            type="button"
                            onClick={() => applySavedView(view)}
                            className="flex-1 truncate text-left text-sm text-slate-200 transition hover:text-white"
                          >
                            {view.name}
                          </button>
                          {activeViewId === view.id && (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">
                              Активен
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              deleteSavedView(view.id)
                            }}
                            className="text-slate-500 transition hover:text-red-300"
                            aria-label="Удалить вид"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t border-slate-800/70 px-3 py-3">
                    <input
                      value={newViewName}
                      onChange={(e) => setNewViewName(e.target.value)}
                      placeholder="Название вида"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white placeholder-slate-500"
                    />
                    <button
                      onClick={saveCurrentView}
                      disabled={!newViewName.trim()}
                      className="mt-2 w-full rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
                    >
                      Сохранить текущий вид
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* View toggle */}
            <div className="panel-soft panel-glass hidden rounded-xl p-1 sm:flex">
              <button
                onClick={() => setViewMode('table')}
                className={`rounded-lg p-2 transition ${viewMode === 'table' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white'}`}
                title="Таблица"
                aria-label="Табличный вид"
              >
                <List className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`rounded-lg p-2 transition ${viewMode === 'cards' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white'}`}
                title="Карточки"
                aria-label="Карточный вид"
              >
                <LayoutGrid className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`rounded-lg p-2 transition ${viewMode === 'kanban' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white'}`}
                title="Канбан"
                aria-label="Канбан"
              >
                <Kanban className="h-5 w-5" />
              </button>
            </div>

            {/* Keyboard shortcuts help */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => (shortcutsOpen ? closeShortcuts() : openShortcuts())}
                className={`rounded-lg p-2 transition ${shortcutsOpen ? 'bg-white/10 text-white' : 'bg-white/5 text-slate-300 hover:text-white'}`}
                title="Горячие клавиши"
                aria-label="Горячие клавиши"
              >
                <Keyboard className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}

        {loading ? (
          effectiveViewMode === 'cards' ? (
            <CardsSkeleton count={9} />
          ) : effectiveViewMode === 'kanban' ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-shimmer h-96 min-w-[280px] rounded-xl bg-white/5" />
              ))}
            </div>
          ) : (
            <TableSkeleton rows={10} />
          )
        ) : letters.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-slate-300/70">Писем нет</p>
          </div>
        ) : effectiveViewMode === 'kanban' ? (
          <LetterKanban letters={letters} onStatusChange={handleKanbanStatusChange} />
        ) : effectiveViewMode === 'cards' ? (
          <VirtualLetterList
            letters={letters}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        ) : (
          <VirtualLetterTable
            letters={letters}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onSort={handleSort}
            sortField={sortBy}
            sortDirection={sortOrder}
            focusedIndex={focusedIndex}
            onRowClick={handleRowClick}
            onPreview={handlePreviewOpen}
          />
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-slate-300/70">{`Показано ${(page - 1) * limit + 1}-${Math.min(page * limit, pagination.total)} из ${pagination.total}`}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={prevPage}
                disabled={!hasPrev}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Предыдущая страница"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <span className="px-2 text-slate-300/70">
                {page} / {totalPages}
              </span>

              <button
                onClick={nextPage}
                disabled={!hasNext}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Следующая страница"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Letter Preview Panel */}
      <LetterPreview letterId={previewId} onClose={() => setPreviewId(null)} />

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
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-transparent">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-teal-500"></div>
        </div>
      }
    >
      <LettersPageContent />
    </Suspense>
  )
}

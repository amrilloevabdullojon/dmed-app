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
import { STATUS_LABELS } from '@/lib/utils'
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
  { value: '', label: '\В\с\е \п\и\с\ь\м\а', icon: List },
  { value: 'favorites', label: '\И\з\б\р\а\н\н\ы\е', icon: Star },
  { value: 'overdue', label: '\П\р\о\с\р\о\ч\е\н\н\ы\е', icon: AlertTriangle },
  { value: 'urgent', label: '\С\р\о\ч\н\ы\е (3 \д\н\я)', icon: Clock },
  { value: 'active', label: '\В \р\а\б\о\т\е', icon: XCircle },
  { value: 'done', label: '\З\а\в\е\р\ш\е\н\н\ы\е', icon: CheckCircle },
]

type ViewMode = 'cards' | 'table' | 'kanban'
type SortField = 'created' | 'deadline' | 'date' | 'number' | 'org' | 'status' | 'priority'

const pluralizeLetters = (count: number) => {
  const value = Math.abs(count) % 100
  const lastDigit = value % 10

  if (value > 10 && value < 20) return '\п\и\с\е\м'
  if (lastDigit === 1) return '\п\и\с\ь\м\о'
  if (lastDigit > 1 && lastDigit < 5) return '\п\и\с\ь\м\а'
  return '\п\и\с\е\м'
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
        toast.error('\Н\е \у\д\а\л\о\с\ь \з\а\г\р\у\з\и\т\ь \с\п\и\с\о\к \п\и\с\е\м')
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
        toast.success(`\О\б\н\о\в\л\е\н\о ${data.updated} ${pluralizeLetters(data.updated)}`)
        setBulkAction(null)
        setBulkValue('')
        setSelectedIds(new Set())
        loadLetters()
      } else {
        toast.error(data.error || '\Н\е \у\д\а\л\о\с\ь \в\ы\п\о\л\н\и\т\ь \о\п\е\р\а\ц\и\ю')
      }
    } catch (error) {
      console.error('Bulk action error:', error)
      toast.error('\Н\е \у\д\а\л\о\с\ь \в\ы\п\о\л\н\и\т\ь \о\п\е\р\а\ц\и\ю')
    } finally {
      setBulkLoading(false)
    }
  }, [bulkAction, bulkValue, loadLetters, selectedIds, toast])

  const executeBulkAction = useCallback(() => {
    if (!bulkAction || selectedIds.size === 0) return

    if (bulkAction === 'delete') {
      confirmDialog({
        title: '\У\д\а\л\и\т\ь \п\и\с\ь\м\а?',
        message: `\У\д\а\л\и\т\ь ${selectedIds.size} \п\и\с\е\м? \Э\т\о \д\е\й\с\т\в\и\е \н\е\л\ь\з\я \о\т\м\е\н\и\т\ь.`,
        confirmText: '\У\д\а\л\и\т\ь',
        variant: 'danger',
        onConfirm: runBulkAction,
      })
      return
    }

    if (bulkAction === 'status') {
      const statusLabel = STATUS_LABELS[bulkValue as LetterStatus] || bulkValue
      confirmDialog({
        title: '\И\з\м\е\н\и\т\ь \с\т\а\т\у\с?',
        message: `\О\б\н\о\в\и\т\ь ${selectedIds.size} \п\и\с\е\м \н\а \с\т\а\т\у\с \"${statusLabel}\"?`,
        confirmText: '\П\р\и\м\е\н\и\т\ь',
        onConfirm: runBulkAction,
      })
      return
    }

    if (bulkAction === 'owner') {
      const owner = users.find((user) => user.id === bulkValue)
      const ownerLabel = bulkValue
        ? owner?.name || owner?.email || '\И\с\п\о\л\н\и\т\е\л\ь'
        : '\Б\е\з \и\с\п\о\л\н\и\т\е\л\я'
      confirmDialog({
        title: '\Н\а\з\н\а\ч\и\т\ь \и\с\п\о\л\н\и\т\е\л\я?',
        message: `\Н\а\з\н\а\ч\и\т\ь ${selectedIds.size} \п\и\с\е\м: ${ownerLabel}?`,
        confirmText: '\П\р\и\м\е\н\и\т\ь',
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
        <p className="text-slate-300/70">
          {'\П\о\ж\а\л\у\й\с\т\а, \в\о\й\д\и\т\е \в \с\и\с\т\е\м\у'}
        </p>
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
            <h1 className="font-display text-3xl font-semibold text-white md:text-4xl">
              {'\П\и\с\ь\м\а'}
            </h1>
            {pagination && (
              <p className="text-muted mt-1 text-sm">{`\В\с\е\г\о: ${pagination.total} \п\и\с\е\м`}</p>
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
              {'\Э\к\с\п\о\р\т'}
            </a>
            <button
              type="button"
              onClick={() => setShowBulkCreate(true)}
              className="btn-secondary inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 transition sm:w-auto"
            >
              <ListPlus className="h-5 w-5" />
              {'\М\а\с\с\о\в\о\е \с\о\з\д\а\н\и\е \п\и\с\е\м'}
            </button>
            <Link
              href="/letters/new"
              className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 transition sm:w-auto"
            >
              <Plus className="h-5 w-5" />
              {'\Н\о\в\о\е \п\и\с\ь\м\о'}
            </Link>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="panel panel-soft mb-4 flex flex-col gap-4 rounded-2xl p-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-teal-300" />
              <span className="font-medium text-white">
                {'\В\ы\б\р\а\н\о'}: {selectedIds.size}
              </span>
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
                aria-label="\В\ы\б\е\р\и\т\е \д\е\й\с\т\в\и\е"
              >
                <option value="">{'\В\ы\б\е\р\и\т\е \д\е\й\с\т\в\и\е'}</option>
                <option value="status">{'\И\з\м\е\н\и\т\ь \с\т\а\т\у\с'}</option>
                <option value="owner">{'\Н\а\з\н\а\ч\и\т\ь \и\с\п\о\л\н\и\т\е\л\я'}</option>
                {(session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN') && (
                  <option value="delete">{'\У\д\а\л\и\т\ь'}</option>
                )}
              </select>

              {bulkAction === 'status' && (
                <select
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white sm:w-auto"
                  aria-label="\В\ы\б\е\р\и\т\е \с\т\а\т\у\с"
                >
                  <option value="">{'\В\ы\б\е\р\и\т\е \с\т\а\т\у\с'}</option>
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
                  aria-label="\В\ы\б\е\р\и\т\е \и\с\п\о\л\н\и\т\е\л\я"
                >
                  <option value="">{'\В\ы\б\е\р\и\т\е \и\с\п\о\л\н\и\т\е\л\я'}</option>
                  <option value="">{'\Б\е\з \и\с\п\о\л\н\и\т\е\л\я'}</option>
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
                  {'\П\р\и\м\е\н\и\т\ь'}
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
              aria-label="\С\б\р\о\с\и\т\ь \в\ы\б\о\р"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Quick Filters */}
        <div className="panel-soft panel-glass no-scrollbar mb-4 flex gap-2 overflow-x-auto rounded-2xl p-2 sm:flex-wrap">
          {FILTERS.map((filter) => {
            const Icon = filter.icon
            return (
              <button
                key={filter.value}
                onClick={() => {
                  setQuickFilter(filter.value)
                  setStatusFilter('all')
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
        <div className="panel panel-soft panel-glass relative z-20 mb-6 flex flex-col gap-4 rounded-2xl p-4 sm:flex-row">
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
              placeholder="Поиск по номеру, организации, Jira, содержанию... (нажмите /)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-10 pr-10 text-white placeholder-slate-400 focus:border-teal-400/80 focus:outline-none focus:ring-1 focus:ring-teal-400/40"
              aria-label="Поиск"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-white"
                aria-label="\О\ч\и\с\т\и\т\ь \п\о\и\с\к"
              >
                <X className="h-4 w-4" />
              </button>
            )}
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
            className={`${filtersOpen ? 'flex' : 'hidden'} w-full flex-col gap-4 sm:flex sm:w-auto sm:flex-row`}
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
                aria-label="\Ф\и\л\ь\т\р \п\о \с\т\а\т\у\с\у"
              >
                <option value="all">{'\В\с\е \с\т\а\т\у\с\ы'}</option>
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
                  goToPage(1)
                }}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-teal-400/80 focus:outline-none focus:ring-1 focus:ring-teal-400/40 sm:w-auto"
                aria-label="\Ф\и\л\ь\т\р \п\о \и\с\п\о\л\н\и\т\е\л\ю"
              >
                <option value="">{'\В\с\е \и\с\п\о\л\н\и\т\е\л\и'}</option>
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
                aria-label="\Ф\и\л\ь\т\р \п\о \т\и\п\у"
              >
                <option value="">{'\В\с\е \т\и\п\ы'}</option>
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
                aria-label="\С\б\р\о\с\и\т\ь \ф\и\л\ь\т\р\ы"
              >
                <XCircle className="h-4 w-4" />
                {`\С\б\р\о\с\и\т\ь (${activeFiltersCount})`}
              </button>
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
              title="Kanban"
              aria-label="Kanban вид"
            >
              <Kanban className="h-5 w-5" />
            </button>
          </div>

          {/* Keyboard shortcuts help */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => (shortcutsOpen ? closeShortcuts() : openShortcuts())}
              className={`rounded-lg p-2 transition ${shortcutsOpen ? 'bg-white/10 text-white' : 'bg-white/5 text-slate-300 hover:text-white'}`}
              title="\Г\о\р\я\ч\и\е \к\л\а\в\и\ш\и"
              aria-label="\Г\о\р\я\ч\и\е \к\л\а\в\и\ш\и"
            >
              <Keyboard className="h-5 w-5" />
            </button>
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
            <p className="text-slate-300/70">Писем не найдено</p>
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
            <div className="text-sm text-slate-300/70">{`\П\о\к\а\з\а\н\ы ${(page - 1) * limit + 1}-${Math.min(page * limit, pagination.total)} \и\з ${pagination.total}`}</div>
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

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
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/Toast'
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
  { value: '', label: '\u0412\u0441\u0435 \u043f\u0438\u0441\u044c\u043c\u0430', icon: List },
  { value: 'favorites', label: '\u0418\u0437\u0431\u0440\u0430\u043d\u043d\u044b\u0435', icon: Star },
  { value: 'overdue', label: '\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043d\u044b\u0435', icon: AlertTriangle },
  { value: 'urgent', label: '\u0421\u0440\u043e\u0447\u043d\u044b\u0435 (3 \u0434\u043d\u044f)', icon: Clock },
  { value: 'active', label: '\u0412 \u0440\u0430\u0431\u043e\u0442\u0435', icon: XCircle },
  { value: 'done', label: '\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u043d\u044b\u0435', icon: CheckCircle },
]

type ViewMode = 'cards' | 'table'
type SortField = 'created' | 'deadline' | 'date' | 'number' | 'org' | 'status' | 'priority'

const pluralizeLetters = (count: number) => {
  const value = Math.abs(count) % 100
  const lastDigit = value % 10

  if (value > 10 && value < 20) return '\u043f\u0438\u0441\u0435\u043c'
  if (lastDigit === 1) return '\u043f\u0438\u0441\u044c\u043c\u043e'
  if (lastDigit > 1 && lastDigit < 5) return '\u043f\u0438\u0441\u044c\u043c\u0430'
  return '\u043f\u0438\u0441\u0435\u043c'
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
  const {
    page,
    limit,
    totalPages,
    nextPage,
    prevPage,
    goToPage,
    hasNext,
    hasPrev,
  } = usePagination({
    total: pagination?.total || 0,
    initialPage: 1,
    initialLimit: 50,
  })
  const [isMobile, setIsMobile] = useState(false)
  const effectiveViewMode = isMobile ? 'cards' : viewMode
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
      toast.error('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0441\u043f\u0438\u0441\u043e\u043a \u043f\u0438\u0441\u0435\u043c')
    } finally {
      if (requestId === lettersRequestIdRef.current) {
        setLoading(false)
        setIsSearching(false)
      }
    }
  }, [
    page,
    limit,
    sortBy,
    sortOrder,
    statusFilter,
    quickFilter,
    ownerFilter,
    typeFilter,
    toast,
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
        toast.success(
          `\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e ${data.updated} ${pluralizeLetters(data.updated)}`
        )
        setBulkAction(null)
        setBulkValue('')
        setSelectedIds(new Set())
        loadLetters()
      } else {
        toast.error(
          data.error ||
            '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u043e\u043f\u0435\u0440\u0430\u0446\u0438\u044e'
        )
      }
    } catch (error) {
      console.error('Bulk action error:', error)
      toast.error('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u043e\u043f\u0435\u0440\u0430\u0446\u0438\u044e')
    } finally {
      setBulkLoading(false)
    }
  }, [bulkAction, bulkValue, loadLetters, selectedIds, toast])

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

    if (bulkAction === 'status') {
      const statusLabel = STATUS_LABELS[bulkValue as LetterStatus] || bulkValue
      confirmDialog({
        title: '\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0441\u0442\u0430\u0442\u0443\u0441?',
        message: `\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c ${selectedIds.size} \u043f\u0438\u0441\u0435\u043c \u043d\u0430 \u0441\u0442\u0430\u0442\u0443\u0441 \"${statusLabel}\"?`,
        confirmText: '\u041f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u044c',
        onConfirm: runBulkAction,
      })
      return
    }

    if (bulkAction === 'owner') {
      const owner = users.find((user) => user.id === bulkValue)
      const ownerLabel = bulkValue
        ? (owner?.name || owner?.email || '\u0418\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c')
        : '\u0411\u0435\u0437 \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044f'
      confirmDialog({
        title: '\u041d\u0430\u0437\u043d\u0430\u0447\u0438\u0442\u044c \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044f?',
        message: `\u041d\u0430\u0437\u043d\u0430\u0447\u0438\u0442\u044c ${selectedIds.size} \u043f\u0438\u0441\u0435\u043c: ${ownerLabel}?`,
        confirmText: '\u041f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u044c',
        onConfirm: runBulkAction,
      })
      return
    }

    runBulkAction()
  }, [bulkAction, bulkValue, confirmDialog, runBulkAction, selectedIds, users])

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
        <p className="text-slate-300/70">
          {'\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0432\u043e\u0439\u0434\u0438\u0442\u0435 \u0432 \u0441\u0438\u0441\u0442\u0435\u043c\u0443'}
        </p>
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
            <h1 className="text-3xl md:text-4xl font-display font-semibold text-white">{'\u041f\u0438\u0441\u044c\u043c\u0430'}</h1>
            {pagination && (
              <p className="text-muted text-sm mt-1">{`\u0412\u0441\u0435\u0433\u043e: ${pagination.total} \u043f\u0438\u0441\u0435\u043c`}</p>
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
              {'\u042d\u043a\u0441\u043f\u043e\u0440\u0442'}
            </a>
            <button
              type="button"
              onClick={() => setShowBulkCreate(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition btn-secondary w-full sm:w-auto"
            >
              <ListPlus className="w-5 h-5" />
              {'\u041c\u0430\u0441\u0441\u043e\u0432\u043e\u0435 \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u0435 \u043f\u0438\u0441\u0435\u043c'}
            </button>
            <Link
              href="/letters/new"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition btn-primary w-full sm:w-auto"
            >
              <Plus className="w-5 h-5" />
              {'\u041d\u043e\u0432\u043e\u0435 \u043f\u0438\u0441\u044c\u043c\u043e'}
            </Link>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="panel panel-soft rounded-2xl p-4 mb-4 flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-teal-300" />
              <span className="text-white font-medium">{'\u0412\u044b\u0431\u0440\u0430\u043d\u043e'}: {selectedIds.size}</span>
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
                aria-label="\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435"
              >
                <option value="">{'\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435'}</option>
                <option value="status">{'\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0441\u0442\u0430\u0442\u0443\u0441'}</option>
                <option value="owner">{'\u041d\u0430\u0437\u043d\u0430\u0447\u0438\u0442\u044c \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044f'}</option>
                {(session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN') && (
                  <option value="delete">{'\u0423\u0434\u0430\u043b\u0438\u0442\u044c'}</option>
                )}
              </select>

              {bulkAction === 'status' && (
                <select
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white"
                  aria-label="\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0442\u0430\u0442\u0443\u0441"
                >
                  <option value="">{'\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0442\u0430\u0442\u0443\u0441'}</option>
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
                  aria-label="\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044f"
                >
                  <option value="">{'\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044f'}</option>
                  <option value="">{'\u0411\u0435\u0437 \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044f'}</option>
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
                  {'\u041f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u044c'}
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
              aria-label="\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u0432\u044b\u0431\u043e\u0440"
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
                  goToPage(1)
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
              placeholder="\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u043d\u043e\u043c\u0435\u0440\u0443, \u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u0438, Jira, \u0441\u043e\u0434\u0435\u0440\u0436\u0430\u043d\u0438\u044e... (\u043d\u0430\u0436\u043c\u0438\u0442\u0435 /)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-400 focus:outline-none focus:border-teal-400/80 focus:ring-1 focus:ring-teal-400/40"
              aria-label="\u041f\u043e\u0438\u0441\u043a"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                aria-label="\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u043f\u043e\u0438\u0441\u043a"
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
                goToPage(1)
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-teal-400/80 focus:ring-1 focus:ring-teal-400/40"
              aria-label="\u0424\u0438\u043b\u044c\u0442\u0440 \u043f\u043e \u0441\u0442\u0430\u0442\u0443\u0441\u0443"
            >
              <option value="all">{'\u0412\u0441\u0435 \u0441\u0442\u0430\u0442\u0443\u0441\u044b'}</option>
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
                goToPage(1)
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-teal-400/80 focus:ring-1 focus:ring-teal-400/40"
              aria-label="\u0424\u0438\u043b\u044c\u0442\u0440 \u043f\u043e \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044e"
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
                goToPage(1)
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-teal-400/80 focus:ring-1 focus:ring-teal-400/40"
              aria-label="\u0424\u0438\u043b\u044c\u0442\u0440 \u043f\u043e \u0442\u0438\u043f\u0443"
            >
              <option value="">{'\u0412\u0441\u0435 \u0442\u0438\u043f\u044b'}</option>
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
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:text-white hover:bg-white/10 transition"
              aria-label="\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u0444\u0438\u043b\u044c\u0442\u0440\u044b"
            >
              <XCircle className="w-4 h-4" />
              {`\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c (${activeFiltersCount})`}
            </button>
          )}

          {/* View toggle */}
          <div className="hidden sm:flex rounded-xl p-1 panel-soft panel-glass">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition ${viewMode === 'table' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white'}`}
              title="\u0422\u0430\u0431\u043b\u0438\u0446\u0430"
              aria-label="\u0422\u0430\u0431\u043b\u0438\u0447\u043d\u044b\u0439 \u0432\u0438\u0434"
            >
              <List className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-lg transition ${viewMode === 'cards' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white'}`}
              title="\u041a\u0430\u0440\u0442\u043e\u0447\u043a\u0438"
              aria-label="\u041a\u0430\u0440\u0442\u043e\u0447\u043d\u044b\u0439 \u0432\u0438\u0434"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>

          {/* Keyboard shortcuts help */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => (shortcutsOpen ? closeShortcuts() : openShortcuts())}
              className={`p-2 rounded-lg transition ${shortcutsOpen ? 'bg-white/10 text-white' : 'bg-white/5 text-slate-300 hover:text-white'}`}
              title="\u0413\u043e\u0440\u044f\u0447\u0438\u0435 \u043a\u043b\u0430\u0432\u0438\u0448\u0438"
              aria-label="\u0413\u043e\u0440\u044f\u0447\u0438\u0435 \u043a\u043b\u0430\u0432\u0438\u0448\u0438"
            >
              <Keyboard className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          effectiveViewMode === 'cards' ? (
            <CardsSkeleton count={9} />
          ) : (
            <TableSkeleton rows={10} />
          )
        ) : letters.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-300/70">{'\u041f\u0438\u0441\u0435\u043c \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e'}</p>
          </div>
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
          <div className="flex items-center justify-between mt-6">
            <div className="text-slate-300/70 text-sm">{`\u041f\u043e\u043a\u0430\u0437\u0430\u043d\u044b ${((page - 1) * limit) + 1}-${Math.min(page * limit, pagination.total)} \u0438\u0437 ${pagination.total}`}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={prevPage}
                disabled={!hasPrev}
                className="p-2 bg-white/5 border border-white/10 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition"
                aria-label="Предыдущая страница"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <span className="text-slate-300/70 px-2">
                {page} / {totalPages}
              </span>

              <button
                onClick={nextPage}
                disabled={!hasNext}
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

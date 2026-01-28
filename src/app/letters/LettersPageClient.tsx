'use client'

import { useSession } from 'next-auth/react'
import { Header } from '@/components/Header'
import { VirtualLetterList, VirtualLetterTable } from '@/components/VirtualLetterList'
import { ScrollIndicator } from '@/components/mobile/ScrollIndicator'
import { CardsSkeleton, TableSkeleton } from '@/components/Skeleton'
import { useConfirmDialog } from '@/components/ConfirmDialog'
import { useKeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp'
import { LettersBulkActions } from '@/components/letters/LettersBulkActions'
import dynamic from 'next/dynamic'

// Lazy load heavy components
const LetterPreview = dynamic(
  () => import('@/components/LetterPreview').then((mod) => ({ default: mod.LetterPreview })),
  {
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    ),
  }
)
const BulkCreateLetters = dynamic(
  () =>
    import('@/components/BulkCreateLetters').then((mod) => ({ default: mod.BulkCreateLetters })),
  {
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    ),
  }
)
const LetterKanban = dynamic(
  () => import('@/components/LetterKanban').then((mod) => ({ default: mod.LetterKanban })),
  {
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    ),
  }
)

// Extracted components
import { LettersQuickFilters, QUICK_FILTERS } from './LettersQuickFilters'
import { LettersViewToggle } from './LettersViewToggle'
import { LettersSavedViews } from './LettersSavedViews'
import { LettersSearchSuggestions } from './LettersSearchSuggestions'
import { LettersPagination } from './LettersPagination'
import {
  type Letter,
  type User,
  type Pagination,
  type ViewMode,
  type SortField,
  type SavedView,
  type SearchSuggestion,
  type InitialFilters,
  type LettersInitialData,
  STATUSES,
  LETTERS_CACHE_TTL,
  USERS_CACHE_TTL,
  pluralizeLetters,
} from './letters-types'

import { useKeyboard } from '@/hooks/useKeyboard'
import { useDebouncedCallback } from '@/hooks/useDebounce'
import { usePagination } from '@/hooks/usePagination'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useEffect, useState, useRef, useCallback, useMemo, Suspense, startTransition } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { LetterStatus } from '@/types/prisma'
import { STATUS_LABELS } from '@/lib/utils'
import { LETTER_TYPES } from '@/lib/constants'
import {
  Search,
  Filter,
  Plus,
  Loader2,
  XCircle,
  X,
  Download,
  Keyboard,
  FileText,
  Users,
  ListPlus,
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/Toast'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { usePrefetch } from '@/lib/react-query'

type LettersPageClientProps = {
  initialData?: LettersInitialData
}

function LettersPageContent({ initialData }: LettersPageClientProps) {
  const { data: session, status: authStatus } = useSession()
  useAuthRedirect(authStatus)
  const toast = useToast()
  const toastRef = useRef(toast)
  const { prefetchLetters } = usePrefetch()
  const initialCacheKey = initialData?.initialCacheKey

  useEffect(() => {
    toastRef.current = toast
  }, [toast])

  useEffect(() => {
    if (!initialData) return
    if (initialCacheKey && !lettersCacheRef.current.has(initialCacheKey)) {
      lettersCacheRef.current.set(initialCacheKey, {
        letters: initialData.letters,
        pagination: initialData.pagination,
        storedAt: Date.now(),
      })
    }
    if (initialData.users && initialData.users.length > 0) {
      usersCacheRef.current = { data: initialData.users, storedAt: Date.now() }
    }
  }, [initialData, initialCacheKey])

  const searchParams = useSearchParams()
  const router = useRouter()

  // Получаем сохранённое значение itemsPerPage из localStorage
  const [savedItemsPerPage] = useLocalStorage<number>('letters-items-per-page', 50)

  const initialFilters = useMemo<InitialFilters>(() => {
    if (initialData?.filters) return initialData.filters
    const pageParam = Number(searchParams.get('page') || 1)
    // Используем значение из URL если есть, иначе из localStorage
    const limitFromUrl = searchParams.get('limit')
    const limitParam = limitFromUrl ? Number(limitFromUrl) : savedItemsPerPage
    return {
      page: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
      limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50,
      status: (searchParams.get('status') as LetterStatus) || 'all',
      quickFilter: searchParams.get('filter') || '',
      owner: searchParams.get('owner') || '',
      type: searchParams.get('type') || '',
      sortBy: (searchParams.get('sortBy') as SortField) || 'created',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
      search: '',
    }
  }, [initialData, searchParams, savedItemsPerPage])

  const canManageUsers = initialData?.canManageUsers ?? true

  // Core state
  const [letters, setLetters] = useState<Letter[]>(initialData?.letters ?? [])
  const [users, setUsers] = useState<User[]>(initialData?.users ?? [])
  const [pagination, setPagination] = useState<Pagination | null>(initialData?.pagination ?? null)
  const [loading, setLoading] = useState(!initialData)
  const [contentLoading, setContentLoading] = useState(false) // Локальный лоадер только для контента
  const [isSearching, setIsSearching] = useState(false)

  // Filter state
  const [search, setSearch] = useState(initialFilters.search)
  const searchRef = useRef(search)
  const querySyncRef = useRef<string | null>(searchParams.toString())
  const [statusFilter, setStatusFilter] = useState<LetterStatus | 'all'>(initialFilters.status)
  const [quickFilter, setQuickFilter] = useState(initialFilters.quickFilter)
  const [ownerFilter, setOwnerFilter] = useState(initialFilters.owner)
  const [typeFilter, setTypeFilter] = useState(initialFilters.type)
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>('letters-view-mode', 'table')
  const [sortBy, setSortBy] = useState<SortField>(initialFilters.sortBy)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialFilters.sortOrder)

  // Saved views
  const [savedViews, setSavedViews] = useLocalStorage<SavedView[]>('letters-saved-views', [])
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const applyingViewRef = useRef(false)

  // Search suggestions
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const suggestionsAbortRef = useRef<AbortController | null>(null)

  // Pagination
  const { page, limit, totalPages, nextPage, prevPage, goToPage, hasNext, hasPrev } = usePagination(
    {
      total: pagination?.total || 0,
      initialPage: initialFilters.page,
      initialLimit: initialFilters.limit,
    }
  )

  // UI state
  const [isMobile, setIsMobile] = useState(false)
  const isInitialLoading = loading && letters.length === 0
  const filtersDisabled = isInitialLoading
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

  // Bulk selection
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

  // Quick preview & keyboard
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const lettersAbortRef = useRef<AbortController | null>(null)
  const lettersRequestIdRef = useRef(0)
  const skipInitialLoadRef = useRef(Boolean(initialData))
  const skipInitialSearchRef = useRef(Boolean(initialData))
  const skipUsersLoadRef = useRef(Boolean(initialData?.users?.length) || !canManageUsers)
  const isFirstFilterLoadRef = useRef(true) // Для отслеживания первой загрузки фильтров
  const lettersCacheRef = useRef<
    Map<string, { letters: Letter[]; pagination: Pagination | null; storedAt: number }>
  >(new Map())
  const usersCacheRef = useRef<{ data: User[]; storedAt: number } | null>(null)

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

  // Saved views handlers
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
      goToPage(1)
    },
    [goToPage, setViewMode]
  )

  const saveCurrentView = useCallback(
    (name: string) => {
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
      setActiveViewId(id)
    },
    [currentViewFilters, setSavedViews]
  )

  const deleteSavedView = useCallback(
    (id: string) => {
      setSavedViews((prev) => prev.filter((view) => view.id !== id))
      if (activeViewId === id) {
        setActiveViewId(null)
      }
    },
    [activeViewId, setSavedViews]
  )

  // Reset active view when filters change
  useEffect(() => {
    if (applyingViewRef.current) {
      applyingViewRef.current = false
      return
    }
    setActiveViewId(null)
  }, [search, statusFilter, quickFilter, ownerFilter, typeFilter, sortBy, sortOrder, viewMode])

  // Keyboard shortcuts
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

  // Mobile detection
  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  // Recent searches
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem('letters-recent-searches')
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.slice(0, 6))
        }
      }
    } catch {
      // ignore
    }
  }, [])

  const saveRecentSearch = useCallback((value: string) => {
    const trimmed = value.trim()
    if (!trimmed || trimmed.length < 2 || typeof window === 'undefined') return
    setRecentSearches((prev) => {
      const normalized = trimmed.toLowerCase()
      const next = [trimmed, ...prev.filter((item) => item.toLowerCase() !== normalized)].slice(
        0,
        6
      )
      try {
        localStorage.setItem('letters-recent-searches', JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([])
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem('letters-recent-searches')
    } catch {
      // ignore
    }
  }, [])

  // Filters open state
  useEffect(() => {
    setFiltersOpen(!isMobile)
  }, [isMobile])

  // Bulk create modal escape
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

  // Search ref sync
  useEffect(() => {
    searchRef.current = search
  }, [search])

  // URL sync
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

  // Data loading
  const loadLetters = useCallback(
    async (options: { showLoading?: boolean; force?: boolean; contentOnly?: boolean } = {}) => {
      const { showLoading = true, force = false, contentOnly = false } = options
      const requestId = ++lettersRequestIdRef.current

      // contentOnly показывает лоадер только над списком писем
      if (contentOnly) {
        setContentLoading(true)
      } else if (showLoading) {
        setLoading(true)
      }

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

        const cacheKey = params.toString()
        const cached = lettersCacheRef.current.get(cacheKey)
        if (!force && cached && Date.now() - cached.storedAt < LETTERS_CACHE_TTL) {
          lettersAbortRef.current?.abort()
          startTransition(() => {
            setLetters(cached.letters)
            setPagination(cached.pagination)
            setSelectedIds((prev) => (prev.size ? new Set() : prev))
          })
          if (requestId === lettersRequestIdRef.current) {
            setLoading(false)
            setContentLoading(false)
            setIsSearching(false)
          }
          return
        }

        const controller = new AbortController()
        if (lettersAbortRef.current) {
          lettersAbortRef.current.abort()
        }
        lettersAbortRef.current = controller

        const res = await fetch(`/api/letters?${params}`, { signal: controller.signal })
        if (!res.ok) throw new Error('Failed to load letters')
        const data = await res.json()
        if (requestId !== lettersRequestIdRef.current) return

        const nextLetters = data.letters || []
        const nextPagination = data.pagination || null
        lettersCacheRef.current.set(cacheKey, {
          letters: nextLetters,
          pagination: nextPagination,
          storedAt: Date.now(),
        })

        startTransition(() => {
          setLetters(nextLetters)
          setPagination(nextPagination)
          setSelectedIds((prev) => (prev.size ? new Set() : prev))
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        console.error('Failed to load letters:', error)
        toastRef.current.error('Не удалось загрузить список писем')
      } finally {
        if (requestId === lettersRequestIdRef.current) {
          setLoading(false)
          setContentLoading(false)
          setIsSearching(false)
        }
      }
    },
    [page, limit, sortBy, sortOrder, statusFilter, quickFilter, ownerFilter, typeFilter]
  )

  const loadUsers = useCallback(async () => {
    try {
      const cached = usersCacheRef.current
      if (cached && Date.now() - cached.storedAt < USERS_CACHE_TTL) {
        setUsers(cached.data)
        return
      }
      const res = await fetch('/api/users')
      const data = await res.json()
      const nextUsers = data.users || []
      usersCacheRef.current = { data: nextUsers, storedAt: Date.now() }
      setUsers(nextUsers)
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
    if (session) {
      saveRecentSearch(searchRef.current)
      loadLetters({ showLoading: false })
    }
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

  const handlePrefetchPage = useCallback(
    (targetPage: number) => {
      const filters: Record<string, unknown> = {
        page: targetPage,
        limit,
        sortBy,
        sortOrder,
      }
      if (statusFilter !== 'all') filters.status = statusFilter
      if (quickFilter) filters.filter = quickFilter
      if (ownerFilter) filters.owner = ownerFilter
      if (typeFilter) filters.type = typeFilter
      if (searchRef.current) filters.search = searchRef.current
      prefetchLetters(filters)
    },
    [limit, sortBy, sortOrder, statusFilter, quickFilter, ownerFilter, typeFilter, prefetchLetters]
  )

  const handleBulkCreateSuccess = useCallback(() => {
    setShowBulkCreate(false)
    loadLetters({ force: true })
  }, [loadLetters])

  const handleQuickFilterChange = useCallback(
    (value: string) => {
      setQuickFilter(value)
      // Не сбрасываем statusFilter - пусть пользователь управляет фильтрами независимо
      // Не сбрасываем ownerFilter - фильтры должны работать в комбинации
      goToPage(1)
    },
    [goToPage]
  )

  // Initial load (только при первом рендере с сессией)
  useEffect(() => {
    if (session) {
      if (skipInitialLoadRef.current) {
        skipInitialLoadRef.current = false
        isFirstFilterLoadRef.current = false
        return
      }
      loadLetters()
      isFirstFilterLoadRef.current = false
    }
  }, [session])

  // Перезагрузка при изменении фильтров (локальный лоадер)
  useEffect(() => {
    if (!session || isFirstFilterLoadRef.current) return
    // Используем contentOnly для показа локального лоадера вместо полной перезагрузки
    loadLetters({ showLoading: false, contentOnly: true })
  }, [page, limit, sortBy, sortOrder, statusFilter, quickFilter, ownerFilter, typeFilter])

  useEffect(() => {
    if (!session || !canManageUsers) return
    if (skipUsersLoadRef.current) {
      skipUsersLoadRef.current = false
      return
    }
    loadUsers()
  }, [session, loadUsers, canManageUsers])

  // Инвалидация кэша при возврате на страницу (popstate/back button)
  // и при возвращении фокуса на вкладку
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Очищаем кэш и перезагружаем данные при возврате на вкладку
        lettersCacheRef.current.clear()
        loadLetters({ showLoading: false, force: true, contentOnly: true })
      }
    }

    const handlePopState = () => {
      // Очищаем кэш при навигации назад/вперед
      lettersCacheRef.current.clear()
      loadLetters({ showLoading: false, force: true, contentOnly: true })
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('popstate', handlePopState)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

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
    if (skipInitialSearchRef.current) {
      skipInitialSearchRef.current = false
      return
    }
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
        loadLetters({ force: true })
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

  // Auth loading
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

      <main
        id="main-content"
        className="animate-pageIn relative mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
      >
        {/* Header with gradient */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-900/80 p-6 md:p-8">
          {/* Decorative elements */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-2xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            {/* Title and stats */}
            <div className="flex-1">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 p-3 shadow-lg shadow-teal-500/25">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="font-display text-3xl font-bold text-white md:text-4xl">Письма</h1>
                  {pagination && (
                    <p className="text-sm text-slate-400">
                      Всего <span className="font-semibold text-teal-400">{pagination.total}</span>{' '}
                      {pluralizeLetters(pagination.total)}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats cards */}
              {pagination && (
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 rounded-lg bg-slate-700/40 px-3 py-2">
                    <div className="h-2 w-2 rounded-full bg-red-400" />
                    <span className="text-xs text-slate-300">
                      Просрочено:{' '}
                      <span className="font-semibold text-red-400">
                        {
                          letters.filter((l) => {
                            const days = Math.ceil(
                              (new Date(l.deadlineDate).getTime() - Date.now()) /
                                (1000 * 60 * 60 * 24)
                            )
                            return days < 0 && l.status !== 'DONE' && l.status !== 'READY'
                          }).length
                        }
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-slate-700/40 px-3 py-2">
                    <div className="h-2 w-2 rounded-full bg-yellow-400" />
                    <span className="text-xs text-slate-300">
                      Срочно:{' '}
                      <span className="font-semibold text-yellow-400">
                        {
                          letters.filter((l) => {
                            const days = Math.ceil(
                              (new Date(l.deadlineDate).getTime() - Date.now()) /
                                (1000 * 60 * 60 * 24)
                            )
                            return (
                              days >= 0 && days <= 3 && l.status !== 'DONE' && l.status !== 'READY'
                            )
                          }).length
                        }
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-slate-700/40 px-3 py-2">
                    <div className="h-2 w-2 rounded-full bg-teal-400" />
                    <span className="text-xs text-slate-300">
                      В работе:{' '}
                      <span className="font-semibold text-teal-400">
                        {letters.filter((l) => l.status === 'IN_PROGRESS').length}
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 lg:flex-nowrap">
              <a
                href={`/api/export?${new URLSearchParams({
                  ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
                  ...(quickFilter ? { filter: quickFilter } : {}),
                  ...(ownerFilter ? { owner: ownerFilter } : {}),
                  ...(typeFilter ? { type: typeFilter } : {}),
                  ...(selectedIds.size > 0 ? { ids: Array.from(selectedIds).join(',') } : {}),
                }).toString()}`}
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600/50 bg-slate-700/50 px-4 py-2.5 text-sm font-medium text-slate-200 transition-all hover:border-slate-500 hover:bg-slate-700 hover:text-white"
              >
                <Download className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
                Экспорт
              </a>
              <button
                type="button"
                onClick={() => setShowBulkCreate(true)}
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600/50 bg-slate-700/50 px-4 py-2.5 text-sm font-medium text-slate-200 transition-all hover:border-slate-500 hover:bg-slate-700 hover:text-white"
              >
                <ListPlus className="h-4 w-4 transition-transform group-hover:scale-110" />
                Импорт
              </button>
              <Link
                href="/letters/new"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition-all hover:shadow-teal-500/40 hover:brightness-110"
              >
                <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                Новое письмо
              </Link>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        <LettersBulkActions
          selectedCount={selectedIds.size}
          bulkAction={bulkAction}
          bulkValue={bulkValue}
          bulkLoading={bulkLoading}
          users={users}
          userRole={session.user.role}
          statuses={STATUSES}
          onBulkActionChange={setBulkAction}
          onBulkValueChange={setBulkValue}
          onExecute={executeBulkAction}
          onClear={() => {
            setSelectedIds(new Set())
            setBulkAction(null)
            setBulkValue('')
          }}
        />

        {/* Quick Filters */}
        <LettersQuickFilters value={quickFilter} onChange={handleQuickFilterChange} />

        {/* Filters Row */}
        <div className="relative z-20 mb-6 rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-800/60 p-4 backdrop-blur-sm lg:sticky lg:top-20 lg:z-30">
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center">
            {/* Search */}
            <div className="w-full min-w-0 lg:flex-[1_1_100%] lg:basis-full">
              <div className="relative">
                <div
                  className={`absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg ${
                    isSearching ? 'bg-teal-500/20' : 'bg-slate-700/50'
                  }`}
                >
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
                  ) : (
                    <Search className="h-4 w-4 text-slate-400" />
                  )}
                </div>
                {isInitialLoading ? (
                  <div
                    className="animate-shimmer h-12 w-full rounded-xl bg-slate-700/30"
                    aria-hidden="true"
                  />
                ) : (
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Поиск по номеру, организации, содержанию, Jira и ответам..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setSelectedSuggestionIndex(-1)
                    }}
                    onFocus={() => {
                      setIsSearchFocused(true)
                      setSelectedSuggestionIndex(-1)
                      if (searchSuggestions.length > 0 || recentSearches.length > 0) {
                        setSuggestionsOpen(true)
                      }
                    }}
                    onBlur={() => {
                      setIsSearchFocused(false)
                      window.setTimeout(() => {
                        setSuggestionsOpen(false)
                        setSelectedSuggestionIndex(-1)
                      }, 150)
                    }}
                    onKeyDown={(e) => {
                      if (!suggestionsOpen) return

                      // Подсчёт общего количества элементов для навигации
                      const trimmedSearch = search.trim()
                      const autocompleteSuggestions = trimmedSearch
                        ? Array.from(
                            new Set(
                              searchSuggestions
                                .flatMap((s) => [s.org, s.number])
                                .filter(
                                  (text) =>
                                    text.toLowerCase().includes(trimmedSearch.toLowerCase()) &&
                                    text.toLowerCase() !== trimmedSearch.toLowerCase()
                                )
                            )
                          ).slice(0, 3)
                        : []
                      const totalItems = trimmedSearch
                        ? autocompleteSuggestions.length + searchSuggestions.length
                        : recentSearches.length

                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setSelectedSuggestionIndex((prev) =>
                          prev < totalItems - 1 ? prev + 1 : prev
                        )
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        setSelectedSuggestionIndex((prev) => (prev > -1 ? prev - 1 : -1))
                      } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
                        e.preventDefault()
                        if (!trimmedSearch) {
                          // Последние поиски
                          if (recentSearches[selectedSuggestionIndex]) {
                            setSearch(recentSearches[selectedSuggestionIndex])
                            setSuggestionsOpen(false)
                            setSelectedSuggestionIndex(-1)
                          }
                        } else if (selectedSuggestionIndex < autocompleteSuggestions.length) {
                          // Autocomplete
                          setSearch(autocompleteSuggestions[selectedSuggestionIndex])
                          setSelectedSuggestionIndex(-1)
                        } else {
                          // Выбор письма
                          const letterIndex =
                            selectedSuggestionIndex - autocompleteSuggestions.length
                          if (searchSuggestions[letterIndex]) {
                            router.push(`/letters/${searchSuggestions[letterIndex].id}`)
                          }
                        }
                      } else if (
                        e.key === 'Tab' &&
                        trimmedSearch &&
                        autocompleteSuggestions.length > 0
                      ) {
                        e.preventDefault()
                        const idx =
                          selectedSuggestionIndex >= 0 &&
                          selectedSuggestionIndex < autocompleteSuggestions.length
                            ? selectedSuggestionIndex
                            : 0
                        setSearch(autocompleteSuggestions[idx])
                        setSelectedSuggestionIndex(-1)
                      } else if (e.key === 'Escape') {
                        setSuggestionsOpen(false)
                        setSelectedSuggestionIndex(-1)
                        searchInputRef.current?.blur()
                      }
                    }}
                    className="h-12 w-full rounded-xl border border-slate-600/50 bg-slate-700/30 pl-14 pr-12 text-white placeholder-slate-400 transition-all focus:border-teal-500/50 focus:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    aria-label="Поиск"
                    aria-expanded={suggestionsOpen}
                    aria-haspopup="listbox"
                    role="combobox"
                    autoComplete="off"
                  />
                )}
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-slate-600/50 p-1.5 text-slate-400 transition hover:bg-slate-600 hover:text-white"
                    aria-label="Очистить поиск"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                {(suggestionsOpen ||
                  suggestionsLoading ||
                  (isSearchFocused && !search.trim() && recentSearches.length > 0)) && (
                  <LettersSearchSuggestions
                    search={search}
                    suggestions={searchSuggestions}
                    recentSearches={recentSearches}
                    isLoading={suggestionsLoading}
                    selectedIndex={selectedSuggestionIndex}
                    onSelectRecent={(value) => {
                      setSearch(value)
                      setSuggestionsOpen(false)
                      setSelectedSuggestionIndex(-1)
                    }}
                    onClearRecent={clearRecentSearches}
                    onAutoComplete={(value) => {
                      setSearch(value)
                      setSelectedSuggestionIndex(-1)
                    }}
                    onSelectSuggestion={(suggestion) => {
                      router.push(`/letters/${suggestion.id}`)
                    }}
                  />
                )}
              </div>

              <p className="mt-2 hidden text-xs text-slate-500 md:block">
                Поиск по номеру, организации, содержанию, Jira ссылкам и ответам
              </p>
            </div>

            <button
              onClick={() => setFiltersOpen((prev) => !prev)}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-all sm:hidden ${
                filtersOpen
                  ? 'bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/30'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
              aria-expanded={filtersOpen}
              aria-controls="letters-filters"
            >
              <Filter className="h-4 w-4" />
              {activeFiltersCount > 0 ? `Фильтры (${activeFiltersCount})` : 'Фильтры'}
            </button>

            {!filtersOpen && activeFiltersCount > 0 && (
              <div className="flex w-full flex-wrap gap-2 sm:hidden">
                {search && (
                  <span className="rounded-lg bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-300 ring-1 ring-teal-500/20">
                    Поиск: {search}
                  </span>
                )}
                {statusFilter !== 'all' && (
                  <span className="rounded-lg bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-300 ring-1 ring-blue-500/20">
                    {STATUS_LABELS[statusFilter as LetterStatus]}
                  </span>
                )}
                {quickFilter && (
                  <span className="rounded-lg bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-300 ring-1 ring-purple-500/20">
                    {QUICK_FILTERS.find((item) => item.value === quickFilter)?.label || quickFilter}
                  </span>
                )}
                {ownerFilter && (
                  <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/20">
                    {users.find((user) => user.id === ownerFilter)?.name ||
                      users.find((user) => user.id === ownerFilter)?.email ||
                      ownerFilter}
                  </span>
                )}
                {typeFilter && (
                  <span className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-500/20">
                    {LETTER_TYPES.find((item) => item.value === typeFilter)?.label || typeFilter}
                  </span>
                )}
                <button
                  onClick={resetFilters}
                  className="rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300 ring-1 ring-red-500/20 transition hover:bg-red-500/20"
                  aria-label="Сбросить фильтры"
                >
                  Сбросить
                </button>
              </div>
            )}

            <div
              id="letters-filters"
              className={`${filtersOpen ? 'flex' : 'hidden'} w-full flex-col gap-3 sm:flex sm:w-full sm:flex-row sm:flex-wrap lg:w-auto xl:flex-nowrap`}
            >
              {/* Status filter */}
              <div className="group flex w-full items-center gap-2 rounded-xl bg-slate-700/30 p-1.5 ring-1 ring-slate-600/50 transition-all focus-within:ring-teal-500/50 sm:w-auto sm:min-w-[190px]">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
                  <Filter className="h-4 w-4 text-blue-400" />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as LetterStatus | 'all')
                    // Не сбрасываем quickFilter - фильтры работают независимо
                    goToPage(1)
                  }}
                  disabled={filtersDisabled}
                  className="h-8 min-w-0 flex-1 appearance-none bg-transparent pr-8 text-sm text-white focus:outline-none disabled:opacity-50"
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

              <div className="group flex w-full items-center gap-2 rounded-xl bg-slate-700/30 p-1.5 ring-1 ring-slate-600/50 transition-all focus-within:ring-teal-500/50 sm:w-auto sm:min-w-[210px]">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
                  <Users className="h-4 w-4 text-emerald-400" />
                </div>
                <select
                  value={ownerFilter}
                  onChange={(e) => {
                    setOwnerFilter(e.target.value)
                    // Не сбрасываем quickFilter - фильтры работают независимо
                    goToPage(1)
                  }}
                  disabled={filtersDisabled}
                  className="h-8 min-w-0 flex-1 appearance-none bg-transparent pr-8 text-sm text-white focus:outline-none disabled:opacity-50"
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

              <div className="group flex w-full items-center gap-2 rounded-xl bg-slate-700/30 p-1.5 ring-1 ring-slate-600/50 transition-all focus-within:ring-teal-500/50 sm:w-auto sm:min-w-[190px]">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20">
                  <FileText className="h-4 w-4 text-amber-400" />
                </div>
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value)
                    goToPage(1)
                  }}
                  disabled={filtersDisabled}
                  className="h-8 min-w-0 flex-1 appearance-none bg-transparent pr-8 text-sm text-white focus:outline-none disabled:opacity-50"
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
                  className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-500/10 px-4 text-sm font-medium text-red-300 ring-1 ring-red-500/20 transition-all hover:bg-red-500/20 hover:text-red-200 sm:w-auto"
                  aria-label="Сбросить фильтры"
                >
                  <XCircle className="h-4 w-4 transition-transform group-hover:rotate-90" />
                  Сбросить ({activeFiltersCount})
                </button>
              )}
            </div>

            <div className="hidden w-full flex-wrap items-center gap-2 sm:ml-auto sm:flex sm:w-auto">
              {/* Saved views */}
              <LettersSavedViews
                views={savedViews}
                activeViewId={activeViewId}
                onApply={applySavedView}
                onSave={saveCurrentView}
                onDelete={deleteSavedView}
              />

              {/* View toggle */}
              <LettersViewToggle value={viewMode} onChange={setViewMode} />

              {/* Keyboard shortcuts help */}
              <div className="relative hidden sm:block">
                <button
                  onClick={() => (shortcutsOpen ? closeShortcuts() : openShortcuts())}
                  className={`rounded-lg p-2.5 transition-all ${shortcutsOpen ? 'bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/30' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                  title="Горячие клавиши"
                  aria-label="Горячие клавиши"
                >
                  <Keyboard className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="relative">
          {/* Локальный лоадер при изменении фильтров/пагинации */}
          {contentLoading && !loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-900/60 backdrop-blur-sm">
              <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
            </div>
          )}

          {loading ? (
            effectiveViewMode === 'cards' ? (
              <CardsSkeleton count={9} />
            ) : effectiveViewMode === 'kanban' ? (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="animate-shimmer h-96 min-w-[280px] rounded-xl bg-white/5"
                  />
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
        </div>

        {/* Pagination */}
        {pagination && (
          <LettersPagination
            pagination={pagination}
            page={page}
            limit={limit}
            totalPages={totalPages}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={prevPage}
            onNext={nextPage}
            onPrefetchPage={handlePrefetchPage}
          />
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

export default function LettersPage({ initialData }: LettersPageClientProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-transparent">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-teal-500"></div>
        </div>
      }
    >
      <LettersPageContent initialData={initialData} />
    </Suspense>
  )
}

'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

/**
 * Pagination state
 */
export interface PaginationState {
  page: number
  limit: number
  total: number
  totalPages: number
}

/**
 * Pagination controls
 */
export interface PaginationControls {
  goToPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  setLimit: (limit: number) => void
  hasNext: boolean
  hasPrev: boolean
  pageRange: number[]
}

/**
 * Options for usePagination hook
 */
interface UsePaginationOptions {
  /** Initial page number */
  initialPage?: number

  /** Items per page */
  initialLimit?: number

  /** Total number of items */
  total: number

  /** Sync with URL params */
  syncWithUrl?: boolean

  /** Number of page buttons to show */
  siblingCount?: number

  /** Callback when page changes */
  onPageChange?: (page: number) => void

  /** Callback when limit changes */
  onLimitChange?: (limit: number) => void
}

/**
 * Generate page range for pagination UI
 */
function generatePageRange(
  currentPage: number,
  totalPages: number,
  siblingCount: number
): number[] {
  const totalPageNumbers = siblingCount * 2 + 3 // siblings + current + first + last

  if (totalPages <= totalPageNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1)
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages)

  const shouldShowLeftDots = leftSiblingIndex > 2
  const shouldShowRightDots = rightSiblingIndex < totalPages - 1

  if (!shouldShowLeftDots && shouldShowRightDots) {
    const leftItemCount = 3 + 2 * siblingCount
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1)
    return [...leftRange, -1, totalPages] // -1 represents dots
  }

  if (shouldShowLeftDots && !shouldShowRightDots) {
    const rightItemCount = 3 + 2 * siblingCount
    const rightRange = Array.from(
      { length: rightItemCount },
      (_, i) => totalPages - rightItemCount + i + 1
    )
    return [1, -1, ...rightRange]
  }

  const middleRange = Array.from(
    { length: rightSiblingIndex - leftSiblingIndex + 1 },
    (_, i) => leftSiblingIndex + i
  )
  return [1, -1, ...middleRange, -1, totalPages]
}

/**
 * Hook for pagination with optional URL sync.
 *
 * @example
 * ```tsx
 * function UserList() {
 *   const { data, total } = useFetch('/api/users?page=${page}&limit=${limit}')
 *
 *   const pagination = usePagination({
 *     total,
 *     initialLimit: 20,
 *     syncWithUrl: true,
 *     onPageChange: (page) => refetch()
 *   })
 *
 *   return (
 *     <div>
 *       <UserTable data={data} />
 *       <Pagination {...pagination} />
 *     </div>
 *   )
 * }
 * ```
 */
export function usePagination(options: UsePaginationOptions): PaginationState & PaginationControls {
  const {
    initialPage = 1,
    initialLimit = 10,
    total,
    syncWithUrl = false,
    siblingCount = 1,
    onPageChange,
    onLimitChange,
  } = options

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Get initial values from URL if syncing
  const urlPage = syncWithUrl
    ? parseInt(searchParams.get('page') || String(initialPage))
    : initialPage
  const urlLimit = syncWithUrl
    ? parseInt(searchParams.get('limit') || String(initialLimit))
    : initialLimit

  const [page, setPageState] = useState(urlPage)
  const [limit, setLimitState] = useState(urlLimit)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])

  // Ensure page is within bounds
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPageState(totalPages)
    }
  }, [page, totalPages])

  // Sync URL when state changes
  const updateUrl = useCallback(
    (newPage: number, newLimit: number) => {
      if (!syncWithUrl) return

      const params = new URLSearchParams(searchParams.toString())
      params.set('page', String(newPage))
      params.set('limit', String(newLimit))
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [syncWithUrl, searchParams, pathname, router]
  )

  const goToPage = useCallback(
    (newPage: number) => {
      const validPage = Math.max(1, Math.min(newPage, totalPages))
      setPageState(validPage)
      updateUrl(validPage, limit)
      onPageChange?.(validPage)
    },
    [totalPages, limit, updateUrl, onPageChange]
  )

  const nextPage = useCallback(() => {
    if (page < totalPages) {
      goToPage(page + 1)
    }
  }, [page, totalPages, goToPage])

  const prevPage = useCallback(() => {
    if (page > 1) {
      goToPage(page - 1)
    }
  }, [page, goToPage])

  const setLimit = useCallback(
    (newLimit: number) => {
      setLimitState(newLimit)
      setPageState(1) // Reset to first page
      updateUrl(1, newLimit)
      onLimitChange?.(newLimit)
    },
    [updateUrl, onLimitChange]
  )

  const pageRange = useMemo(
    () => generatePageRange(page, totalPages, siblingCount),
    [page, totalPages, siblingCount]
  )

  return {
    page,
    limit,
    total,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    setLimit,
    hasNext: page < totalPages,
    hasPrev: page > 1,
    pageRange,
  }
}

/**
 * Simple pagination hook without URL sync (for modals, dialogs, etc.)
 */
export function useSimplePagination(
  total: number,
  limit: number = 10
): {
  page: number
  setPage: (page: number) => void
  offset: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
} {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * limit

  return {
    page: safePage,
    setPage: (p) => setPage(Math.max(1, Math.min(p, totalPages))),
    offset,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  }
}

/**
 * Hook for infinite scroll pagination
 */
export function useInfiniteScroll(options: {
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
  threshold?: number
}): {
  sentinelRef: (node: HTMLElement | null) => void
} {
  const { hasMore, isLoading, onLoadMore, threshold = 100 } = options

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      if (!node || isLoading || !hasMore) return

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            onLoadMore()
          }
        },
        { rootMargin: `${threshold}px` }
      )

      observer.observe(node)

      return () => observer.disconnect()
    },
    [hasMore, isLoading, onLoadMore, threshold]
  )

  return { sentinelRef }
}

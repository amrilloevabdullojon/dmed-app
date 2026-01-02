'use client'

import { useRef, useState, useCallback, useEffect, useMemo } from 'react'

/**
 * Virtual list item
 */
export interface VirtualItem {
  index: number
  start: number
  end: number
  size: number
  key: string | number
}

/**
 * Options for useVirtualList
 */
interface UseVirtualListOptions<T> {
  /** Array of items */
  items: T[]

  /** Estimated item height */
  itemHeight: number | ((index: number) => number)

  /** Number of items to render above/below viewport */
  overscan?: number

  /** Get unique key for item */
  getKey?: (item: T, index: number) => string | number

  /** Container height (default: auto-detect) */
  containerHeight?: number

  /** Enable horizontal mode */
  horizontal?: boolean
}

/**
 * Minimal virtual list hook (no dependencies).
 *
 * For more features, use @tanstack/react-virtual.
 *
 * @example
 * ```tsx
 * function BigList({ items }) {
 *   const {
 *     containerRef,
 *     virtualItems,
 *     totalSize,
 *     scrollToIndex
 *   } = useVirtualList({
 *     items,
 *     itemHeight: 50,
 *     overscan: 5
 *   })
 *
 *   return (
 *     <div ref={containerRef} style={{ height: 400, overflow: 'auto' }}>
 *       <div style={{ height: totalSize, position: 'relative' }}>
 *         {virtualItems.map(({ index, start, size }) => (
 *           <div
 *             key={items[index].id}
 *             style={{
 *               position: 'absolute',
 *               top: start,
 *               height: size,
 *               width: '100%'
 *             }}
 *           >
 *             {items[index].name}
 *           </div>
 *         ))}
 *       </div>
 *     </div>
 *   )
 * }
 * ```
 */
export function useVirtualList<T>(options: UseVirtualListOptions<T>): {
  containerRef: React.RefObject<HTMLDivElement>
  virtualItems: VirtualItem[]
  totalSize: number
  scrollToIndex: (index: number, align?: 'start' | 'center' | 'end') => void
  scrollToOffset: (offset: number) => void
  isScrolling: boolean
} {
  const {
    items,
    itemHeight,
    overscan = 3,
    getKey = (_, index) => index,
    containerHeight,
    horizontal = false,
  } = options

  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [viewportSize, setViewportSize] = useState(containerHeight ?? 0)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Calculate item sizes and positions
  const itemMetrics = useMemo(() => {
    const heights: number[] = []
    const offsets: number[] = []
    let offset = 0

    for (let i = 0; i < items.length; i++) {
      const height = typeof itemHeight === 'function' ? itemHeight(i) : itemHeight
      heights.push(height)
      offsets.push(offset)
      offset += height
    }

    return { heights, offsets, totalSize: offset }
  }, [items.length, itemHeight])

  // Find visible range
  const visibleRange = useMemo(() => {
    const { offsets, heights, totalSize } = itemMetrics

    if (items.length === 0 || viewportSize === 0) {
      return { start: 0, end: 0 }
    }

    // Binary search for start index
    let start = 0
    let end = items.length - 1

    while (start < end) {
      const mid = Math.floor((start + end) / 2)
      if (offsets[mid] + heights[mid] < scrollOffset) {
        start = mid + 1
      } else {
        end = mid
      }
    }

    const startIndex = Math.max(0, start - overscan)

    // Find end index
    const endOffset = scrollOffset + viewportSize
    end = start

    while (end < items.length && offsets[end] < endOffset) {
      end++
    }

    const endIndex = Math.min(items.length, end + overscan)

    return { start: startIndex, end: endIndex }
  }, [items.length, itemMetrics, scrollOffset, viewportSize, overscan])

  // Generate virtual items
  const virtualItems = useMemo((): VirtualItem[] => {
    const { offsets, heights } = itemMetrics
    const result: VirtualItem[] = []

    for (let i = visibleRange.start; i < visibleRange.end; i++) {
      result.push({
        index: i,
        start: offsets[i],
        end: offsets[i] + heights[i],
        size: heights[i],
        key: getKey(items[i], i),
      })
    }

    return result
  }, [items, itemMetrics, visibleRange, getKey])

  // Handle scroll
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return

    const offset = horizontal ? containerRef.current.scrollLeft : containerRef.current.scrollTop

    setScrollOffset(offset)
    setIsScrolling(true)

    if (scrollingTimeoutRef.current) {
      clearTimeout(scrollingTimeoutRef.current)
    }

    scrollingTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false)
    }, 150)
  }, [horizontal])

  // Setup scroll listener and resize observer
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      const size = horizontal ? container.clientWidth : container.clientHeight
      setViewportSize(containerHeight ?? size)
    }

    updateSize()

    container.addEventListener('scroll', handleScroll, { passive: true })

    const resizeObserver = new ResizeObserver(updateSize)
    resizeObserver.observe(container)

    return () => {
      container.removeEventListener('scroll', handleScroll)
      resizeObserver.disconnect()

      if (scrollingTimeoutRef.current) {
        clearTimeout(scrollingTimeoutRef.current)
      }
    }
  }, [handleScroll, horizontal, containerHeight])

  // Scroll to specific index
  const scrollToIndex = useCallback(
    (index: number, align: 'start' | 'center' | 'end' = 'start') => {
      if (!containerRef.current || index < 0 || index >= items.length) return

      const { offsets, heights } = itemMetrics
      let offset = offsets[index]

      if (align === 'center') {
        offset = offset - viewportSize / 2 + heights[index] / 2
      } else if (align === 'end') {
        offset = offset - viewportSize + heights[index]
      }

      offset = Math.max(0, Math.min(offset, itemMetrics.totalSize - viewportSize))

      if (horizontal) {
        containerRef.current.scrollLeft = offset
      } else {
        containerRef.current.scrollTop = offset
      }
    },
    [items.length, itemMetrics, viewportSize, horizontal]
  )

  // Scroll to specific offset
  const scrollToOffset = useCallback(
    (offset: number) => {
      if (!containerRef.current) return

      if (horizontal) {
        containerRef.current.scrollLeft = offset
      } else {
        containerRef.current.scrollTop = offset
      }
    },
    [horizontal]
  )

  return {
    containerRef,
    virtualItems,
    totalSize: itemMetrics.totalSize,
    scrollToIndex,
    scrollToOffset,
    isScrolling,
  }
}

/**
 * Hook for window virtualization (full page scroll)
 */
export function useWindowVirtualList<T>(options: {
  items: T[]
  itemHeight: number
  overscan?: number
}): {
  virtualItems: VirtualItem[]
  totalSize: number
  offsetTop: number
} {
  const { items, itemHeight, overscan = 5 } = options
  const [scrollY, setScrollY] = useState(0)
  const [windowHeight, setWindowHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 800
  )

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    const handleResize = () => setWindowHeight(window.innerHeight)

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const totalSize = items.length * itemHeight

  const startIndex = Math.max(0, Math.floor(scrollY / itemHeight) - overscan)
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollY + windowHeight) / itemHeight) + overscan
  )

  const virtualItems: VirtualItem[] = []
  for (let i = startIndex; i < endIndex; i++) {
    virtualItems.push({
      index: i,
      start: i * itemHeight,
      end: (i + 1) * itemHeight,
      size: itemHeight,
      key: i,
    })
  }

  return {
    virtualItems,
    totalSize,
    offsetTop: startIndex * itemHeight,
  }
}

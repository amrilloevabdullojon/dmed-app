'use client'

import { useState, useRef, useEffect, ReactNode, useCallback } from 'react'
import { useUserPreferences } from '@/hooks/useUserPreferences'

interface VirtualizedListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  itemHeight?: number
  overscan?: number
  className?: string
  emptyState?: ReactNode
  loadingState?: ReactNode
  isLoading?: boolean
}

export function VirtualizedList<T>({
  items,
  renderItem,
  itemHeight = 100,
  overscan = 3,
  className = '',
  emptyState,
  loadingState,
  isLoading = false,
}: VirtualizedListProps<T>) {
  const { preferences } = useUserPreferences()
  const listAnimationsEnabled = preferences?.listAnimations ?? true
  const animationsEnabled = preferences?.animations ?? true

  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Вычисляем видимый диапазон элементов
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  )

  const visibleItems = items.slice(startIndex, endIndex + 1)
  const totalHeight = items.length * itemHeight
  const offsetY = startIndex * itemHeight

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight)
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  if (isLoading && loadingState) {
    return <div className={className}>{loadingState}</div>
  }

  if (items.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      onScroll={handleScroll}
      style={{ height: '100%' }}
    >
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            willChange: 'transform',
          }}
        >
          {visibleItems.map((item, index) => {
            const actualIndex = startIndex + index
            const shouldAnimate =
              listAnimationsEnabled && animationsEnabled && scrollTop === 0

            return (
              <div
                key={actualIndex}
                style={{
                  height: `${itemHeight}px`,
                  animationDelay: shouldAnimate ? `${index * 50}ms` : '0ms',
                }}
                className={shouldAnimate ? 'animate-fadeIn' : ''}
              >
                {renderItem(item, actualIndex)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Альтернативная версия с автоматическим определением высоты элементов
export function AutoVirtualizedList<T>({
  items,
  renderItem,
  estimatedItemHeight = 100,
  overscan = 3,
  className = '',
  emptyState,
  loadingState,
  isLoading = false,
}: Omit<VirtualizedListProps<T>, 'itemHeight'> & { estimatedItemHeight?: number }) {
  const { preferences } = useUserPreferences()
  const listAnimationsEnabled = preferences?.listAnimations ?? true
  const animationsEnabled = preferences?.animations ?? true

  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const itemHeights = useRef<Map<number, number>>(new Map())
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const measureItem = useCallback((index: number, element: HTMLDivElement | null) => {
    if (element) {
      itemRefs.current.set(index, element)
      const height = element.getBoundingClientRect().height
      if (height > 0) {
        itemHeights.current.set(index, height)
      }
    }
  }, [])

  const getItemHeight = (index: number) => {
    return itemHeights.current.get(index) || estimatedItemHeight
  }

  const getTotalHeight = () => {
    let height = 0
    for (let i = 0; i < items.length; i++) {
      height += getItemHeight(i)
    }
    return height
  }

  const getOffsetForIndex = (index: number) => {
    let offset = 0
    for (let i = 0; i < index; i++) {
      offset += getItemHeight(i)
    }
    return offset
  }

  // Находим видимые элементы
  const findVisibleRange = () => {
    let startIndex = 0
    let currentOffset = 0

    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(i)
      if (currentOffset + height > scrollTop) {
        startIndex = Math.max(0, i - overscan)
        break
      }
      currentOffset += height
    }

    let endIndex = startIndex
    currentOffset = getOffsetForIndex(startIndex)

    for (let i = startIndex; i < items.length; i++) {
      if (currentOffset > scrollTop + containerHeight) {
        endIndex = Math.min(items.length - 1, i + overscan)
        break
      }
      currentOffset += getItemHeight(i)
      endIndex = i
    }

    return { startIndex, endIndex }
  }

  const { startIndex, endIndex } = findVisibleRange()
  const visibleItems = items.slice(startIndex, endIndex + 1)
  const totalHeight = getTotalHeight()
  const offsetY = getOffsetForIndex(startIndex)

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight)
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  if (isLoading && loadingState) {
    return <div className={className}>{loadingState}</div>
  }

  if (items.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      onScroll={handleScroll}
      style={{ height: '100%' }}
    >
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            willChange: 'transform',
          }}
        >
          {visibleItems.map((item, index) => {
            const actualIndex = startIndex + index
            const shouldAnimate =
              listAnimationsEnabled && animationsEnabled && scrollTop === 0

            return (
              <div
                key={actualIndex}
                ref={(el) => measureItem(actualIndex, el)}
                style={{
                  animationDelay: shouldAnimate ? `${index * 50}ms` : '0ms',
                }}
                className={shouldAnimate ? 'animate-fadeIn' : ''}
              >
                {renderItem(item, actualIndex)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

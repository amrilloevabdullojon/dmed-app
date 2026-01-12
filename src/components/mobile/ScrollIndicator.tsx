'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ScrollIndicatorProps {
  children: React.ReactNode
  className?: string
  showArrows?: boolean
  fadeEdges?: boolean
}

export function ScrollIndicator({
  children,
  className = '',
  showArrows = true,
  fadeEdges = true,
}: ScrollIndicatorProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = () => {
    const element = scrollRef.current
    if (!element) return

    const { scrollLeft, scrollWidth, clientWidth } = element
    setCanScrollLeft(scrollLeft > 10)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
  }

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return

    updateScrollState()

    const handleScroll = () => updateScrollState()
    const handleResize = () => updateScrollState()

    element.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleResize)

    // Check on mount with a small delay for DOM updates
    const timer = setTimeout(updateScrollState, 100)

    return () => {
      element.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
      clearTimeout(timer)
    }
  }, [])

  const scroll = (direction: 'left' | 'right') => {
    const element = scrollRef.current
    if (!element) return

    const scrollAmount = element.clientWidth * 0.8
    element.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  return (
    <div className="relative">
      {/* Left fade */}
      {fadeEdges && canScrollLeft && (
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-8 bg-gradient-to-r from-gray-900 to-transparent" />
      )}

      {/* Right fade */}
      {fadeEdges && canScrollRight && (
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l from-gray-900 to-transparent" />
      )}

      {/* Left arrow */}
      {showArrows && canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-r-lg bg-gray-800/90 p-2 text-white shadow-lg backdrop-blur-sm transition hover:bg-gray-700"
          aria-label="Прокрутить влево"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {/* Right arrow */}
      {showArrows && canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 z-20 -translate-y-1/2 rounded-l-lg bg-gray-800/90 p-2 text-white shadow-lg backdrop-blur-sm transition hover:bg-gray-700"
          aria-label="Прокрутить вправо"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Scrollable content */}
      <div ref={scrollRef} className={`mobile-scroll overflow-x-auto ${className}`}>
        {children}
      </div>

      {/* Scroll dots indicator (alternative to arrows) */}
      {!showArrows && (canScrollLeft || canScrollRight) && (
        <div className="mt-2 flex justify-center gap-1">
          <div
            className={`h-1.5 w-1.5 rounded-full transition ${
              !canScrollLeft ? 'bg-emerald-400' : 'bg-white/20'
            }`}
          />
          <div
            className={`h-1.5 w-1.5 rounded-full transition ${
              canScrollLeft && canScrollRight ? 'bg-emerald-400' : 'bg-white/20'
            }`}
          />
          <div
            className={`h-1.5 w-1.5 rounded-full transition ${
              !canScrollRight ? 'bg-emerald-400' : 'bg-white/20'
            }`}
          />
        </div>
      )}
    </div>
  )
}

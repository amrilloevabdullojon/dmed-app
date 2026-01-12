'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface SwipeableCardProps {
  children: React.ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  leftAction?: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    color: string
  }
  rightAction?: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    color: string
  }
  className?: string
  /**
   * Minimum swipe distance to trigger action (in pixels)
   * @default 80
   */
  threshold?: number
}

export function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  className = '',
  threshold = 80,
}: SwipeableCardProps) {
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchCurrent, setTouchCurrent] = useState<number | null>(null)
  const [isSwiping, setIsSwiping] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const swipeDistance = touchStart !== null && touchCurrent !== null ? touchCurrent - touchStart : 0
  const isSwipeLeft = swipeDistance < -threshold
  const isSwipeRight = swipeDistance > threshold

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
    setIsSwiping(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return
    setTouchCurrent(e.touches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (touchStart === null || touchCurrent === null) {
      resetSwipe()
      return
    }

    const distance = touchCurrent - touchStart

    if (distance < -threshold && onSwipeLeft) {
      onSwipeLeft()
    } else if (distance > threshold && onSwipeRight) {
      onSwipeRight()
    }

    resetSwipe()
  }

  const resetSwipe = () => {
    setTouchStart(null)
    setTouchCurrent(null)
    setIsSwiping(false)
  }

  // Calculate opacity for action indicators
  const leftOpacity = Math.min(Math.abs(swipeDistance) / threshold, 1)
  const rightOpacity = Math.min(Math.abs(swipeDistance) / threshold, 1)

  return (
    <div className="relative overflow-hidden">
      {/* Left Action Background */}
      {leftAction && swipeDistance < 0 && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end px-6 transition-opacity"
          style={{
            backgroundColor: leftAction.color,
            opacity: leftOpacity * 0.9,
            width: Math.abs(swipeDistance),
          }}
        >
          <div className="flex flex-col items-center gap-1 text-white">
            <leftAction.icon className="h-6 w-6" />
            <span className="text-xs font-medium">{leftAction.label}</span>
          </div>
        </div>
      )}

      {/* Right Action Background */}
      {rightAction && swipeDistance > 0 && (
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-start px-6 transition-opacity"
          style={{
            backgroundColor: rightAction.color,
            opacity: rightOpacity * 0.9,
            width: Math.abs(swipeDistance),
          }}
        >
          <div className="flex flex-col items-center gap-1 text-white">
            <rightAction.icon className="h-6 w-6" />
            <span className="text-xs font-medium">{rightAction.label}</span>
          </div>
        </div>
      )}

      {/* Card Content */}
      <div
        ref={cardRef}
        className={`relative transition-transform ${isSwiping ? '' : 'duration-300'} ${className}`}
        style={{
          transform: `translateX(${swipeDistance}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={resetSwipe}
      >
        {children}
      </div>

      {/* Swipe Hint Indicators (show briefly on first render) */}
      {!isSwiping && touchStart === null && (leftAction || rightAction) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-4">
          {rightAction && (
            <div className="animate-pulse text-gray-400">
              <ChevronRight className="h-4 w-4" />
            </div>
          )}
          {leftAction && (
            <div className="animate-pulse text-gray-400">
              <ChevronLeft className="h-4 w-4" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

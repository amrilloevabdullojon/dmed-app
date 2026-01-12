import { useEffect, useRef, useState } from 'react'

export interface SwipeHandlers {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
}

export interface SwipeConfig {
  /**
   * Minimum distance in pixels to trigger a swipe
   * @default 50
   */
  minSwipeDistance?: number
  /**
   * Maximum time in milliseconds for a swipe gesture
   * @default 300
   */
  maxSwipeTime?: number
  /**
   * Prevent default touch behavior
   * @default false
   */
  preventDefaultTouchmoveEvent?: boolean
}

interface TouchPosition {
  x: number
  y: number
  time: number
}

export function useSwipe(handlers: SwipeHandlers, config: SwipeConfig = {}) {
  const { minSwipeDistance = 50, maxSwipeTime = 300, preventDefaultTouchmoveEvent = false } = config

  const touchStart = useRef<TouchPosition | null>(null)
  const touchEnd = useRef<TouchPosition | null>(null)

  const handleTouchStart = (e: TouchEvent) => {
    touchEnd.current = null
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    }
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (preventDefaultTouchmoveEvent) {
      e.preventDefault()
    }
    touchEnd.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    }
  }

  const handleTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return

    const distanceX = touchStart.current.x - touchEnd.current.x
    const distanceY = touchStart.current.y - touchEnd.current.y
    const timeElapsed = touchEnd.current.time - touchStart.current.time

    // Check if swipe is fast enough
    if (timeElapsed > maxSwipeTime) return

    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY)
    const isVerticalSwipe = Math.abs(distanceY) > Math.abs(distanceX)

    if (isHorizontalSwipe) {
      if (Math.abs(distanceX) > minSwipeDistance) {
        if (distanceX > 0) {
          handlers.onSwipeLeft?.()
        } else {
          handlers.onSwipeRight?.()
        }
      }
    } else if (isVerticalSwipe) {
      if (Math.abs(distanceY) > minSwipeDistance) {
        if (distanceY > 0) {
          handlers.onSwipeUp?.()
        } else {
          handlers.onSwipeDown?.()
        }
      }
    }
  }

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  }
}

/**
 * Hook that attaches swipe handlers to a ref element
 */
export function useSwipeRef<T extends HTMLElement>(
  handlers: SwipeHandlers,
  config: SwipeConfig = {}
) {
  const ref = useRef<T>(null)
  const swipeHandlers = useSwipe(handlers, config)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    element.addEventListener('touchstart', swipeHandlers.onTouchStart)
    element.addEventListener('touchmove', swipeHandlers.onTouchMove)
    element.addEventListener('touchend', swipeHandlers.onTouchEnd)

    return () => {
      element.removeEventListener('touchstart', swipeHandlers.onTouchStart)
      element.removeEventListener('touchmove', swipeHandlers.onTouchMove)
      element.removeEventListener('touchend', swipeHandlers.onTouchEnd)
    }
  }, [swipeHandlers])

  return ref
}

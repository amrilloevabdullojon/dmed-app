'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { hapticMedium } from '@/lib/haptic'

interface PullToRefreshProps {
  children: ReactNode
  onRefresh: () => Promise<void>
  disabled?: boolean
}

export function PullToRefresh({ children, onRefresh, disabled = false }: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const touchStartY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const threshold = 80 // Минимальное расстояние для триггера
  const maxPull = 120 // Максимальное расстояние pull

  useEffect(() => {
    const container = containerRef.current
    if (!container || disabled) return

    const handleTouchStart = (e: TouchEvent) => {
      // Проверяем, что scroll находится наверху
      if (window.scrollY === 0) {
        touchStartY.current = e.touches[0].clientY
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (isRefreshing || touchStartY.current === 0) return

      const currentY = e.touches[0].clientY
      const diff = currentY - touchStartY.current

      // Только если тянем вниз и находимся наверху страницы
      if (diff > 0 && window.scrollY === 0) {
        setIsPulling(true)
        // Используем кривую для замедления по мере увеличения расстояния
        const distance = Math.min(diff * 0.5, maxPull)
        setPullDistance(distance)

        // Предотвращаем scroll только если тянем
        if (distance > 10) {
          e.preventDefault()
        }
      }
    }

    const handleTouchEnd = async () => {
      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true)
        hapticMedium()

        try {
          await onRefresh()
        } finally {
          setIsRefreshing(false)
          setIsPulling(false)
          setPullDistance(0)
          touchStartY.current = 0
        }
      } else {
        setIsPulling(false)
        setPullDistance(0)
        touchStartY.current = 0
      }
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isPulling, isRefreshing, pullDistance, onRefresh, disabled])

  const rotation = (pullDistance / threshold) * 360
  const scale = Math.min(pullDistance / threshold, 1)
  const opacity = Math.min(pullDistance / threshold, 1)

  return (
    <div ref={containerRef} className="relative">
      {/* Pull indicator */}
      <div
        className="pointer-events-none fixed left-1/2 z-50 flex -translate-x-1/2 items-center justify-center transition-all duration-200"
        style={{
          top: `${Math.min(pullDistance, 60)}px`,
          opacity: opacity,
          transform: `translateX(-50%) scale(${scale})`,
        }}
      >
        <div className="rounded-full bg-gray-800/95 p-3 shadow-lg backdrop-blur-md">
          <RefreshCw
            className={`h-5 w-5 text-teal-400 ${isRefreshing ? 'animate-spin' : ''}`}
            style={{
              transform: isRefreshing ? 'none' : `rotate(${rotation}deg)`,
              transition: isRefreshing ? 'none' : 'transform 0.1s ease-out',
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          transform: `translateY(${isPulling || isRefreshing ? Math.min(pullDistance * 0.3, 30) : 0}px)`,
          transition: isPulling ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  )
}

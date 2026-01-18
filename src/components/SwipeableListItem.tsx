'use client'

import { useState, useRef, ReactNode } from 'react'
import { hapticLight, hapticMedium } from '@/lib/haptic'

export interface SwipeAction {
  icon: React.ComponentType<{ className?: string }>
  label: string
  color: 'danger' | 'warning' | 'primary' | 'success'
  onClick: () => void | Promise<void>
}

interface SwipeableListItemProps {
  children: ReactNode
  leftActions?: SwipeAction[]
  rightActions?: SwipeAction[]
  threshold?: number
}

const colorClasses = {
  danger: 'bg-red-500 text-white',
  warning: 'bg-amber-500 text-white',
  primary: 'bg-teal-500 text-white',
  success: 'bg-emerald-500 text-white',
}

export function SwipeableListItem({
  children,
  leftActions = [],
  rightActions = [],
  threshold = 80,
}: SwipeableListItemProps) {
  const [swipeX, setSwipeX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const touchStartX = useRef(0)
  const touchStartTime = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const maxSwipe = 200

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartTime.current = Date.now()
    setIsSwiping(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return

    const currentX = e.touches[0].clientX
    const diff = currentX - touchStartX.current

    // Ограничиваем свайп в зависимости от наличия действий
    const maxLeft = leftActions.length > 0 ? maxSwipe : 0
    const maxRight = rightActions.length > 0 ? -maxSwipe : 0

    const newSwipeX = Math.max(maxRight, Math.min(diff, maxLeft))
    setSwipeX(newSwipeX)

    // Haptic feedback при достижении threshold
    if (Math.abs(newSwipeX) >= threshold && Math.abs(swipeX) < threshold) {
      hapticLight()
    }
  }

  const handleTouchEnd = async () => {
    setIsSwiping(false)

    // Быстрый свайп
    const swipeTime = Date.now() - touchStartTime.current
    const isQuickSwipe = swipeTime < 250

    // Определяем, какое действие выполнить
    if (Math.abs(swipeX) >= threshold || (isQuickSwipe && Math.abs(swipeX) > 50)) {
      const actions = swipeX > 0 ? leftActions : rightActions
      const actionIndex = Math.min(
        Math.floor((Math.abs(swipeX) / maxSwipe) * actions.length),
        actions.length - 1
      )

      if (actions[actionIndex]) {
        hapticMedium()
        await actions[actionIndex].onClick()
      }
    }

    // Возвращаем в исходное положение
    setSwipeX(0)
  }

  const renderActions = (actions: SwipeAction[], side: 'left' | 'right') => {
    if (actions.length === 0) return null

    const visible = side === 'left' ? swipeX > 0 : swipeX < 0
    const progress = Math.min(Math.abs(swipeX) / maxSwipe, 1)

    return (
      <div
        className={`absolute inset-y-0 flex ${side === 'left' ? 'left-0' : 'right-0'}`}
        style={{
          width: `${Math.abs(swipeX)}px`,
          opacity: visible ? 1 : 0,
        }}
      >
        {actions.map((action, index) => {
          const Icon = action.icon
          const actionWidth = Math.abs(swipeX) / actions.length

          return (
            <div
              key={index}
              className={`flex flex-col items-center justify-center ${colorClasses[action.color]}`}
              style={{
                width: `${actionWidth}px`,
                opacity: progress,
                transform: `scale(${0.8 + progress * 0.2})`,
                transition: 'all 0.2s ease-out',
              }}
            >
              <Icon className="h-5 w-5" />
              <span className="mt-1 text-xs font-medium">{action.label}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      {/* Left actions */}
      {renderActions(leftActions, 'left')}

      {/* Right actions */}
      {renderActions(rightActions, 'right')}

      {/* Content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
        }}
        className="relative bg-gray-800"
      >
        {children}
      </div>
    </div>
  )
}

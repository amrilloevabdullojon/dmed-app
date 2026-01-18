'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingStateProps {
  /**
   * Показывать ли компонент загрузки
   */
  loading: boolean

  /**
   * Компонент для отображения во время загрузки
   */
  skeleton?: React.ReactNode

  /**
   * Дочерние элементы для отображения после загрузки
   */
  children: React.ReactNode

  /**
   * Класс для обёртки
   */
  className?: string

  /**
   * Минимальное время отображения загрузки (мс)
   * Предотвращает мелькание для быстрых загрузок
   */
  minLoadingTime?: number
}

/**
 * Компонент для управления состоянием загрузки
 *
 * @example
 * ```tsx
 * <LoadingState loading={isLoading} skeleton={<LetterListSkeleton />}>
 *   <LetterList letters={letters} />
 * </LoadingState>
 * ```
 */
export function LoadingState({
  loading,
  skeleton,
  children,
  className,
  minLoadingTime = 0,
}: LoadingStateProps) {
  const [showLoading, setShowLoading] = React.useState(loading)

  React.useEffect(() => {
    if (loading) {
      setShowLoading(true)
    } else if (minLoadingTime > 0) {
      const timer = setTimeout(() => {
        setShowLoading(false)
      }, minLoadingTime)
      return () => clearTimeout(timer)
    } else {
      setShowLoading(false)
    }
  }, [loading, minLoadingTime])

  if (showLoading) {
    return skeleton ? (
      <div className={className}>{skeleton}</div>
    ) : (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return <div className={className}>{children}</div>
}

/**
 * Inline загрузчик для кнопок и небольших элементов
 */
export function InlineLoader({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} />
}

/**
 * Полноэкранный загрузчик
 */
export function FullPageLoader({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900/95 backdrop-blur-sm">
      <Loader2 className="mb-4 h-12 w-12 animate-spin text-emerald-500" />
      {message && <p className="text-sm text-gray-400">{message}</p>}
    </div>
  )
}

/**
 * Загрузчик для карточки/панели
 */
export function PanelLoader({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12">
      <Loader2 className="mb-3 h-8 w-8 animate-spin text-emerald-500" />
      {message && <p className="text-sm text-gray-400">{message}</p>}
    </div>
  )
}

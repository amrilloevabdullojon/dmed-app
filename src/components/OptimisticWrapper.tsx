'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { Loader2 } from 'lucide-react'

interface OptimisticWrapperProps {
  children: ReactNode
  isOptimistic?: boolean
  isPending?: boolean
  showLoader?: boolean
  opacity?: number
  className?: string
}

/**
 * Визуальная обёртка для optimistic updates
 * Показывает индикаторы загрузки и затемнение во время операции
 */
export function OptimisticWrapper({
  children,
  isOptimistic = false,
  isPending = false,
  showLoader = true,
  opacity = 0.6,
  className = '',
}: OptimisticWrapperProps) {
  const { preferences } = useUserPreferences()
  const animationsEnabled = preferences?.animations ?? true

  const isLoading = isOptimistic || isPending

  return (
    <div className={`relative ${className}`}>
      {/* Overlay with loader */}
      {isLoading && (
        <div
          className={`absolute inset-0 z-10 flex items-center justify-center bg-gray-900/20 backdrop-blur-[2px] ${
            animationsEnabled ? 'animate-fadeIn' : ''
          }`}
          style={{ opacity }}
        >
          {showLoader && (
            <div className="rounded-full bg-gray-800/90 p-3 shadow-lg">
              <Loader2 className="h-5 w-5 animate-spin text-teal-400" />
            </div>
          )}
        </div>
      )}

      {/* Content with reduced opacity during operation */}
      <div
        className={`transition-opacity duration-200 ${isLoading ? 'pointer-events-none opacity-60' : 'opacity-100'}`}
      >
        {children}
      </div>
    </div>
  )
}

interface OptimisticListItemProps {
  children: ReactNode
  id: string
  pendingIds: Set<string>
  className?: string
  showPulse?: boolean
}

/**
 * Компонент для отдельного элемента списка с optimistic updates
 * Показывает пульсацию для элементов в процессе обновления
 */
export function OptimisticListItem({
  children,
  id,
  pendingIds,
  className = '',
  showPulse = true,
}: OptimisticListItemProps) {
  const { preferences } = useUserPreferences()
  const animationsEnabled = preferences?.animations ?? true
  const isPending = pendingIds.has(id)

  return (
    <div
      className={`relative ${className} ${isPending && showPulse && animationsEnabled ? 'animate-pulse' : ''}`}
    >
      {isPending && (
        <div className="absolute left-0 top-0 h-full w-1 bg-teal-500/50 animate-pulse" />
      )}
      <div className={`transition-opacity ${isPending ? 'opacity-70' : 'opacity-100'}`}>
        {children}
      </div>
    </div>
  )
}

interface OptimisticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isOptimistic?: boolean
  loadingText?: string
  children: ReactNode
}

/**
 * Кнопка с индикатором optimistic operation
 */
export function OptimisticButton({
  isOptimistic = false,
  loadingText,
  children,
  disabled,
  className = '',
  ...props
}: OptimisticButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || isOptimistic}
      className={`relative ${className} ${isOptimistic ? 'cursor-wait' : ''}`}
    >
      <span className={isOptimistic ? 'invisible' : 'visible'}>{children}</span>
      {isOptimistic && (
        <span className="absolute inset-0 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingText && <span>{loadingText}</span>}
        </span>
      )}
    </button>
  )
}

interface OptimisticBadgeProps {
  show: boolean
  label?: string
  className?: string
}

/**
 * Бейдж для индикации optimistic состояния
 */
export function OptimisticBadge({ show, label = 'Сохранение...', className = '' }: OptimisticBadgeProps) {
  const { preferences } = useUserPreferences()
  const animationsEnabled = preferences?.animations ?? true
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (show) {
      setIsVisible(true)
    } else {
      const timeout = setTimeout(() => setIsVisible(false), 300)
      return () => clearTimeout(timeout)
    }
  }, [show])

  if (!isVisible) return null

  return (
    <div
      className={`flex items-center gap-2 rounded-full bg-teal-500/15 px-3 py-1 text-xs text-teal-300 ${
        animationsEnabled ? (show ? 'animate-fadeIn' : 'animate-fadeOut') : ''
      } ${className}`}
    >
      <Loader2 className="h-3 w-3 animate-spin" />
      {label}
    </div>
  )
}

/**
 * Утилиты для создания optimistic updates
 */
export const optimisticHelpers = {
  /**
   * Добавляет элемент в массив с временным ID
   */
  addToArray: <T extends { id: string }>(array: T[], item: Omit<T, 'id'>): T[] => {
    const tempId = `temp-${Date.now()}-${Math.random()}`
    return [...array, { ...item, id: tempId } as T]
  },

  /**
   * Обновляет элемент в массиве по ID
   */
  updateInArray: <T extends { id: string }>(
    array: T[],
    id: string,
    updates: Partial<T>
  ): T[] => {
    return array.map((item) => (item.id === id ? { ...item, ...updates } : item))
  },

  /**
   * Удаляет элемент из массива по ID
   */
  removeFromArray: <T extends { id: string }>(array: T[], id: string): T[] => {
    return array.filter((item) => item.id !== id)
  },

  /**
   * Переставляет элемент в массиве
   */
  moveInArray<T>(array: T[], fromIndex: number, toIndex: number): T[] {
    const result = [...array]
    const [removed] = result.splice(fromIndex, 1)
    result.splice(toIndex, 0, removed)
    return result
  },

  /**
   * Обновляет вложенное свойство объекта
   */
  updateNested: <T extends Record<string, any>>(
    obj: T,
    path: string,
    value: any
  ): T => {
    const keys = path.split('.')
    const result = { ...obj }
    let current: any = result

    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = { ...current[keys[i]] }
      current = current[keys[i]]
    }

    current[keys[keys.length - 1]] = value
    return result
  },

  /**
   * Генерирует временный ID
   */
  generateTempId: (): string => {
    return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  },

  /**
   * Проверяет, является ли ID временным
   */
  isTempId: (id: string): boolean => {
    return id.startsWith('temp-')
  },
}

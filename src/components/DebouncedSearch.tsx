'use client'

import React, { useState } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'

interface DebouncedSearchProps {
  /**
   * Placeholder текст
   */
  placeholder?: string

  /**
   * Callback при изменении значения (debounced)
   */
  onSearch: (query: string) => void

  /**
   * Задержка debounce в мс
   */
  delay?: number

  /**
   * Начальное значение
   */
  initialValue?: string

  /**
   * Показывать ли индикатор загрузки
   */
  loading?: boolean

  /**
   * Дополнительные классы
   */
  className?: string

  /**
   * Автофокус при монтировании
   */
  autoFocus?: boolean
}

/**
 * Компонент поиска с debouncing для оптимизации запросов
 *
 * @example
 * ```tsx
 * <DebouncedSearch
 *   placeholder="Поиск писем..."
 *   onSearch={(query) => setSearchQuery(query)}
 *   delay={300}
 *   loading={isSearching}
 * />
 * ```
 */
export function DebouncedSearch({
  placeholder = 'Поиск...',
  onSearch,
  delay = 300,
  initialValue = '',
  loading = false,
  className,
  autoFocus = false,
}: DebouncedSearchProps) {
  const [value, setValue] = useState(initialValue)
  const debouncedValue = useDebounce(value, delay)

  // Вызываем onSearch при изменении debounced значения
  React.useEffect(() => {
    onSearch(debouncedValue)
  }, [debouncedValue, onSearch])

  const handleClear = () => {
    setValue('')
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
  }

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full rounded-lg border border-gray-700 bg-gray-800/50 py-2 pl-10 pr-10 text-sm text-white placeholder-gray-500 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
          ) : value ? (
            <button
              onClick={handleClear}
              className="text-gray-400 transition hover:text-white"
              aria-label="Очистить"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Показываем подсказку о debouncing */}
      {value && value !== debouncedValue && (
        <div className="absolute right-0 top-full mt-1 text-xs text-gray-500">
          Поиск...
        </div>
      )}
    </div>
  )
}

/**
 * Компактная версия для toolbar
 */
export function CompactSearch({
  onSearch,
  delay = 300,
  className,
}: Pick<DebouncedSearchProps, 'onSearch' | 'delay' | 'className'>) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [value, setValue] = useState('')
  const debouncedValue = useDebounce(value, delay)

  React.useEffect(() => {
    onSearch(debouncedValue)
  }, [debouncedValue, onSearch])

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg bg-gray-800/50 text-gray-400 transition hover:bg-gray-700 hover:text-white',
          className
        )}
        aria-label="Открыть поиск"
      >
        <Search className="h-4 w-4" />
      </button>
    )
  }

  return (
    <div className={cn('relative w-64 transition-all', className)}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Поиск..."
        autoFocus
        onBlur={() => {
          if (!value) setIsExpanded(false)
        }}
        className="w-full rounded-lg border border-gray-700 bg-gray-800/50 py-2 pl-9 pr-9 text-sm text-white placeholder-gray-500 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      />
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      {value && (
        <button
          onClick={() => {
            setValue('')
            setIsExpanded(false)
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

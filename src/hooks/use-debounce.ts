import { useEffect, useState } from 'react'

/**
 * Hook для debounce значения
 *
 * @param value - Значение для debounce
 * @param delay - Задержка в миллисекундах (по умолчанию 500мс)
 * @returns Debounced значение
 *
 * @example
 * ```tsx
 * const [searchQuery, setSearchQuery] = useState('')
 * const debouncedSearch = useDebounce(searchQuery, 500)
 *
 * useEffect(() => {
 *   // Этот эффект будет вызван только после 500мс бездействия
 *   fetchSearchResults(debouncedSearch)
 * }, [debouncedSearch])
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    // Устанавливаем таймер для обновления debounced значения
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Очищаем таймер при каждом изменении value или delay
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Hook для debounce callback функции
 *
 * @param callback - Функция для debounce
 * @param delay - Задержка в миллисекундах
 * @returns Debounced функция
 *
 * @example
 * ```tsx
 * const handleSearch = useDebouncedCallback(
 *   (query: string) => {
 *     fetchSearchResults(query)
 *   },
 *   500
 * )
 * ```
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 500
): (...args: Parameters<T>) => void {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    const newTimeoutId = setTimeout(() => {
      callback(...args)
    }, delay)

    setTimeoutId(newTimeoutId)
  }
}

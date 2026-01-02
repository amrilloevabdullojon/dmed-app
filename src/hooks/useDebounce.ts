'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Hook that debounces a value.
 * Returns the debounced value that only updates after the specified delay.
 *
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds
 * @returns The debounced value
 *
 * @example
 * ```tsx
 * const [search, setSearch] = useState('')
 * const debouncedSearch = useDebounce(search, 300)
 *
 * useEffect(() => {
 *   if (debouncedSearch) {
 *     fetchResults(debouncedSearch)
 *   }
 * }, [debouncedSearch])
 * ```
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Hook that returns a debounced callback function.
 * The callback will only be called after the specified delay since the last call.
 *
 * @param callback - The callback function to debounce
 * @param delay - The delay in milliseconds
 * @returns The debounced callback function
 *
 * @example
 * ```tsx
 * const handleSearch = useDebouncedCallback((query: string) => {
 *   fetchResults(query)
 * }, 300)
 *
 * return <input onChange={(e) => handleSearch(e.target.value)} />
 * ```
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const callbackRef = useRef(callback)

  // Update ref when callback changes
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    },
    [delay]
  )
}

/**
 * Hook that returns a debounced state with immediate update capability.
 * Useful when you need both immediate UI updates and debounced API calls.
 *
 * @param initialValue - The initial value
 * @param delay - The delay in milliseconds
 * @returns [value, debouncedValue, setValue]
 *
 * @example
 * ```tsx
 * const [search, debouncedSearch, setSearch] = useDebouncedState('', 300)
 *
 * // search updates immediately for UI
 * // debouncedSearch updates after 300ms for API calls
 * useEffect(() => {
 *   if (debouncedSearch) {
 *     fetchResults(debouncedSearch)
 *   }
 * }, [debouncedSearch])
 *
 * return <input value={search} onChange={(e) => setSearch(e.target.value)} />
 * ```
 */
export function useDebouncedState<T>(initialValue: T, delay: number): [T, T, (value: T) => void] {
  const [value, setValue] = useState<T>(initialValue)
  const debouncedValue = useDebounce(value, delay)

  return [value, debouncedValue, setValue]
}

/**
 * Hook that returns a throttled callback function.
 * The callback will be called at most once per delay period.
 *
 * @param callback - The callback function to throttle
 * @param delay - The minimum time between calls in milliseconds
 * @returns The throttled callback function
 *
 * @example
 * ```tsx
 * const handleScroll = useThrottledCallback(() => {
 *   updateScrollPosition()
 * }, 100)
 *
 * useEffect(() => {
 *   window.addEventListener('scroll', handleScroll)
 *   return () => window.removeEventListener('scroll', handleScroll)
 * }, [handleScroll])
 * ```
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const lastCallRef = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()
      const timeSinceLastCall = now - lastCallRef.current

      if (timeSinceLastCall >= delay) {
        lastCallRef.current = now
        callbackRef.current(...args)
      } else {
        // Schedule a call for the end of the throttle period
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now()
          callbackRef.current(...args)
        }, delay - timeSinceLastCall)
      }
    },
    [delay]
  )
}

/**
 * Hook that returns a debounced callback with cancel and flush capabilities.
 *
 * @param callback - The callback function to debounce
 * @param delay - The delay in milliseconds
 * @returns Object with debounced function, cancel, and flush methods
 *
 * @example
 * ```tsx
 * const { debouncedFn, cancel, flush } = useDebouncedCallbackWithControl(
 *   (value: string) => saveToServer(value),
 *   1000
 * )
 *
 * // On component unmount, either cancel or flush pending calls
 * useEffect(() => () => flush(), [flush])
 * ```
 */
export function useDebouncedCallbackWithControl<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): {
  debouncedFn: (...args: Parameters<T>) => void
  cancel: () => void
  flush: () => void
  isPending: () => boolean
} {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const callbackRef = useRef(callback)
  const argsRef = useRef<Parameters<T> | null>(null)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    argsRef.current = null
  }, [])

  const flush = useCallback(() => {
    if (timeoutRef.current && argsRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
      callbackRef.current(...argsRef.current)
      argsRef.current = null
    }
  }, [])

  const isPending = useCallback(() => {
    return timeoutRef.current !== null
  }, [])

  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      argsRef.current = args

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        if (argsRef.current) {
          callbackRef.current(...argsRef.current)
          argsRef.current = null
        }
      }, delay)
    },
    [delay]
  )

  return { debouncedFn, cancel, flush, isPending }
}

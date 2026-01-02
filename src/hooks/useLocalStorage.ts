'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'

/**
 * Options for useLocalStorage hook
 */
interface UseLocalStorageOptions<T> {
  /** Custom serializer */
  serializer?: (value: T) => string

  /** Custom deserializer */
  deserializer?: (value: string) => T

  /** Sync across tabs */
  syncTabs?: boolean

  /** Callback when storage changes */
  onStorageChange?: (newValue: T | null) => void
}

/**
 * Hook for persistent state in localStorage with cross-tab sync.
 *
 * @example
 * ```tsx
 * function Settings() {
 *   const [theme, setTheme] = useLocalStorage('theme', 'dark')
 *   const [settings, setSettings] = useLocalStorage('user-settings', {
 *     notifications: true,
 *     language: 'ru'
 *   })
 *
 *   return (
 *     <div>
 *       <select value={theme} onChange={(e) => setTheme(e.target.value)}>
 *         <option value="dark">Dark</option>
 *         <option value="light">Light</option>
 *       </select>
 *     </div>
 *   )
 * }
 * ```
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions<T> = {}
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const {
    serializer = JSON.stringify,
    deserializer = JSON.parse,
    syncTabs = true,
    onStorageChange,
  } = options

  // Read initial value from localStorage
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') {
      return initialValue
    }

    try {
      const item = window.localStorage.getItem(key)
      return item ? deserializer(item) : initialValue
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  }, [key, initialValue, deserializer])

  const [storedValue, setStoredValue] = useState<T>(readValue)

  // Write to localStorage
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      if (typeof window === 'undefined') {
        console.warn('useLocalStorage: localStorage is not available')
        return
      }

      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value
        setStoredValue(valueToStore)
        window.localStorage.setItem(key, serializer(valueToStore))

        // Dispatch custom event for same-tab listeners
        window.dispatchEvent(
          new CustomEvent('local-storage-change', {
            detail: { key, value: valueToStore },
          })
        )
      } catch (error) {
        console.warn(`Error writing to localStorage key "${key}":`, error)
      }
    },
    [key, serializer, storedValue]
  )

  // Remove from localStorage
  const removeValue = useCallback(() => {
    if (typeof window === 'undefined') return

    try {
      window.localStorage.removeItem(key)
      setStoredValue(initialValue)
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error)
    }
  }, [key, initialValue])

  // Handle storage events (cross-tab sync)
  useEffect(() => {
    if (!syncTabs || typeof window === 'undefined') return

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== key || event.storageArea !== localStorage) return

      try {
        const newValue = event.newValue ? deserializer(event.newValue) : initialValue
        setStoredValue(newValue)
        onStorageChange?.(newValue)
      } catch (error) {
        console.warn(`Error parsing storage event for key "${key}":`, error)
      }
    }

    // Also listen for same-tab changes
    const handleLocalChange = (event: CustomEvent<{ key: string; value: T }>) => {
      if (event.detail.key === key) {
        onStorageChange?.(event.detail.value)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('local-storage-change', handleLocalChange as EventListener)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('local-storage-change', handleLocalChange as EventListener)
    }
  }, [key, syncTabs, deserializer, initialValue, onStorageChange])

  return [storedValue, setValue, removeValue]
}

/**
 * Hook for sessionStorage (same API as useLocalStorage)
 */
export function useSessionStorage<T>(
  key: string,
  initialValue: T,
  options: Omit<UseLocalStorageOptions<T>, 'syncTabs'> = {}
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const { serializer = JSON.stringify, deserializer = JSON.parse } = options

  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') return initialValue

    try {
      const item = window.sessionStorage.getItem(key)
      return item ? deserializer(item) : initialValue
    } catch (error) {
      console.warn(`Error reading sessionStorage key "${key}":`, error)
      return initialValue
    }
  }, [key, initialValue, deserializer])

  const [storedValue, setStoredValue] = useState<T>(readValue)

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      if (typeof window === 'undefined') return

      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value
        setStoredValue(valueToStore)
        window.sessionStorage.setItem(key, serializer(valueToStore))
      } catch (error) {
        console.warn(`Error writing to sessionStorage key "${key}":`, error)
      }
    },
    [key, serializer, storedValue]
  )

  const removeValue = useCallback(() => {
    if (typeof window === 'undefined') return

    try {
      window.sessionStorage.removeItem(key)
      setStoredValue(initialValue)
    } catch (error) {
      console.warn(`Error removing sessionStorage key "${key}":`, error)
    }
  }, [key, initialValue])

  return [storedValue, setValue, removeValue]
}

/**
 * Hook for reading localStorage without state (static read)
 */
export function useLocalStorageValue<T>(key: string, defaultValue: T): T {
  return useMemo(() => {
    if (typeof window === 'undefined') return defaultValue

    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch {
      return defaultValue
    }
  }, [key, defaultValue])
}

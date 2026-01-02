'use client'

import { useState, useCallback, useRef, createContext, useContext, ReactNode } from 'react'

/**
 * Toast types
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading'

/**
 * Toast message
 */
export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

export interface ToastOptions {
  id?: string
  message?: string
  duration?: number
}

/**
 * Toast context value
 */
interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'> & { id?: string }) => string
  removeToast: (id: string) => void
  clearToasts: () => void

  // Shorthand methods
  success: (title: string, messageOrOptions?: string | ToastOptions, options?: ToastOptions) => string
  error: (title: string, messageOrOptions?: string | ToastOptions, options?: ToastOptions) => string
  warning: (title: string, messageOrOptions?: string | ToastOptions, options?: ToastOptions) => string
  info: (title: string, messageOrOptions?: string | ToastOptions, options?: ToastOptions) => string
  message: (title: string, messageOrOptions?: string | ToastOptions, options?: ToastOptions) => string
  loading: (title: string, options?: ToastOptions) => string
}

const ToastContext = createContext<ToastContextValue | null>(null)

/**
 * Generate unique ID
 */
function generateId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Default durations by type
 */
const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000,
  loading: 0,
}

/**
 * Hook to access toast functions
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const toast = useToast()
 *
 *   const handleSave = async () => {
 *     try {
 *       await saveData()
 *       toast.success('Сохранено', 'Данные успешно сохранены')
 *     } catch (error) {
 *       toast.error('Ошибка', error.message)
 *     }
 *   }
 * }
 * ```
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

/**
 * Hook for managing toasts (used internally by ToastProvider)
 */
export function useToastState(): ToastContextValue {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timeoutIds = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const removeToast = useCallback((id: string) => {
    const existingTimeout = timeoutIds.current.get(id)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
      timeoutIds.current.delete(id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'> & { id?: string }): string => {
      const id = toast.id ?? generateId()
      const duration = toast.duration ?? DEFAULT_DURATIONS[toast.type]

      const newToast: Toast = {
        ...toast,
        id,
        duration,
      }

      setToasts((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === id)
        if (existingIndex === -1) {
          return [...prev, newToast]
        }

        const next = [...prev]
        next[existingIndex] = newToast
        return next
      })

      // Auto remove after duration
      if (duration > 0) {
        const existingTimeout = timeoutIds.current.get(id)
        if (existingTimeout) {
          clearTimeout(existingTimeout)
        }
        const timeoutId = setTimeout(() => {
          removeToast(id)
        }, duration)
        timeoutIds.current.set(id, timeoutId)
      }

      return id
    },
    [removeToast]
  )

  const clearToasts = useCallback(() => {
    setToasts([])
  }, [])

  const resolveOptions = (
    messageOrOptions?: string | ToastOptions,
    options?: ToastOptions
  ): { message?: string; options?: ToastOptions } => {
    if (typeof messageOrOptions === 'string') {
      return { message: messageOrOptions, options }
    }
    return { message: messageOrOptions?.message, options: messageOrOptions }
  }

  const success = useCallback(
    (title: string, messageOrOptions?: string | ToastOptions, options?: ToastOptions) => {
      const resolved = resolveOptions(messageOrOptions, options)
      return addToast({
        type: 'success',
        title,
        message: resolved.message,
        duration: resolved.options?.duration,
        id: resolved.options?.id,
      })
    },
    [addToast]
  )

  const error = useCallback(
    (title: string, messageOrOptions?: string | ToastOptions, options?: ToastOptions) => {
      const resolved = resolveOptions(messageOrOptions, options)
      return addToast({
        type: 'error',
        title,
        message: resolved.message,
        duration: resolved.options?.duration,
        id: resolved.options?.id,
      })
    },
    [addToast]
  )

  const warning = useCallback(
    (title: string, messageOrOptions?: string | ToastOptions, options?: ToastOptions) => {
      const resolved = resolveOptions(messageOrOptions, options)
      return addToast({
        type: 'warning',
        title,
        message: resolved.message,
        duration: resolved.options?.duration,
        id: resolved.options?.id,
      })
    },
    [addToast]
  )

  const info = useCallback(
    (title: string, messageOrOptions?: string | ToastOptions, options?: ToastOptions) => {
      const resolved = resolveOptions(messageOrOptions, options)
      return addToast({
        type: 'info',
        title,
        message: resolved.message,
        duration: resolved.options?.duration,
        id: resolved.options?.id,
      })
    },
    [addToast]
  )

  const message = useCallback(
    (title: string, messageOrOptions?: string | ToastOptions, options?: ToastOptions) => {
      return info(title, messageOrOptions, options)
    },
    [info]
  )

  const loading = useCallback(
    (title: string, options?: ToastOptions) => {
      return addToast({
        type: 'loading',
        title,
        message: options?.message,
        duration: options?.duration ?? 0,
        id: options?.id,
      })
    },
    [addToast]
  )

  return {
    toasts,
    addToast,
    removeToast,
    clearToasts,
    success,
    error,
    warning,
    info,
    message,
    loading,
  }
}

/**
 * Toast Provider component
 */
export function ToastProvider({
  children,
  value,
}: {
  children: ReactNode
  value: ToastContextValue
}) {
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

/**
 * Toast container component (renders toasts)
 *
 * @example
 * ```tsx
 * // In your layout or app component
 * function App() {
 *   const toastState = useToastState()
 *
 *   return (
 *     <ToastProvider value={toastState}>
 *       <YourApp />
 *       <ToastContainer />
 *     </ToastProvider>
 *   )
 * }
 * ```
 */
export { ToastContext }

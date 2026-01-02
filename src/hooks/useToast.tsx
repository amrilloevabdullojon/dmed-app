'use client'

import { useState, useCallback, createContext, useContext, ReactNode } from 'react'

/**
 * Toast types
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info'

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

/**
 * Toast context value
 */
interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  clearToasts: () => void

  // Shorthand methods
  success: (title: string, message?: string) => string
  error: (title: string, message?: string) => string
  warning: (title: string, message?: string) => string
  info: (title: string, message?: string) => string
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

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>): string => {
      const id = generateId()
      const duration = toast.duration ?? DEFAULT_DURATIONS[toast.type]

      const newToast: Toast = {
        ...toast,
        id,
        duration,
      }

      setToasts((prev) => [...prev, newToast])

      // Auto remove after duration
      if (duration > 0) {
        setTimeout(() => {
          removeToast(id)
        }, duration)
      }

      return id
    },
    [removeToast]
  )

  const clearToasts = useCallback(() => {
    setToasts([])
  }, [])

  const success = useCallback(
    (title: string, message?: string) => addToast({ type: 'success', title, message }),
    [addToast]
  )

  const error = useCallback(
    (title: string, message?: string) => addToast({ type: 'error', title, message }),
    [addToast]
  )

  const warning = useCallback(
    (title: string, message?: string) => addToast({ type: 'warning', title, message }),
    [addToast]
  )

  const info = useCallback(
    (title: string, message?: string) => addToast({ type: 'info', title, message }),
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

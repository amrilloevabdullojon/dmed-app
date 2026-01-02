'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { Toast, ToastType, useToast, useToastState, ToastProvider } from '@/hooks/useToast'

/**
 * Toast icons by type
 */
const ToastIcons: Record<ToastType, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

/**
 * Toast styles by type
 */
const ToastStyles: Record<ToastType, string> = {
  success: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200',
  error: 'bg-red-500/20 border-red-500/50 text-red-200',
  warning: 'bg-amber-500/20 border-amber-500/50 text-amber-200',
  info: 'bg-blue-500/20 border-blue-500/50 text-blue-200',
}

const IconStyles: Record<ToastType, string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-blue-400',
}

/**
 * Single toast item component
 */
function ToastItem({ toast, onClose }: { toast: Toast; onClose: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false)
  const Icon = ToastIcons[toast.type]

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => onClose(toast.id), 200)
  }

  // Auto close before duration ends to allow animation
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true)
      }, toast.duration - 200)

      return () => clearTimeout(timer)
    }
  }, [toast.duration])

  return (
    <div
      className={`
        relative flex items-start gap-3 rounded-lg border p-4 shadow-lg backdrop-blur-md
        transition-all duration-200 ease-out
        ${ToastStyles[toast.type]}
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
      role="alert"
    >
      <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${IconStyles[toast.type]}`} />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.message && <p className="mt-1 text-sm opacity-80">{toast.message}</p>}
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="mt-2 text-sm font-medium underline hover:no-underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        onClick={handleClose}
        className="flex-shrink-0 rounded p-1 transition-colors hover:bg-white/10"
        aria-label="Закрыть уведомление"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/**
 * Toast container component
 *
 * @example
 * ```tsx
 * // In your layout or root component
 * function RootLayout({ children }) {
 *   return (
 *     <>
 *       {children}
 *       <ToastContainer />
 *     </>
 *   )
 * }
 * ```
 */
export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
      aria-live="polite"
      aria-label="Уведомления"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>
  )
}

/**
 * Toast provider wrapper with container
 *
 * @example
 * ```tsx
 * // Wrap your app
 * function App() {
 *   return (
 *     <ToastWrapper>
 *       <YourApp />
 *     </ToastWrapper>
 *   )
 * }
 *
 * // Use anywhere
 * function MyComponent() {
 *   const toast = useToast()
 *
 *   return (
 *     <button onClick={() => toast.success('Done!')}>
 *       Save
 *     </button>
 *   )
 * }
 * ```
 */
export function ToastWrapper({ children }: { children: React.ReactNode }) {
  const toastState = useToastState()

  return (
    <ToastProvider value={toastState}>
      {children}
      <ToastContainer />
    </ToastProvider>
  )
}

export { useToast, useToastState, ToastProvider }

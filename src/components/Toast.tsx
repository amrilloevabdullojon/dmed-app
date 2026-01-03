'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react'
import { Toast, ToastType, useToast, useToastState, ToastProvider } from '@/hooks/useToast'

/**
 * Toast icons by type
 */
const ToastIcons: Record<ToastType, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
}

/**
 * Toast styles by type
 */
const ToastStyles: Record<ToastType, string> = {
  success: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200',
  error: 'bg-red-500/20 border-red-500/50 text-red-200',
  warning: 'bg-amber-500/20 border-amber-500/50 text-amber-200',
  info: 'bg-blue-500/20 border-blue-500/50 text-blue-200',
  loading: 'bg-slate-500/20 border-slate-500/50 text-slate-200',
}

const IconStyles: Record<ToastType, string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-blue-400',
  loading: 'text-slate-300',
}

const ProgressBarColors: Record<ToastType, string> = {
  success: 'bg-emerald-400',
  error: 'bg-red-400',
  warning: 'bg-amber-400',
  info: 'bg-blue-400',
  loading: 'bg-slate-400',
}

/**
 * Single toast item component
 */
function ToastItem({ toast, onClose }: { toast: Toast; onClose: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false)
  const [progress, setProgress] = useState(100)
  const Icon = ToastIcons[toast.type]

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => onClose(toast.id), 200)
  }

  // Progress bar animation
  useEffect(() => {
    if (toast.duration && toast.duration > 0 && toast.type !== 'loading') {
      const startTime = Date.now()
      const duration = toast.duration

      const updateProgress = () => {
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
        setProgress(remaining)

        if (remaining > 0) {
          requestAnimationFrame(updateProgress)
        }
      }

      const animationFrame = requestAnimationFrame(updateProgress)
      return () => cancelAnimationFrame(animationFrame)
    }
  }, [toast.duration, toast.type])

  // Auto close before duration ends to allow animation
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true)
      }, toast.duration - 200)

      return () => clearTimeout(timer)
    }
  }, [toast.duration])

  const iconClassName = toast.type === 'loading'
    ? `mt-0.5 h-5 w-5 flex-shrink-0 ${IconStyles[toast.type]} animate-spin`
    : `mt-0.5 h-5 w-5 flex-shrink-0 ${IconStyles[toast.type]}`

  return (
    <div
      className={`
        relative flex items-start gap-3 rounded-lg border p-4 shadow-lg backdrop-blur-md overflow-hidden
        transition-all duration-200 ease-out
        ${ToastStyles[toast.type]}
        ${isExiting ? 'translate-y-[-10px] opacity-0 scale-95' : 'translate-y-0 opacity-100 scale-100'}
      `}
      role="alert"
    >
      <Icon className={iconClassName} />

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

      {/* Progress bar */}
      {toast.duration && toast.duration > 0 && toast.type !== 'loading' && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
          <div
            className={`h-full transition-none ${ProgressBarColors[toast.type]}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || toasts.length === 0) return null

  return createPortal(
    <div
      className="!fixed left-1/2 !z-[200] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      aria-live="polite"
      aria-label="Toast notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>,
    document.body
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

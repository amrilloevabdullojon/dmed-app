'use client'

import { useEffect, useState, useRef, ReactNode } from 'react'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import { hapticLight, hapticMedium } from '@/lib/haptic'
import { useUserPreferences } from '@/hooks/useUserPreferences'

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'promise'
export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export interface ToastAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger'
}

export interface EnhancedToastProps {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
  dismissible?: boolean
  actions?: ToastAction[]
  progress?: boolean
  link?: {
    href: string
    label: string
  }
  onDismiss?: () => void
}

interface ToastState extends EnhancedToastProps {
  isExiting: boolean
}

const toastIcons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
  promise: Loader2,
}

const toastColors = {
  success: {
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
    icon: 'text-emerald-400',
    progress: 'bg-emerald-500',
  },
  error: {
    bg: 'bg-red-500/15',
    border: 'border-red-500/30',
    icon: 'text-red-400',
    progress: 'bg-red-500',
  },
  warning: {
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    icon: 'text-amber-400',
    progress: 'bg-amber-500',
  },
  info: {
    bg: 'bg-sky-500/15',
    border: 'border-sky-500/30',
    icon: 'text-sky-400',
    progress: 'bg-sky-500',
  },
  loading: {
    bg: 'bg-gray-700/30',
    border: 'border-gray-600/30',
    icon: 'text-gray-300',
    progress: 'bg-gray-500',
  },
  promise: {
    bg: 'bg-teal-500/15',
    border: 'border-teal-500/30',
    icon: 'text-teal-400',
    progress: 'bg-teal-500',
  },
}

export function Toast({
  id,
  type,
  title,
  description,
  duration = 5000,
  dismissible = true,
  actions = [],
  progress = false,
  link,
  onDismiss,
}: ToastState) {
  const { preferences } = useUserPreferences()
  const animationsEnabled = preferences?.animations ?? true
  const [progressValue, setProgressValue] = useState(100)
  const [isHovered, setIsHovered] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const Icon = toastIcons[type]
  const colors = toastColors[type]

  useEffect(() => {
    if (type === 'loading' || !duration || duration <= 0) return

    const startTime = Date.now()

    if (progress) {
      intervalRef.current = setInterval(() => {
        if (isHovered) return
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
        setProgressValue(remaining)
      }, 50)
    }

    timeoutRef.current = setTimeout(() => {
      if (!isHovered) {
        onDismiss?.()
      }
    }, duration)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [duration, type, onDismiss, isHovered, progress])

  const handleDismiss = () => {
    hapticLight()
    onDismiss?.()
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative flex w-full max-w-md flex-col gap-2 rounded-xl border ${colors.border} ${colors.bg} p-4 shadow-lg backdrop-blur-md transition-all ${
        animationsEnabled ? 'animate-slideInRight' : ''
      }`}
    >
      {/* Progress bar */}
      {progress && duration > 0 && type !== 'loading' && (
        <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-xl bg-gray-800/50">
          <div
            className={`h-full ${colors.progress} transition-all duration-100 ease-linear`}
            style={{ width: `${progressValue}%` }}
          />
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          <Icon
            className={`h-5 w-5 ${colors.icon} ${type === 'loading' ? 'animate-spin' : ''}`}
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-white">{title}</h4>
          {description && (
            <p className="mt-1 text-xs text-gray-300 opacity-90">{description}</p>
          )}

          {/* Actions */}
          {actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    hapticMedium()
                    action.onClick()
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    action.variant === 'danger'
                      ? 'bg-red-500/20 text-red-200 hover:bg-red-500/30'
                      : action.variant === 'primary'
                        ? 'bg-teal-500/20 text-teal-200 hover:bg-teal-500/30'
                        : 'bg-gray-700/50 text-gray-200 hover:bg-gray-700/70'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Link */}
          {link && (
            <a
              href={link.href}
              onClick={hapticLight}
              className="mt-2 flex items-center gap-1 text-xs text-teal-400 transition hover:text-teal-300"
            >
              {link.label}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* Dismiss button */}
        {dismissible && type !== 'loading' && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 rounded-md p-1 text-gray-400 opacity-0 transition hover:bg-gray-700/50 hover:text-white group-hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// Global toast manager
class ToastManager {
  private toasts: Map<string, ToastState> = new Map()
  private listeners: Set<(toasts: ToastState[]) => void> = new Set()
  private idCounter = 0

  subscribe(listener: (toasts: ToastState[]) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    const toasts = Array.from(this.toasts.values())
    this.listeners.forEach((listener) => listener(toasts))
  }

  private generateId() {
    return `toast-${Date.now()}-${this.idCounter++}`
  }

  show(props: Omit<EnhancedToastProps, 'id'>) {
    const id = this.generateId()
    const toast: ToastState = {
      ...props,
      id,
      isExiting: false,
      onDismiss: () => this.dismiss(id),
    }
    this.toasts.set(id, toast)
    this.notify()
    return id
  }

  dismiss(id: string) {
    const toast = this.toasts.get(id)
    if (toast) {
      toast.isExiting = true
      this.notify()
      setTimeout(() => {
        this.toasts.delete(id)
        this.notify()
      }, 300)
    }
  }

  dismissAll() {
    this.toasts.forEach((toast) => {
      toast.isExiting = true
    })
    this.notify()
    setTimeout(() => {
      this.toasts.clear()
      this.notify()
    }, 300)
  }

  update(id: string, props: Partial<Omit<EnhancedToastProps, 'id'>>) {
    const toast = this.toasts.get(id)
    if (toast) {
      Object.assign(toast, props)
      this.notify()
    }
  }

  success(title: string, description?: string, options?: Partial<EnhancedToastProps>) {
    return this.show({ type: 'success', title, description, ...options })
  }

  error(title: string, description?: string, options?: Partial<EnhancedToastProps>) {
    return this.show({
      type: 'error',
      title,
      description,
      duration: 7000,
      ...options,
    })
  }

  warning(title: string, description?: string, options?: Partial<EnhancedToastProps>) {
    return this.show({
      type: 'warning',
      title,
      description,
      duration: 6000,
      ...options,
    })
  }

  info(title: string, description?: string, options?: Partial<EnhancedToastProps>) {
    return this.show({ type: 'info', title, description, ...options })
  }

  loading(title: string, description?: string) {
    return this.show({
      type: 'loading',
      title,
      description,
      duration: 0,
      dismissible: false,
    })
  }

  promise<T>(
    promise: Promise<T>,
    {
      loading,
      success,
      error,
    }: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((err: any) => string)
    }
  ) {
    const id = this.loading(loading)

    promise
      .then((data) => {
        const message = typeof success === 'function' ? success(data) : success
        this.update(id, {
          type: 'success',
          title: message,
          duration: 5000,
          dismissible: true,
        })
      })
      .catch((err) => {
        const message = typeof error === 'function' ? error(err) : error
        this.update(id, {
          type: 'error',
          title: message,
          duration: 7000,
          dismissible: true,
        })
      })

    return id
  }
}

export const enhancedToast = new ToastManager()

// Provider component
export function EnhancedToastProvider({
  children,
  position = 'bottom-right',
  maxToasts = 5,
}: {
  children: ReactNode
  position?: ToastPosition
  maxToasts?: number
}) {
  const [toasts, setToasts] = useState<ToastState[]>([])

  useEffect(() => {
    const unsubscribe = enhancedToast.subscribe(setToasts)
    return () => {
      unsubscribe()
    }
  }, [])

  const positionClasses = {
    'top-left': 'top-4 left-4 items-start',
    'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
    'top-right': 'top-4 right-4 items-end',
    'bottom-left': 'bottom-4 left-4 items-start',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
    'bottom-right': 'bottom-4 right-4 items-end',
  }

  const visibleToasts = toasts.slice(-maxToasts)

  return (
    <>
      {children}
      <div
        className={`pointer-events-none fixed z-[9999] flex flex-col gap-3 ${positionClasses[position]}`}
      >
        {visibleToasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto ${toast.isExiting ? 'animate-slideOutRight' : ''}`}
          >
            <Toast {...toast} />
          </div>
        ))}
      </div>
    </>
  )
}

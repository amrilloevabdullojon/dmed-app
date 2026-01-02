'use client'

import { useEffect, useRef, useCallback } from 'react'
import { X, AlertTriangle, Trash2, CheckCircle, Info } from 'lucide-react'
import { createFocusTrap } from '@/lib/a11y'

export type DialogVariant = 'danger' | 'warning' | 'success' | 'info'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: DialogVariant
  loading?: boolean
}

const variantStyles: Record<
  DialogVariant,
  { icon: typeof AlertTriangle; color: string; bg: string }
> = {
  danger: {
    icon: Trash2,
    color: 'text-red-400',
    bg: 'bg-red-500/20',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/20',
  },
  success: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
  },
  info: {
    icon: Info,
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
  },
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const { icon: Icon, color, bg } = variantStyles[variant]

  // Focus trap
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return
    const cleanup = createFocusTrap(dialogRef.current)
    return cleanup
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleConfirm = useCallback(() => {
    if (!loading) onConfirm()
  }, [loading, onConfirm])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-message"
        className="relative z-10 w-full max-w-md rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-2xl"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 text-gray-400 transition hover:text-white"
          aria-label="Закрыть"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon */}
        <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${bg}`}>
          <Icon className={`h-6 w-6 ${color}`} />
        </div>

        {/* Content */}
        <h2 id="dialog-title" className="mb-2 text-lg font-semibold text-white">
          {title}
        </h2>
        <p id="dialog-message" className="mb-6 text-sm text-gray-400">
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg bg-gray-700 px-4 py-2.5 font-medium text-white transition hover:bg-gray-600 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 rounded-lg px-4 py-2.5 font-medium text-white transition disabled:opacity-50 ${
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : variant === 'warning'
                  ? 'bg-yellow-600 hover:bg-yellow-700'
                  : variant === 'success'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Загрузка...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

// Hook for easy usage
import { useState } from 'react'

interface UseConfirmDialogOptions {
  onConfirm: () => void | Promise<void>
  title: string
  message: string
  confirmText?: string
  variant?: DialogVariant
}

export function useConfirmDialog() {
  const [state, setState] = useState<{
    isOpen: boolean
    options: UseConfirmDialogOptions | null
    loading: boolean
  }>({
    isOpen: false,
    options: null,
    loading: false,
  })

  const confirm = useCallback((options: UseConfirmDialogOptions) => {
    setState({ isOpen: true, options, loading: false })
  }, [])

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }))
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!state.options) return
    setState((prev) => ({ ...prev, loading: true }))
    try {
      await state.options.onConfirm()
      close()
    } catch (error) {
      console.error('Confirm action failed:', error)
    } finally {
      setState((prev) => ({ ...prev, loading: false }))
    }
  }, [state.options, close])

  const Dialog = state.options ? (
    <ConfirmDialog
      isOpen={state.isOpen}
      onClose={close}
      onConfirm={handleConfirm}
      title={state.options.title}
      message={state.options.message}
      confirmText={state.options.confirmText}
      variant={state.options.variant}
      loading={state.loading}
    />
  ) : null

  return { confirm, Dialog }
}

'use client'

import { useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface MobileDrawerProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  position?: 'bottom' | 'left' | 'right'
}

export function MobileDrawer({
  isOpen,
  onClose,
  title,
  children,
  position = 'bottom',
}: MobileDrawerProps) {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isOpen])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const positionClasses = {
    bottom: 'bottom-0 left-0 right-0 rounded-t-3xl max-h-[85vh]',
    left: 'left-0 top-0 bottom-0 rounded-r-3xl w-[85vw] max-w-sm',
    right: 'right-0 top-0 bottom-0 rounded-l-3xl w-[85vw] max-w-sm',
  }

  const slideInClasses = {
    bottom: 'translate-y-full',
    left: '-translate-x-full',
    right: 'translate-x-full',
  }

  const drawerContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`fixed z-50 flex flex-col overflow-hidden bg-gradient-to-b from-gray-900 to-gray-950 shadow-2xl transition-transform duration-300 ${positionClasses[position]} ${
          isOpen ? 'translate-x-0 translate-y-0' : slideInClasses[position]
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Handle for bottom drawer */}
        {position === 'bottom' && (
          <div className="flex justify-center py-3">
            <div className="h-1.5 w-12 rounded-full bg-white/20" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <h2 id="drawer-title" className="text-lg font-semibold text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="tap-highlight touch-target rounded-lg bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mobile-scroll flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </>
  )

  return typeof window !== 'undefined' ? createPortal(drawerContent, document.body) : null
}

// Compact variant for filters
interface MobileFilterDrawerProps {
  isOpen: boolean
  onClose: () => void
  onApply: () => void
  onReset: () => void
  children: ReactNode
  appliedCount?: number
}

export function MobileFilterDrawer({
  isOpen,
  onClose,
  onApply,
  onReset,
  children,
  appliedCount = 0,
}: MobileFilterDrawerProps) {
  return (
    <MobileDrawer isOpen={isOpen} onClose={onClose} title="Фильтры" position="bottom">
      <div className="space-y-4">
        {children}

        {/* Action Buttons */}
        <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-white/10 bg-gray-900/95 px-4 py-4 backdrop-blur-sm">
          <button
            onClick={onReset}
            className="tap-highlight touch-target-lg flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Сбросить
          </button>
          <button
            onClick={() => {
              onApply()
              onClose()
            }}
            className="tap-highlight touch-target-lg flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-600"
          >
            Применить {appliedCount > 0 && `(${appliedCount})`}
          </button>
        </div>
      </div>
    </MobileDrawer>
  )
}

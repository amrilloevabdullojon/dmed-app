'use client'

import { useState } from 'react'
import { Zap } from 'lucide-react'
import { hapticLight, hapticMedium } from '@/lib/haptic'

interface QuickAction {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
}

interface QuickActionsMenuProps {
  actions: QuickAction[]
}

export function QuickActionsMenu({ actions }: QuickActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  const toggle = () => {
    hapticMedium()
    setIsOpen(!isOpen)
  }

  return (
    <div
      className="fixed z-50 md:hidden"
      style={{
        bottom: `calc(env(safe-area-inset-bottom) + 5rem)`,
        right: `calc(env(safe-area-inset-right) + 1rem)`,
      }}
    >
      {/* Action buttons */}
      {isOpen && (
        <div className="mb-3 flex flex-col gap-2">
          {actions.map((action, i) => {
            const Icon = action.icon
            return (
              <button
                key={i}
                onClick={() => {
                  hapticLight()
                  action.onClick()
                  setIsOpen(false)
                }}
                className="flex items-center gap-2 rounded-full bg-gray-800 px-4 py-2.5 text-sm text-white shadow-lg transition-all animate-fadeIn hover:bg-gray-700"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <Icon className="h-4 w-4" />
                {action.label}
              </button>
            )
          })}
        </div>
      )}

      {/* FAB trigger */}
      <button
        onClick={toggle}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-xl transition-transform active:scale-95"
        aria-label="Быстрые действия"
      >
        <Zap className={`h-6 w-6 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
    </div>
  )
}

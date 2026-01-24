'use client'

import { memo, useCallback } from 'react'
import type { MouseEvent } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { hapticLight } from '@/lib/haptic'
import { QUICK_CREATE_ITEMS } from './header-constants'
import { scheduleFallbackNavigation } from './header-utils'

interface HeaderQuickCreateProps {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  size?: 'sm' | 'md'
}

export const HeaderQuickCreate = memo(function HeaderQuickCreate({
  isOpen,
  onToggle,
  onClose,
  size = 'md',
}: HeaderQuickCreateProps) {
  const handleLinkClick = useCallback(
    (event: MouseEvent<HTMLElement>, href?: string) => {
      hapticLight()
      onClose()
      scheduleFallbackNavigation(event, href)
    },
    [onClose]
  )

  const buttonSize = size === 'sm' ? 'h-9 w-9' : 'h-10 w-10'
  const iconSize = size === 'sm' ? 'h-5 w-5' : 'h-5 w-5'

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`group flex items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/25 transition-all hover:shadow-teal-500/40 hover:brightness-110 active:scale-95 ${buttonSize}`}
        title="Создать"
        aria-label="Создать"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Plus
          className={`transition-transform duration-200 ${iconSize} ${isOpen ? 'rotate-45' : 'group-hover:rotate-90'}`}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={onClose} />
          <div className="absolute right-0 top-full z-[70] mt-2 min-w-52 origin-top-right animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
            <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 p-1.5 shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="mb-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Быстрое создание
              </div>
              {QUICK_CREATE_ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(event) => handleLinkClick(event, item.href)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-200 transition-all hover:bg-white/10 hover:text-white"
                  >
                    <div className={`rounded-lg bg-white/5 p-2 ${item.iconClassName}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
})

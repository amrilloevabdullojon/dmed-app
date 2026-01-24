'use client'

import { memo, useCallback } from 'react'
import type { MouseEvent } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings, ChevronDown, RefreshCw } from 'lucide-react'
import { hapticLight, hapticMedium } from '@/lib/haptic'
import { scheduleFallbackNavigation } from './header-utils'
import { NAV_ITEMS, isActivePath } from './header-constants'
import type { SyncDirection } from './header-types'

interface HeaderNavProps {
  isAdmin: boolean
  syncing: boolean
  syncMenuOpen: boolean
  onToggleSyncMenu: () => void
  onCloseMenus: () => void
  onSync: (direction: SyncDirection) => void
}

export const HeaderNav = memo(function HeaderNav({
  isAdmin,
  syncing,
  syncMenuOpen,
  onToggleSyncMenu,
  onCloseMenus,
  onSync,
}: HeaderNavProps) {
  const pathname = usePathname()

  const handleNavClick = useCallback(
    (event: MouseEvent<HTMLElement>, href?: string) => {
      hapticLight()
      onCloseMenus()
      scheduleFallbackNavigation(event, href)
    },
    [onCloseMenus]
  )

  return (
    <nav className="hidden items-center gap-0.5 md:flex" aria-label="Основная навигация">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = isActivePath(pathname, item.matchPath)

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={(event) => handleNavClick(event, item.href)}
            aria-current={isActive ? 'page' : undefined}
            className={`group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              isActive
                ? 'bg-white/10 text-white'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon
              className={`h-4 w-4 transition-transform group-hover:scale-110 ${
                isActive ? 'text-teal-400' : ''
              }`}
            />
            <span>{item.label}</span>
            {isActive && (
              <span className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-gradient-to-r from-teal-400 to-emerald-400" />
            )}
          </Link>
        )
      })}

      {/* Admin Menu */}
      {isAdmin && (
        <div className="relative ml-1">
          <button
            onClick={onToggleSyncMenu}
            disabled={syncing}
            aria-haspopup="menu"
            aria-expanded={syncMenuOpen}
            className={`group flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              syncMenuOpen
                ? 'bg-white/10 text-white'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            } ${syncing ? 'opacity-50' : ''}`}
          >
            <Settings
              className={`h-4 w-4 ${syncing ? 'animate-spin' : 'transition-transform group-hover:rotate-45'}`}
            />
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${syncMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {syncMenuOpen && (
            <>
              <div className="fixed inset-0 z-[60]" onClick={onCloseMenus} />
              <div className="absolute right-0 top-full z-[70] mt-2 min-w-52 origin-top-right animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
                <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 shadow-xl shadow-black/20 backdrop-blur-xl">
                  <Link
                    href="/settings"
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-200 transition-colors hover:bg-white/5 hover:text-white"
                    onClick={(event) => handleNavClick(event, '/settings')}
                  >
                    <Settings className="h-4 w-4 text-slate-400" />
                    <span>Настройки</span>
                  </Link>

                  <div className="mx-3 border-t border-white/10" />

                  <button
                    onClick={() => {
                      hapticMedium()
                      onSync('from_sheets')
                    }}
                    disabled={syncing}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-slate-200 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4 text-blue-400" />
                    <span>Импорт из Sheets</span>
                  </button>

                  <button
                    onClick={() => {
                      hapticMedium()
                      onSync('to_sheets')
                    }}
                    disabled={syncing}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-slate-200 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4 text-emerald-400" />
                    <span>Экспорт в Sheets</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </nav>
  )
})

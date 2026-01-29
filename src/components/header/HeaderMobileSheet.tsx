'use client'

import { memo, useCallback } from 'react'
import type { MouseEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { X, Menu, User, LogOut, Settings, RefreshCw, FileText, Inbox, TrendingUp } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { hapticLight, hapticMedium } from '@/lib/haptic'
import { NAV_ITEMS, QUICK_CREATE_ITEMS, isActivePath, getRoleLabel } from './header-constants'
import type { RecentItem, SyncDirection } from './header-types'
import { scheduleFallbackNavigation } from './header-utils'

interface HeaderMobileSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onClose: () => void
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
    role?: string
  } | null
  isAdmin: boolean
  syncing: boolean
  recentItems: RecentItem[]
  onSync: (direction: SyncDirection) => void
}

export const HeaderMobileSheet = memo(function HeaderMobileSheet({
  isOpen,
  onOpenChange,
  onClose,
  user,
  isAdmin,
  syncing,
  recentItems,
  onSync,
}: HeaderMobileSheetProps) {
  const pathname = usePathname()

  const handleNavClick = useCallback(
    (event: MouseEvent<HTMLElement>, href?: string) => {
      hapticLight()
      onClose()
      scheduleFallbackNavigation(event, href)
    },
    [onClose]
  )

  const handleSignOut = useCallback(() => {
    hapticMedium()
    onClose()
    signOut({ callbackUrl: '/login' })
  }, [onClose])

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button
          onClick={() => hapticLight()}
          aria-label={isOpen ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={isOpen}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-white/10 hover:text-white md:hidden"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className="bg-slate-900/98 max-h-[85vh] border-t border-white/10 p-0 backdrop-blur-xl md:hidden [&>button]:hidden"
      >
        <div className="flex max-h-[85vh] flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Навигация
            </span>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-white/10 hover:text-white"
              aria-label="Закрыть меню"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div
            className="flex-1 overflow-y-auto p-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
          >
            {/* User Info */}
            {user && (
              <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name || user.email || 'User'}
                    width={44}
                    height={44}
                    className="h-11 w-11 rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-800">
                    <User className="h-6 w-6 text-slate-300" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">
                    {user.name || user.email?.split('@')[0]}
                  </p>
                  <p className="text-xs text-slate-500">{getRoleLabel(user.role)}</p>
                </div>
                <Link
                  href="/profile"
                  onClick={(event) => handleNavClick(event, '/profile')}
                  className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-teal-300 transition-all hover:bg-teal-500/20"
                >
                  Профиль
                </Link>
              </div>
            )}

            {/* Quick Create */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              {QUICK_CREATE_ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(event) => handleNavClick(event, item.href)}
                    className="flex flex-col items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 transition-all hover:bg-white/10"
                  >
                    <div className={`rounded-lg bg-white/10 p-2 ${item.iconClassName}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium text-slate-200">{item.label}</span>
                  </Link>
                )
              })}
            </div>

            {/* Recent Items */}
            {recentItems.length > 0 && (
              <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Недавнее
                </div>
                <div className="space-y-1">
                  {recentItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={(event) => handleNavClick(event, item.href)}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 transition-all hover:bg-white/10"
                    >
                      <div
                        className={`rounded-lg p-1.5 ${
                          item.kind === 'letter' ? 'bg-blue-500/10' : 'bg-emerald-500/10'
                        }`}
                      >
                        {item.kind === 'letter' ? (
                          <FileText className="h-4 w-4 text-blue-400" />
                        ) : (
                          <Inbox className="h-4 w-4 text-emerald-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-200">{item.label}</span>
                        {item.subtitle && (
                          <span className="block truncate text-xs text-slate-500">
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const isActive = isActivePath(pathname, item.matchPath)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(event) => handleNavClick(event, item.href)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition-all ${
                      isActive
                        ? 'border border-teal-400/20 bg-teal-500/10 text-teal-300'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? 'text-teal-400' : ''}`} />
                    {item.label}
                  </Link>
                )
              })}
            </div>

            {/* Admin Section */}
            {isAdmin && (
              <>
                <div className="my-4 border-t border-white/10" />
                <div className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Администрирование
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      hapticMedium()
                      onClose()
                      onSync('from_sheets')
                    }}
                    disabled={syncing}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-slate-300 transition-all hover:bg-white/5 hover:text-white disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-5 w-5 text-blue-400 ${syncing ? 'animate-spin' : ''}`}
                    />
                    Импорт из Sheets
                  </button>
                  <button
                    onClick={() => {
                      hapticMedium()
                      onClose()
                      onSync('to_sheets')
                    }}
                    disabled={syncing}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-slate-300 transition-all hover:bg-white/5 hover:text-white disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-5 w-5 text-emerald-400 ${syncing ? 'animate-spin' : ''}`}
                    />
                    Экспорт в Sheets
                  </button>
                  <Link
                    href="/settings"
                    onClick={(event) => handleNavClick(event, '/settings')}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition-all ${
                      isActivePath(pathname, '/settings')
                        ? 'border border-teal-400/20 bg-teal-500/10 text-teal-300'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Settings className="h-5 w-5" />
                    Настройки
                  </Link>
                </div>
              </>
            )}

            {/* Personal Section */}
            <div className="my-4 border-t border-white/10" />
            <div className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Личное
            </div>
            <div className="space-y-1">
              <Link
                href="/my-progress"
                onClick={(event) => handleNavClick(event, '/my-progress')}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition-all ${
                  isActivePath(pathname, '/my-progress')
                    ? 'border border-teal-400/20 bg-teal-500/10 text-teal-300'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                Мой прогресс
              </Link>
            </div>

            {/* Footer Actions */}
            <div className="mt-4 space-y-1 border-t border-white/10 pt-4">
              <button
                onClick={onClose}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-slate-400 transition-all hover:bg-white/5 hover:text-white"
              >
                <X className="h-5 w-5" />
                Закрыть меню
              </button>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-red-400 transition-all hover:bg-red-500/10"
              >
                <LogOut className="h-5 w-5" />
                Выйти
              </button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
})

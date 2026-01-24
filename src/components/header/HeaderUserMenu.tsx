'use client'

import { memo, useCallback } from 'react'
import type { MouseEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { signOut } from 'next-auth/react'
import { User, LogOut, Search } from 'lucide-react'
import { hapticLight, hapticMedium } from '@/lib/haptic'
import { Notifications } from '../Notifications'
import { ThemeToggle } from '../ThemeToggle'
import { SearchButton } from '../GlobalSearch'
import type { PrimaryAction } from './header-types'
import { scheduleFallbackNavigation } from './header-utils'

interface HeaderUserMenuProps {
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
  } | null
  primaryAction?: PrimaryAction | null
  onCloseMenus: () => void
}

export const HeaderUserMenu = memo(function HeaderUserMenu({
  user,
  primaryAction,
  onCloseMenus,
}: HeaderUserMenuProps) {
  const handleNavClick = useCallback(
    (event: MouseEvent<HTMLElement>, href?: string) => {
      hapticLight()
      onCloseMenus()
      scheduleFallbackNavigation(event, href)
    },
    [onCloseMenus]
  )

  const handleSignOut = useCallback(() => {
    hapticMedium()
    signOut({ callbackUrl: '/login' })
  }, [])

  return (
    <div className="hidden items-center gap-2 md:flex">
      {/* Primary Action Button */}
      {primaryAction && (
        <Link
          href={primaryAction.href}
          onClick={(event) => handleNavClick(event, primaryAction.href)}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-teal-500/25 transition-all hover:shadow-teal-500/40 hover:brightness-110"
        >
          <primaryAction.icon className="h-4 w-4" />
          {primaryAction.label}
        </Link>
      )}

      {/* Search Button */}
      <SearchButton />

      {/* Theme Toggle */}
      <ThemeToggle />

      {user && (
        <>
          {/* Notifications */}
          <Notifications />

          {/* Profile Link */}
          <Link
            href="/profile"
            onClick={(event) => handleNavClick(event, '/profile')}
            className="group relative flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-transparent transition-all hover:ring-teal-400/50"
            title="Профиль"
            aria-label="Перейти в профиль"
          >
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name || user.email || 'User'}
                width={36}
                height={36}
                className="h-9 w-9 rounded-full object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-800">
                <User className="h-5 w-5 text-slate-300" />
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 bg-emerald-500" />
          </Link>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-red-500/10 hover:text-red-400"
            title="Выйти"
            aria-label="Выйти из аккаунта"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </>
      )}
    </div>
  )
})

// Mobile action buttons (search, notifications, etc.)
interface HeaderMobileActionsProps {
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
  } | null
  primaryAction?: PrimaryAction | null
  onOpenSearch: () => void
  onCloseMenus: () => void
}

export const HeaderMobileActions = memo(function HeaderMobileActions({
  user,
  primaryAction,
  onOpenSearch,
  onCloseMenus,
}: HeaderMobileActionsProps) {
  const handleNavClick = useCallback(
    (event: MouseEvent<HTMLElement>, href?: string) => {
      hapticLight()
      onCloseMenus()
      scheduleFallbackNavigation(event, href)
    },
    [onCloseMenus]
  )

  return (
    <div className="flex items-center gap-1.5 md:hidden">
      {/* Search */}
      <button
        onClick={() => {
          hapticLight()
          onOpenSearch()
        }}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-white/10 hover:text-white"
        aria-label="Поиск"
      >
        <Search className="h-5 w-5" />
      </button>

      {/* Primary Action */}
      {primaryAction && (
        <Link
          href={primaryAction.href}
          onClick={(event) => handleNavClick(event, primaryAction.href)}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/25"
          aria-label={primaryAction.label}
        >
          <primaryAction.icon className="h-5 w-5" />
        </Link>
      )}

      {/* Theme Toggle */}
      <ThemeToggle />

      {/* Notifications */}
      {user && <Notifications />}
    </div>
  )
})

'use client'

import Link from 'next/link'
import type { MouseEvent } from 'react'
import { usePathname } from 'next/navigation'
import { Home, FileText, Inbox, BarChart3, Settings } from 'lucide-react'
import { hapticLight } from '@/lib/haptic'
import { scheduleFallbackNavigation } from './header/header-utils'

interface MobileBottomNavProps {
  isAdmin: boolean
  hidden?: boolean
}

const NAV_ITEMS = [
  { href: '/', label: 'Главная', icon: Home },
  { href: '/letters', label: 'Письма', icon: FileText },
  { href: '/requests', label: 'Заявки', icon: Inbox },
  { href: '/reports', label: 'Отчеты', icon: BarChart3 },
]

export function MobileBottomNav({ isAdmin, hidden }: MobileBottomNavProps) {
  const pathname = usePathname()
  const items = isAdmin
    ? [...NAV_ITEMS, { href: '/settings', label: 'Настройки', icon: Settings }]
    : NAV_ITEMS

  const handleNavClick = (event: MouseEvent<HTMLElement>, href: string) => {
    hapticLight()
    scheduleFallbackNavigation(event, href)
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    if (href === '/requests') return pathname.startsWith('/requests') || pathname === '/request'
    return pathname.startsWith(href)
  }

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-[130] border-t border-white/10 bg-slate-950/80 backdrop-blur md:hidden ${hidden ? 'hidden' : ''}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Mobile navigation"
    >
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = isActive(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={(event) => handleNavClick(event, item.href)}
              aria-current={active ? 'page' : undefined}
              className={`tap-highlight flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2.5 text-[11px] leading-tight transition ${
                active ? 'text-teal-200' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="leading-none">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

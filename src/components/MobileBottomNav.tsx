'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, FileText, Inbox, BarChart3, Settings } from 'lucide-react'

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
  const items = isAdmin ? [...NAV_ITEMS, { href: '/settings', label: 'Настройки', icon: Settings }] : NAV_ITEMS

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

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
              className={`flex flex-col items-center justify-center gap-1 py-2 text-xs transition ${
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

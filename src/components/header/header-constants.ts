import { Home, FileText, Inbox, BarChart3, Settings, User } from 'lucide-react'
import type { NavItem, QuickCreateItem, PageMeta, PrimaryAction } from './header-types'

export const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Главная',
    icon: Home,
    matchPath: '/',
  },
  {
    href: '/letters',
    label: 'Письма',
    icon: FileText,
    matchPath: '/letters',
  },
  {
    href: '/requests',
    label: 'Заявки',
    icon: Inbox,
    matchPath: (pathname) => pathname.startsWith('/requests') || pathname === '/request',
  },
  {
    href: '/reports',
    label: 'Отчёты',
    icon: BarChart3,
    matchPath: '/reports',
  },
]

export const QUICK_CREATE_ITEMS: QuickCreateItem[] = [
  {
    href: '/letters/new',
    label: 'Новое письмо',
    icon: FileText,
    iconClassName: 'text-blue-400',
  },
  {
    href: '/request',
    label: 'Подать заявку',
    icon: Inbox,
    iconClassName: 'text-emerald-400',
  },
]

export function getPageMeta(pathname: string | null): PageMeta {
  if (pathname?.startsWith('/letters')) return { label: 'Письма', icon: FileText }
  if (pathname?.startsWith('/requests') || pathname?.startsWith('/request'))
    return { label: 'Заявки', icon: Inbox }
  if (pathname?.startsWith('/reports')) return { label: 'Отчёты', icon: BarChart3 }
  if (pathname?.startsWith('/my-progress')) return { label: 'Мой прогресс', icon: TrendingUp }
  if (pathname?.startsWith('/settings')) return { label: 'Настройки', icon: Settings }
  if (pathname?.startsWith('/profile')) return { label: 'Профиль', icon: User }
  if (pathname === '/') return { label: 'Главная', icon: Home }
  return { label: 'DMED', icon: Home }
}

export function getPrimaryAction(pathname: string | null): PrimaryAction | null {
  if (pathname?.startsWith('/letters')) {
    return { href: '/letters/new', label: 'Новое письмо', icon: FileText }
  }
  if (pathname?.startsWith('/requests')) {
    return { href: '/request', label: 'Подать заявку', icon: Inbox }
  }
  return null
}

export function getRoleLabel(role?: string): string {
  switch (role) {
    case 'SUPERADMIN':
      return 'Суперадмин'
    case 'ADMIN':
      return 'Администратор'
    default:
      return 'Пользователь'
  }
}

export function isActivePath(
  pathname: string | null,
  path: string | ((p: string) => boolean)
): boolean {
  if (!pathname) return false
  if (typeof path === 'function') return path(pathname)
  if (path === '/') return pathname === '/'
  return pathname.startsWith(path)
}

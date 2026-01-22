'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Menu,
  X,
  Home,
  FileText,
  Inbox,
  BarChart3,
  Settings,
  LogOut,
  RefreshCw,
  User,
  ChevronDown,
  Plus,
  Search,
  Clock,
} from 'lucide-react'
import { Notifications } from './Notifications'
import { ThemeToggle } from './ThemeToggle'
import { MobileBottomNav } from './MobileBottomNav'
import { useToast } from '@/components/Toast'
import { GlobalSearch, SearchButton } from './GlobalSearch'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { hapticLight, hapticMedium } from '@/lib/haptic'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

export function Header() {
  const { data: session } = useSession()
  const toast = useToast()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMenuOpen, setSyncMenuOpen] = useState(false)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [recentMenuOpen, setRecentMenuOpen] = useState(false)
  const [compactHeader, setCompactHeader] = useState(false)
  const [routeTransitioning, setRouteTransitioning] = useState(false)
  const [newYearVibe] = useLocalStorage<boolean>('new-year-vibe', false)
  const [personalization] = useLocalStorage<{ backgroundAnimations?: boolean }>(
    'personalization-settings',
    { backgroundAnimations: true }
  )
  const [recentItems, setRecentItems] = useLocalStorage<
    Array<{
      id: string
      label: string
      href: string
      kind: 'letter' | 'request'
      ts: number
      resolved?: boolean
      subtitle?: string
    }>
  >('recent-items', [])
  const recentFetchAbortRef = useRef<AbortController | null>(null)
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPathnameRef = useRef<string | null>(null)
  const backgroundAnimations = personalization?.backgroundAnimations ?? true
  const isAdminRole = session?.user.role === 'ADMIN' || session?.user.role === 'SUPERADMIN'
  const pageMeta = useMemo(() => {
    if (pathname?.startsWith('/letters'))
      return { label: '\u041f\u0438\u0441\u044c\u043c\u0430', icon: FileText }
    if (pathname?.startsWith('/requests') || pathname?.startsWith('/request'))
      return { label: '\u0417\u0430\u044f\u0432\u043a\u0438', icon: Inbox }
    if (pathname?.startsWith('/reports'))
      return { label: '\u041e\u0442\u0447\u0435\u0442\u044b', icon: BarChart3 }
    if (pathname?.startsWith('/settings'))
      return { label: '\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438', icon: Settings }
    if (pathname?.startsWith('/profile'))
      return { label: '\u041f\u0440\u043e\u0444\u0438\u043b\u044c', icon: User }
    if (pathname === '/') return { label: '\u0413\u043b\u0430\u0432\u043d\u0430\u044f', icon: Home }
    return { label: 'DMED', icon: Home }
  }, [pathname])
  const PageIcon = pageMeta.icon
  const primaryAction = useMemo(() => {
    if (pathname?.startsWith('/letters')) {
      return {
        href: '/letters/new',
        label: '\u041d\u043e\u0432\u043e\u0435 \u043f\u0438\u0441\u044c\u043c\u043e',
        icon: FileText,
      }
    }
    if (pathname?.startsWith('/requests')) {
      return {
        href: '/request',
        label: '\u041f\u043e\u0434\u0430\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443',
        icon: Inbox,
      }
    }
    return null
  }, [pathname])
  const roleLabel =
    session?.user.role === 'SUPERADMIN'
      ? '\u0421\u0443\u043f\u0435\u0440\u0430\u0434\u043c\u0438\u043d'
      : session?.user.role === 'ADMIN'
        ? '\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440'
        : '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c'

  // Закрыть мобильное меню при переходе на другую страницу
  useEffect(() => {
    setMobileMenuOpen(false)
    setQuickCreateOpen(false)
    setSyncMenuOpen(false)
    setRecentMenuOpen(false)
  }, [pathname])

  // Закрыть меню при клике вне и блокировка скролла
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  const closeMobileMenu = useCallback(() => {
    hapticLight()
    setMobileMenuOpen(false)
  }, [setMobileMenuOpen])

  // Свайп вниз для закрытия меню (только на handle)
  const handleSync = async (direction: 'to_sheets' | 'from_sheets') => {
    if (syncing) return

    const confirmMsg =
      direction === 'to_sheets'
        ? '\u0421\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435 \u0441 Google Sheets?\n\n\u0412\u041d\u0418\u041c\u0410\u041d\u0418\u0415: \u0431\u0443\u0434\u0443\u0442 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u044b \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u043d\u044b\u0435 \u0437\u0430\u043f\u0438\u0441\u0438.'
        : '\u0421\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435 \u0438\u0437 Google Sheets?\n\n\u0411\u0443\u0434\u0443\u0442 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u044b \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u043d\u044b\u0435 \u0437\u0430\u043f\u0438\u0441\u0438.'

    if (!confirm(confirmMsg)) return

    setSyncing(true)
    setSyncMenuOpen(false)

    const toastId = toast.loading(
      direction === 'to_sheets'
        ? '\u0421\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0430\u0446\u0438\u044f \u0441 Google Sheets...'
        : '\u0418\u043c\u043f\u043e\u0440\u0442 \u0438\u0437 Google Sheets...'
    )

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      })

      const data = await res.json()

      if (data.success) {
        const count = data.rowsAffected || data.imported || 0
        const conflicts = Array.isArray(data.conflicts) ? data.conflicts.length : 0
        if (conflicts > 0) {
          toast.warning(
            `\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e ${count} \u0437\u0430\u043f\u0438\u0441\u0435\u0439. \u041a\u043e\u043d\u0444\u043b\u0438\u043a\u0442\u044b: ${conflicts}.`,
            { id: toastId }
          )
        } else {
          toast.success(
            `\u0413\u043e\u0442\u043e\u0432\u043e! \u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e ${count} \u0437\u0430\u043f\u0438\u0441\u0435\u0439`,
            { id: toastId }
          )
        }
        setTimeout(() => window.location.reload(), 1500)
      } else {
        toast.error(`\u041e\u0448\u0438\u0431\u043a\u0430: ${data.error}`, { id: toastId })
      }
    } catch {
      toast.error(
        '\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0430\u0446\u0438\u0438',
        { id: toastId }
      )
    } finally {
      setSyncing(false)
    }
  }

  const isActive = useCallback(
    (path: string) => {
      if (!pathname) return false
      if (path === '/') return pathname === '/'
      if (path === '/requests') return pathname.startsWith('/requests') || pathname === '/request'
      return pathname.startsWith(path)
    },
    [pathname]
  )

  const navLinkClass = 'app-nav-link app-nav-link-refined whitespace-nowrap text-sm'
  const handleNavClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }
      event.preventDefault()
      hapticLight()
      setSyncMenuOpen(false)
      setQuickCreateOpen(false)
      setRecentMenuOpen(false)
      router.push(href)
    },
    [router]
  )

  const openSearch = useCallback(() => {
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
    })
    document.dispatchEvent(event)
  }, [])

  useEffect(() => {
    if (!mobileMenuOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMobileMenu()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileMenuOpen, closeMobileMenu])

  useEffect(() => {
    const handleScroll = () => {
      setCompactHeader(window.scrollY > 12)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!pathname) return
    const letterMatch = pathname.match(/^\/letters\/([a-zA-Z0-9_-]+)$/)
    const requestMatch = pathname.match(/^\/requests\/([a-zA-Z0-9_-]+)$/)
    const isNew = pathname.endsWith('/new') || pathname.endsWith('/create')
    if (isNew) return

    const match = letterMatch ?? requestMatch
    if (!match) return
    const id = match[1]
    const kind: 'letter' | 'request' = letterMatch ? 'letter' : 'request'
    const label =
      kind === 'letter'
        ? `\u041f\u0438\u0441\u044c\u043c\u043e ${id.slice(0, 6)}`
        : `\u0417\u0430\u044f\u0432\u043a\u0430 ${id.slice(0, 6)}`
    setRecentItems((prev) => {
      const next = prev.filter((item) => item.href !== pathname)
      next.unshift({ id, label, href: pathname, kind, ts: Date.now(), resolved: false })
      return next.slice(0, 5)
    })
  }, [pathname, setRecentItems])

  useEffect(() => {
    if (!pathname) return
    if (lastPathnameRef.current && lastPathnameRef.current !== pathname) {
      setRouteTransitioning(true)
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current)
      }
      transitionTimerRef.current = setTimeout(() => {
        setRouteTransitioning(false)
      }, 450)
    } else {
      setRouteTransitioning(false)
    }
    lastPathnameRef.current = pathname
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current)
      }
    }
  }, [pathname])

  useEffect(() => {
    if (!recentMenuOpen && !mobileMenuOpen) return
    if (recentItems.length === 0) return

    const pending = recentItems.filter((item) => !item.resolved)
    if (pending.length === 0) return

    const controller = new AbortController()
    recentFetchAbortRef.current?.abort()
    recentFetchAbortRef.current = controller

    type RecentUpdate = { id: string; label: string; subtitle?: string; resolved: true }

    const fetchDetails = async () => {
      const resolvedItems: Array<RecentUpdate | null> = await Promise.all(
        pending.map(async (item) => {
          try {
            if (item.kind === 'letter') {
              const res = await fetch(`/api/letters/${item.id}?summary=1`, {
                signal: controller.signal,
                cache: 'no-store',
              })
              if (!res.ok) return null
              const data = await res.json()
              const number = typeof data?.number === 'string' ? data.number : null
              const org = typeof data?.org === 'string' ? data.org : null
              const label = number
                ? `\u041f\u0438\u0441\u044c\u043c\u043e \u2116${number}`
                : item.label
              return {
                id: item.id,
                label,
                subtitle: org || undefined,
                resolved: true,
              }
            }

            const res = await fetch(`/api/requests/${item.id}`, {
              signal: controller.signal,
              cache: 'no-store',
            })
            if (!res.ok) return null
            const data = await res.json()
            const request = data?.request
            const org = typeof request?.organization === 'string' ? request.organization : null
            const contact =
              typeof request?.contactName === 'string'
                ? request.contactName
                : typeof request?.contactEmail === 'string'
                  ? request.contactEmail
                  : null
            const label = org ? `\u0417\u0430\u044f\u0432\u043a\u0430: ${org}` : item.label
            return {
              id: item.id,
              label,
              subtitle: contact || undefined,
              resolved: true,
            }
          } catch (error) {
            if ((error as Error)?.name === 'AbortError') {
              return null
            }
            return null
          }
        })
      )

      if (controller.signal.aborted) return
      const updates = resolvedItems.filter((item): item is RecentUpdate => Boolean(item))
      if (updates.length === 0) return
      setRecentItems((prev) =>
        prev.map((item) => {
          const match = updates.find((update) => update.id === item.id)
          return match ? { ...item, ...match } : item
        })
      )
    }

    void fetchDetails()
    return () => {
      controller.abort()
    }
  }, [mobileMenuOpen, recentItems, recentMenuOpen, setRecentItems])

  useEffect(() => {
    if (!quickCreateOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setQuickCreateOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [quickCreateOpen])

  useEffect(() => {
    if (!recentMenuOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setRecentMenuOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [recentMenuOpen])

  return (
    <header
      className={`app-header app-header-refined app-header-safe relative sticky top-0 z-[120] ${compactHeader ? 'app-header-compact' : ''}`}
      data-compact={compactHeader}
    >
      {/* Christmas lights */}
      {newYearVibe && backgroundAnimations && (
        <div className="pointer-events-none absolute left-0 right-0 top-0 hidden justify-around overflow-hidden sm:flex">
          {Array.from({ length: 15 }).map((_, i) => {
            const colors = ['#ef4444', '#22c55e', '#f59e0b', '#3b82f6']
            const color = colors[i % colors.length]
            return (
              <span
                key={i}
                className={`animate-twinkle twinkle-delay-${i} inline-block h-2.5 w-2.5 rounded-full`}
                style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
              />
            )
          })}
        </div>
      )}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={`flex items-center justify-between ${compactHeader ? 'h-12 sm:h-14' : 'h-14 sm:h-16'}`}
        >
          {/* Logo */}
          <Link
            href="/"
            className="flex shrink-0 items-center gap-3 transition-transform hover:scale-105"
          >
            <div
              className={`relative overflow-hidden rounded-xl shadow-lg shadow-teal-500/30 ${compactHeader ? 'h-8 w-8 sm:h-9 sm:w-9' : 'h-10 w-10 sm:h-11 sm:w-11'}`}
            >
              <Image src="/logo-mark.svg" alt="DMED" fill className="object-contain" priority />
            </div>
            <div className="hidden leading-tight sm:block">
              <span className="text-lg font-semibold text-white">DMED Letters</span>
              <span className="block text-xs tracking-wide text-amber-300/60">Document Flow</span>
            </div>
            <span className="text-sm font-semibold text-white sm:hidden">DMED</span>
          </Link>
          <div className="ml-2 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200/80 sm:hidden">
            <PageIcon className="h-3.5 w-3.5 text-slate-300" />
            <span className="max-w-[120px] truncate">{pageMeta.label}</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            <Link
              href="/"
              className={navLinkClass}
              data-active={isActive('/')}
              aria-current={isActive('/') ? 'page' : undefined}
              onClick={(event) => handleNavClick(event, '/')}
            >
              <Home className="h-4 w-4" />
              {'\u0413\u043b\u0430\u0432\u043d\u0430\u044f'}
            </Link>
            <Link
              href="/letters"
              className={navLinkClass}
              data-active={isActive('/letters')}
              aria-current={isActive('/letters') ? 'page' : undefined}
              onClick={(event) => handleNavClick(event, '/letters')}
            >
              <FileText className="h-4 w-4" />
              {'\u041f\u0438\u0441\u044c\u043c\u0430'}
            </Link>
            <Link
              href="/requests"
              className={navLinkClass}
              data-active={isActive('/requests')}
              aria-current={isActive('/requests') ? 'page' : undefined}
              onClick={(event) => handleNavClick(event, '/requests')}
            >
              <Inbox className="h-4 w-4" />
              {'\u0417\u0430\u044f\u0432\u043a\u0438'}
            </Link>
            <Link
              href="/reports"
              className={navLinkClass}
              data-active={isActive('/reports')}
              aria-current={isActive('/reports') ? 'page' : undefined}
              onClick={(event) => handleNavClick(event, '/reports')}
            >
              <BarChart3 className="h-4 w-4" />
              {'\u041e\u0442\u0447\u0435\u0442\u044b'}
            </Link>

            {isAdminRole && (
              <div className="relative">
                <button
                  onClick={() => setSyncMenuOpen(!syncMenuOpen)}
                  disabled={syncing}
                  aria-haspopup="menu"
                  aria-expanded={syncMenuOpen}
                  className={`${navLinkClass} ${syncing ? 'opacity-50' : ''}`}
                  data-active={syncMenuOpen}
                >
                  <Settings className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                  <ChevronDown
                    className={`h-3 w-3 transition ${syncMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {syncMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setSyncMenuOpen(false)} />
                    <div className="panel panel-glass animate-scaleIn absolute right-0 top-full z-50 mt-2 min-w-48 origin-top-right rounded-xl shadow-xl">
                      <Link
                        href="/settings"
                        className="tap-highlight flex w-full items-center gap-2 rounded-t-lg px-4 py-3 text-slate-200/80 transition hover:bg-white/5 hover:text-white"
                        onClick={() => {
                          hapticLight()
                          setSyncMenuOpen(false)
                        }}
                      >
                        <Settings className="h-4 w-4" />
                        {'Настройки'}
                      </Link>
                      <div className="border-t border-white/10" />
                      <button
                        onClick={() => {
                          hapticMedium()
                          handleSync('from_sheets')
                        }}
                        disabled={syncing}
                        className="tap-highlight flex w-full items-center gap-2 px-4 py-3 text-slate-200/80 transition hover:bg-white/5 hover:text-white"
                      >
                        <RefreshCw className="h-4 w-4" />
                        {'Импорт из Sheets'}
                      </button>
                      <button
                        onClick={() => {
                          hapticMedium()
                          handleSync('to_sheets')
                        }}
                        disabled={syncing}
                        className="tap-highlight flex w-full items-center gap-2 rounded-b-lg px-4 py-3 text-slate-200/80 transition hover:bg-white/5 hover:text-white"
                      >
                        <RefreshCw className="h-4 w-4" />
                        {'Экспорт в Sheets'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </nav>

          {/* User Menu */}
          <div className="hidden items-center gap-2 md:flex">
            {primaryAction && (
              <Link
                href={primaryAction.href}
                className="btn-primary inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white transition"
              >
                <primaryAction.icon className="h-4 w-4" />
                {primaryAction.label}
              </Link>
            )}
            {/* Quick Create Button */}
            <div className="relative">
              <button
                onClick={() => {
                  hapticLight()
                  setQuickCreateOpen(!quickCreateOpen)
                }}
                className="tap-highlight app-icon-button app-icon-cta h-8 w-8"
                title="Создать"
              >
                <Plus className={`h-5 w-5 transition ${quickCreateOpen ? 'rotate-45' : ''}`} />
              </button>
              {quickCreateOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setQuickCreateOpen(false)} />
                  <div className="panel panel-glass animate-scaleIn absolute right-0 top-full z-50 mt-2 min-w-48 origin-top-right rounded-xl shadow-xl">
                    <Link
                      href="/letters/new"
                      className="tap-highlight flex w-full items-center gap-2 rounded-t-lg px-4 py-3 text-slate-200/80 transition hover:bg-white/5 hover:text-white"
                      onClick={() => {
                        hapticLight()
                        setQuickCreateOpen(false)
                      }}
                    >
                      <FileText className="h-4 w-4 text-blue-400" />
                      {'Новое письмо'}
                    </Link>
                    <div className="border-t border-white/10" />
                    <Link
                      href="/request"
                      className="tap-highlight flex w-full items-center gap-2 rounded-b-lg px-4 py-3 text-slate-200/80 transition hover:bg-white/5 hover:text-white"
                      onClick={() => {
                        hapticLight()
                        setQuickCreateOpen(false)
                      }}
                    >
                      <Inbox className="h-4 w-4 text-emerald-400" />
                      {'Подать заявку'}
                    </Link>
                  </div>
                </>
              )}
            </div>
            {recentItems.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => {
                    hapticLight()
                    setRecentMenuOpen(!recentMenuOpen)
                  }}
                  className="tap-highlight app-icon-button p-2"
                  aria-haspopup="menu"
                  aria-expanded={recentMenuOpen}
                  title="\u041d\u0435\u0434\u0430\u0432\u043d\u043e\u0435"
                >
                  <Clock className="h-4.5 w-4.5" />
                </button>
                {recentMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setRecentMenuOpen(false)} />
                    <div className="panel panel-glass animate-scaleIn absolute right-0 top-full z-50 mt-2 w-60 origin-top-right rounded-xl shadow-xl">
                      <div className="px-4 py-2 text-xs uppercase tracking-wide text-slate-400/80">
                        {'\u041d\u0435\u0434\u0430\u0432\u043d\u043e\u0435'}
                      </div>
                      <div className="border-t border-white/10" />
                      <div className="max-h-64 overflow-y-auto">
                        {recentItems.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => {
                              hapticLight()
                              setRecentMenuOpen(false)
                            }}
                            className="tap-highlight flex w-full items-center gap-2 px-4 py-3 text-sm text-slate-200/80 transition hover:bg-white/5 hover:text-white"
                          >
                            {item.kind === 'letter' ? (
                              <FileText className="h-4 w-4 text-blue-400" />
                            ) : (
                              <Inbox className="h-4 w-4 text-emerald-400" />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{item.label}</span>
                              {item.subtitle && (
                                <span className="block truncate text-xs text-slate-400/90">
                                  {item.subtitle}
                                </span>
                              )}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            <SearchButton />
            <ThemeToggle />
            {session?.user && (
              <>
                <Notifications />
                <Link
                  href="/profile"
                  onClick={() => hapticLight()}
                  className="tap-highlight app-icon-button rounded-full p-1.5"
                  title={'Профиль'}
                >
                  {session.user.image ? (
                    <Image
                      src={session.user.image}
                      alt={session.user.name || session.user.email || 'User'}
                      width={28}
                      height={28}
                      className="h-7 w-7 rounded-full"
                      unoptimized
                    />
                  ) : (
                    <User className="h-7 w-7 rounded-full bg-white/10 p-1" />
                  )}
                </Link>
                <button
                  onClick={() => {
                    hapticMedium()
                    signOut({ callbackUrl: '/login' })
                  }}
                  className="tap-highlight app-icon-button p-2"
                  title="Выйти"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          {/* Mobile right section */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <div className="flex items-center gap-2 md:hidden">
              <button
                onClick={() => {
                  hapticLight()
                  openSearch()
                }}
                aria-label="\u041f\u043e\u0438\u0441\u043a"
                className="tap-highlight touch-target app-icon-button"
              >
                <Search className="h-5 w-5" />
              </button>
              {primaryAction && (
                <Link
                  href={primaryAction.href}
                  onClick={() => hapticLight()}
                  className="tap-highlight app-icon-button app-icon-cta h-9 w-9"
                  aria-label={primaryAction.label}
                >
                  <primaryAction.icon className="h-5 w-5" />
                </Link>
              )}
              <div className="relative">
                <button
                  onClick={() => {
                    hapticLight()
                    setQuickCreateOpen(!quickCreateOpen)
                  }}
                  className="tap-highlight app-icon-button app-icon-cta h-9 w-9"
                  aria-label="\u0421\u043e\u0437\u0434\u0430\u0442\u044c"
                >
                  <Plus className={`h-5 w-5 transition ${quickCreateOpen ? 'rotate-45' : ''}`} />
                </button>
                {quickCreateOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setQuickCreateOpen(false)} />
                    <div className="panel panel-glass animate-scaleIn absolute right-0 top-full z-50 mt-2 min-w-48 origin-top-right rounded-xl shadow-xl">
                      <Link
                        href="/letters/new"
                        className="tap-highlight flex w-full items-center gap-2 rounded-t-lg px-4 py-3 text-slate-200/80 transition hover:bg-white/5 hover:text-white"
                        onClick={() => {
                          hapticLight()
                          setQuickCreateOpen(false)
                        }}
                      >
                        <FileText className="h-4 w-4 text-blue-400" />
                        {'\u041d\u043e\u0432\u043e\u0435 \u043f\u0438\u0441\u044c\u043c\u043e'}
                      </Link>
                      <div className="border-t border-white/10" />
                      <Link
                        href="/request"
                        className="tap-highlight flex w-full items-center gap-2 rounded-b-lg px-4 py-3 text-slate-200/80 transition hover:bg-white/5 hover:text-white"
                        onClick={() => {
                          hapticLight()
                          setQuickCreateOpen(false)
                        }}
                      >
                        <Inbox className="h-4 w-4 text-emerald-400" />
                        {
                          '\u041f\u043e\u0434\u0430\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443'
                        }
                      </Link>
                    </div>
                  </>
                )}
              </div>
              <ThemeToggle />
              {session?.user && <Notifications />}
              <SheetTrigger asChild>
                <button
                  onClick={() => hapticLight()}
                  aria-label={
                    mobileMenuOpen
                      ? '\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043c\u0435\u043d\u044e'
                      : '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043c\u0435\u043d\u044e'
                  }
                  aria-expanded={mobileMenuOpen}
                  aria-controls="mobile-menu"
                  className="tap-highlight touch-target app-icon-button"
                >
                  {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
              </SheetTrigger>
            </div>
            {mobileMenuOpen && (
              <SheetContent
                id="mobile-menu"
                side="bottom"
                className="mobile-menu max-h-[85vh] border-t border-white/10 p-0 md:hidden [&>button]:hidden"
              >
                <div className="max-h-[85vh] overflow-y-auto">
                  <div className="relative sticky top-0 z-10 flex items-center justify-center border-b border-white/10 bg-slate-900/70 px-4 py-3 sm:hidden">
                    <span
                      id="mobile-menu-title"
                      className="absolute left-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400/80"
                    >
                      {'\u041d\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044f'}
                    </span>
                    <div className="h-1 w-10 rounded-full bg-white/20" />
                    <button
                      onClick={closeMobileMenu}
                      aria-label="\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043c\u0435\u043d\u044e"
                      className="tap-highlight touch-target absolute right-3 top-1/2 -translate-y-1/2 rounded-md text-slate-200/80 transition hover:bg-white/5 hover:text-white"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <nav
                    aria-label="\u041c\u0435\u043d\u044e"
                    className="stagger-animation flex flex-col gap-2 p-4"
                    style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <Link
                        href="/letters/new"
                        onClick={closeMobileMenu}
                        className="tap-highlight touch-target flex flex-col items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200/80 transition hover:bg-white/10"
                      >
                        <FileText className="h-5 w-5 text-blue-400" />
                        <span className="leading-tight">
                          {'\u041d\u043e\u0432\u043e\u0435 \u043f\u0438\u0441\u044c\u043c\u043e'}
                        </span>
                      </Link>
                      <Link
                        href="/request"
                        onClick={closeMobileMenu}
                        className="tap-highlight touch-target flex flex-col items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200/80 transition hover:bg-white/10"
                      >
                        <Inbox className="h-5 w-5 text-emerald-400" />
                        <span className="leading-tight">
                          {
                            '\u041f\u043e\u0434\u0430\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443'
                          }
                        </span>
                      </Link>
                    </div>
                    {recentItems.length > 0 && (
                      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400/80">
                          {'\u041d\u0435\u0434\u0430\u0432\u043d\u043e\u0435'}
                        </div>
                        <div className="space-y-2">
                          {recentItems.map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={closeMobileMenu}
                              className="tap-highlight flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-200/80 transition hover:bg-white/10 hover:text-white"
                            >
                              {item.kind === 'letter' ? (
                                <FileText className="h-4 w-4 text-blue-400" />
                              ) : (
                                <Inbox className="h-4 w-4 text-emerald-400" />
                              )}
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm">{item.label}</span>
                                {item.subtitle && (
                                  <span className="block truncate text-xs text-slate-400/90">
                                    {item.subtitle}
                                  </span>
                                )}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* User info */}
                    {session?.user && (
                      <div className="mb-4 flex items-center gap-3 rounded-lg bg-white/10 p-3">
                        {session.user.image ? (
                          <Image
                            src={session.user.image}
                            alt={session.user.name || session.user.email || 'User'}
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded-full"
                            unoptimized
                          />
                        ) : (
                          <User className="h-10 w-10 rounded-full bg-white/10 p-2" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-white">
                            {session.user.name || session.user.email?.split('@')[0]}
                          </p>
                          <p className="truncate text-xs text-slate-400">{roleLabel}</p>
                        </div>
                        <Link
                          href="/profile"
                          onClick={closeMobileMenu}
                          className="tap-highlight inline-flex shrink-0 items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-xs text-teal-200 transition hover:bg-teal-500/20"
                        >
                          <User className="h-3.5 w-3.5" />
                          {'\u041f\u0440\u043e\u0444\u0438\u043b\u044c'}
                        </Link>
                      </div>
                    )}

                    <Link
                      href="/"
                      onClick={closeMobileMenu}
                      className={`tap-highlight touch-target flex items-center gap-3 rounded-lg px-4 py-3 transition ${
                        isActive('/')
                          ? 'border border-teal-400/20 bg-teal-400/15 text-teal-200'
                          : 'text-slate-200/80 hover:bg-white/5'
                      }`}
                      aria-current={isActive('/') ? 'page' : undefined}
                    >
                      <Home className="h-5 w-5" />
                      {'\u0413\u043b\u0430\u0432\u043d\u0430\u044f'}
                    </Link>

                    <Link
                      href="/letters"
                      onClick={closeMobileMenu}
                      className={`tap-highlight touch-target flex items-center gap-3 rounded-lg px-4 py-3 transition ${
                        isActive('/letters')
                          ? 'border border-teal-400/20 bg-teal-400/15 text-teal-200'
                          : 'text-slate-200/80 hover:bg-white/5'
                      }`}
                      aria-current={isActive('/letters') ? 'page' : undefined}
                    >
                      <FileText className="h-5 w-5" />
                      {'\u041f\u0438\u0441\u044c\u043c\u0430'}
                    </Link>

                    <Link
                      href="/requests"
                      onClick={closeMobileMenu}
                      className={`tap-highlight touch-target flex items-center gap-3 rounded-lg px-4 py-3 transition ${
                        isActive('/requests')
                          ? 'border border-teal-400/20 bg-teal-400/15 text-teal-200'
                          : 'text-slate-200/80 hover:bg-white/5'
                      }`}
                      aria-current={isActive('/requests') ? 'page' : undefined}
                    >
                      <Inbox className="h-5 w-5" />
                      {'\u0417\u0430\u044f\u0432\u043a\u0438'}
                    </Link>

                    <Link
                      href="/reports"
                      onClick={closeMobileMenu}
                      className={`tap-highlight touch-target flex items-center gap-3 rounded-lg px-4 py-3 transition ${
                        isActive('/reports')
                          ? 'border border-teal-400/20 bg-teal-400/15 text-teal-200'
                          : 'text-slate-200/80 hover:bg-white/5'
                      }`}
                      aria-current={isActive('/reports') ? 'page' : undefined}
                    >
                      <BarChart3 className="h-5 w-5" />
                      {'\u041e\u0442\u0447\u0435\u0442\u044b'}
                    </Link>

                    {isAdminRole && (
                      <>
                        <div className="my-2 border-t border-white/10" />
                        <p className="px-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400/80">
                          {
                            '\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435'
                          }
                        </p>

                        <button
                          onClick={() => {
                            hapticMedium()
                            setMobileMenuOpen(false)
                            handleSync('from_sheets')
                          }}
                          disabled={syncing}
                          className="tap-highlight touch-target flex items-center gap-3 rounded-lg px-4 py-3 text-slate-200/80 transition hover:bg-white/5 disabled:opacity-50"
                        >
                          <RefreshCw className="h-5 w-5" />
                          {'\u0418\u043c\u043f\u043e\u0440\u0442 \u0438\u0437 Sheets'}
                        </button>

                        <button
                          onClick={() => {
                            hapticMedium()
                            setMobileMenuOpen(false)
                            handleSync('to_sheets')
                          }}
                          disabled={syncing}
                          className="tap-highlight touch-target flex items-center gap-3 rounded-lg px-4 py-3 text-slate-200/80 transition hover:bg-white/5 disabled:opacity-50"
                        >
                          <RefreshCw className="h-5 w-5" />
                          {'\u042d\u043a\u0441\u043f\u043e\u0440\u0442 \u0432 Sheets'}
                        </button>

                        <Link
                          href="/settings"
                          onClick={closeMobileMenu}
                          className={`tap-highlight touch-target flex items-center gap-3 rounded-lg px-4 py-3 transition ${
                            isActive('/settings')
                              ? 'border border-teal-400/20 bg-teal-400/15 text-teal-200'
                              : 'text-slate-200/80 hover:bg-white/5'
                          }`}
                          aria-current={isActive('/settings') ? 'page' : undefined}
                        >
                          <Settings className="h-5 w-5" />
                          {'\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438'}
                        </Link>
                      </>
                    )}

                    <div className="my-2 border-t border-white/10" />

                    <button
                      onClick={closeMobileMenu}
                      className="tap-highlight touch-target flex items-center gap-3 rounded-lg px-4 py-3 text-slate-200/80 transition hover:bg-white/5"
                    >
                      <X className="h-5 w-5" />
                      {'\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043c\u0435\u043d\u044e'}
                    </button>

                    <button
                      onClick={() => {
                        hapticMedium()
                        setMobileMenuOpen(false)
                        signOut({ callbackUrl: '/login' })
                      }}
                      className="tap-highlight touch-target flex items-center gap-3 rounded-lg px-4 py-3 text-red-400 transition hover:bg-red-500/10"
                    >
                      <LogOut className="h-5 w-5" />
                      {'\u0412\u044b\u0439\u0442\u0438'}
                    </button>
                  </nav>
                </div>
              </SheetContent>
            )}
          </Sheet>
        </div>
      </div>

      {routeTransitioning && (
        <div className="app-header-progress" aria-hidden="true">
          <span className="app-header-progress-bar" />
        </div>
      )}

      <MobileBottomNav isAdmin={isAdminRole} hidden={mobileMenuOpen} />
      <GlobalSearch />
    </header>
  )
}

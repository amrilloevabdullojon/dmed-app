'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
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
} from 'lucide-react'
import { Notifications } from './Notifications'
import { ThemeToggle } from './ThemeToggle'
import { MobileBottomNav } from './MobileBottomNav'
import { useToast } from '@/components/Toast'
import { GlobalSearch, SearchButton } from './GlobalSearch'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { hapticLight, hapticMedium } from '@/lib/haptic'
import { useSwipeRef } from '@/hooks/useSwipe'

export function Header() {
  const { data: session } = useSession()
  const toast = useToast()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMenuOpen, setSyncMenuOpen] = useState(false)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [newYearVibe] = useLocalStorage<boolean>('new-year-vibe', false)
  const [personalization] = useLocalStorage<{ backgroundAnimations?: boolean }>(
    'personalization-settings',
    { backgroundAnimations: true }
  )
  const backgroundAnimations = personalization?.backgroundAnimations ?? true
  const isAdminRole = session?.user.role === 'ADMIN' || session?.user.role === 'SUPERADMIN'
  const roleLabel =
    session?.user.role === 'SUPERADMIN'
      ? '\u0421\u0443\u043f\u0435\u0440\u0430\u0434\u043c\u0438\u043d'
      : session?.user.role === 'ADMIN'
        ? '\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440'
        : '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c'

  // Закрыть мобильное меню при переходе на другую страницу
  useEffect(() => {
    setMobileMenuOpen(false)
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
  const handleSwipeRef = useSwipeRef<HTMLDivElement>(
    {
      onSwipeDown: () => {
        if (!mobileMenuOpen) return
        if (handleSwipeRef.current?.scrollTop !== 0) return
        closeMobileMenu()
      },
    },
    {
      minSwipeDistance: 30,
      maxSwipeTime: 300,
    }
  )

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

  const isActive = (path: string) => pathname === path

  const navLinkClass = 'app-nav-link whitespace-nowrap text-sm'

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

  return (
    <header className="app-header relative sticky top-0 z-[120] backdrop-blur">
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
        <div className="flex h-14 items-center justify-between sm:h-16">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <div className="relative h-9 w-9 overflow-hidden rounded-xl shadow-lg shadow-teal-500/30 sm:h-10 sm:w-10">
              <Image src="/logo-mark.svg" alt="DMED" fill className="object-contain" priority />
            </div>
            <div className="hidden leading-tight sm:block">
              <span className="text-lg font-semibold text-white">DMED Letters</span>
              <span className="block text-xs tracking-wide text-amber-300/80">Document Flow</span>
            </div>
            <span className="text-sm font-semibold text-white sm:hidden">DMED</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1 md:flex">
            <Link href="/" className={navLinkClass} data-active={isActive('/')}>
              <Home className="h-4 w-4" />
              {'\u0413\u043b\u0430\u0432\u043d\u0430\u044f'}
            </Link>
            <Link href="/letters" className={navLinkClass} data-active={isActive('/letters')}>
              <FileText className="h-4 w-4" />
              {'\u041f\u0438\u0441\u044c\u043c\u0430'}
            </Link>
            <Link href="/requests" className={navLinkClass} data-active={isActive('/requests')}>
              <Inbox className="h-4 w-4" />
              {'\u0417\u0430\u044f\u0432\u043a\u0438'}
            </Link>
            <Link href="/reports" className={navLinkClass} data-active={isActive('/reports')}>
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
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            {session?.user && <Notifications />}
            <button
              onClick={() => {
                hapticLight()
                setMobileMenuOpen((prev) => !prev)
              }}
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
          </div>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="mobile-overlay fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm md:hidden"
          onClick={closeMobileMenu}
          onPointerDown={closeMobileMenu}
        />
      )}

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        ref={handleSwipeRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-menu-title"
        className={`mobile-menu fixed inset-x-0 bottom-0 z-[120] max-h-[85vh] transform overflow-y-auto rounded-t-2xl border-t border-white/10 transition-transform duration-300 sm:inset-y-0 sm:left-auto sm:right-0 sm:top-16 sm:max-h-none sm:w-[85vw] sm:max-w-[320px] sm:translate-y-0 sm:rounded-none sm:border-t-0 md:hidden ${
          mobileMenuOpen ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-x-full'
        }`}
      >
        <div className="relative sticky top-0 z-10 flex cursor-grab items-center justify-center border-b border-white/10 bg-slate-900/70 px-4 py-3 active:cursor-grabbing sm:hidden">
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
              <span className="leading-tight">{'Новое письмо'}</span>
            </Link>
            <Link
              href="/request"
              onClick={closeMobileMenu}
              className="tap-highlight touch-target flex flex-col items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200/80 transition hover:bg-white/10"
            >
              <Inbox className="h-5 w-5 text-emerald-400" />
              <span className="leading-tight">{'Подать заявку'}</span>
            </Link>
          </div>
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
            Выйти
          </button>
        </nav>
      </div>
      <MobileBottomNav isAdmin={isAdminRole} hidden={mobileMenuOpen} />
      <GlobalSearch />
    </header>
  )
}

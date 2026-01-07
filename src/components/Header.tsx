'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { useState, useEffect } from 'react'
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

export function Header() {
  const { data: session } = useSession()
  const toast = useToast()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMenuOpen, setSyncMenuOpen] = useState(false)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [newYearVibe] = useLocalStorage<boolean>('new-year-vibe', false)
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

  // Закрыть меню при клике вне
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
    } catch (error) {
      toast.error(
        '\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0430\u0446\u0438\u0438',
        { id: toastId }
      )
    } finally {
      setSyncing(false)
    }
  }

  const isActive = (path: string) => pathname === path

  const navLinkClass = (path: string) =>
    `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition whitespace-nowrap text-sm ${
      isActive(path)
        ? 'bg-teal-400/15 text-teal-200 border border-teal-400/20'
        : 'text-slate-200/80 hover:bg-white/5 hover:text-white'
    }`

  return (
    <header className="app-header relative sticky top-0 z-[120] backdrop-blur">
      {/* Christmas lights */}
      {newYearVibe && (
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
            <Link href="/" className={navLinkClass('/')}>
              <Home className="h-4 w-4" />
              {'\u0413\u043b\u0430\u0432\u043d\u0430\u044f'}
            </Link>
            <Link href="/letters" className={navLinkClass('/letters')}>
              <FileText className="h-4 w-4" />
              {'\u041f\u0438\u0441\u044c\u043c\u0430'}
            </Link>
            <Link href="/requests" className={navLinkClass('/requests')}>
              <Inbox className="h-4 w-4" />
              {'\u0417\u0430\u044f\u0432\u043a\u0438'}
            </Link>
            <Link href="/reports" className={navLinkClass('/reports')}>
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
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm transition ${
                    syncing ? 'opacity-50' : 'text-slate-200/80 hover:bg-white/5 hover:text-white'
                  }`}
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
                        className="flex w-full items-center gap-2 rounded-t-lg px-4 py-3 text-slate-200/80 transition hover:bg-white/5 hover:text-white"
                        onClick={() => setSyncMenuOpen(false)}
                      >
                        <Settings className="h-4 w-4" />
                        {'Настройки'}
                      </Link>
                      <div className="border-t border-white/10" />
                      <button
                        onClick={() => handleSync('from_sheets')}
                        disabled={syncing}
                        className="flex w-full items-center gap-2 px-4 py-3 text-slate-200/80 transition hover:bg-white/5 hover:text-white"
                      >
                        <RefreshCw className="h-4 w-4" />
                        {'Импорт из Sheets'}
                      </button>
                      <button
                        onClick={() => handleSync('to_sheets')}
                        disabled={syncing}
                        className="flex w-full items-center gap-2 rounded-b-lg px-4 py-3 text-slate-200/80 transition hover:bg-white/5 hover:text-white"
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
                onClick={() => setQuickCreateOpen(!quickCreateOpen)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500 text-white shadow-lg shadow-teal-500/30 transition hover:bg-teal-400"
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
                      className="flex w-full items-center gap-2 rounded-t-lg px-4 py-3 text-slate-200/80 transition hover:bg-white/5 hover:text-white"
                      onClick={() => setQuickCreateOpen(false)}
                    >
                      <FileText className="h-4 w-4 text-blue-400" />
                      {'Новое письмо'}
                    </Link>
                    <div className="border-t border-white/10" />
                    <Link
                      href="/request"
                      className="flex w-full items-center gap-2 rounded-b-lg px-4 py-3 text-slate-200/80 transition hover:bg-white/5 hover:text-white"
                      onClick={() => setQuickCreateOpen(false)}
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
                  className="rounded-full bg-white/10 p-1.5 transition hover:bg-white/20"
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
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
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
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={
                mobileMenuOpen
                  ? '\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043c\u0435\u043d\u044e'
                  : '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043c\u0435\u043d\u044e'
              }
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="mobile-overlay fixed inset-0 z-[110] md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        className={`mobile-menu fixed bottom-0 right-0 top-14 z-[120] w-[85vw] max-w-[320px] transform overflow-y-auto transition-transform duration-300 sm:top-16 md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <nav className="flex flex-col gap-1 p-4">
          <Link
            href="/request"
            className={`flex items-center gap-3 rounded-lg px-4 py-3 transition ${
              isActive('/request')
                ? 'border border-teal-400/20 bg-teal-400/15 text-teal-200'
                : 'text-slate-200/80 hover:bg-white/5'
            }`}
          >
            {'Подать заявку'}
          </Link>
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
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-xs text-teal-200 transition hover:bg-teal-500/20"
              >
                <User className="h-3.5 w-3.5" />
                {'\u041f\u0440\u043e\u0444\u0438\u043b\u044c'}
              </Link>
            </div>
          )}

          <Link
            href="/"
            className={`flex items-center gap-3 rounded-lg px-4 py-3 transition ${
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
            className={`flex items-center gap-3 rounded-lg px-4 py-3 transition ${
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
            className={`flex items-center gap-3 rounded-lg px-4 py-3 transition ${
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
            className={`flex items-center gap-3 rounded-lg px-4 py-3 transition ${
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

              <button
                onClick={() => handleSync('from_sheets')}
                disabled={syncing}
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-slate-200/80 transition hover:bg-white/5 disabled:opacity-50"
              >
                <span className="text-lg">*</span>
                {'\u0418\u043c\u043f\u043e\u0440\u0442 \u0438\u0437 Sheets'}
              </button>

              <button
                onClick={() => handleSync('to_sheets')}
                disabled={syncing}
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-slate-200/80 transition hover:bg-white/5 disabled:opacity-50"
              >
                <span className="text-lg">*</span>
                {'\u042d\u043a\u0441\u043f\u043e\u0440\u0442 \u0432 Sheets'}
              </button>

              <Link
                href="/settings"
                className={`flex items-center gap-3 rounded-lg px-4 py-3 transition ${
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
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-red-400 transition hover:bg-red-500/10"
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

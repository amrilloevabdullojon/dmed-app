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
  BarChart3,
  Settings,
  LogOut,
  RefreshCw,
  User,
  ChevronDown,
} from 'lucide-react'
import { Notifications } from './Notifications'
import { ThemeToggle } from './ThemeToggle'
import { toast } from 'sonner'

export function Header() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMenuOpen, setSyncMenuOpen] = useState(false)

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

    const confirmMsg = direction === 'to_sheets'
      ? '\u0421\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435 \u0441 Google Sheets?\n\n\u0412\u041d\u0418\u041c\u0410\u041d\u0418\u0415: \u0431\u0443\u0434\u0443\u0442 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u044b \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u043d\u044b\u0435 \u0437\u0430\u043f\u0438\u0441\u0438.'
      : '\u0421\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435 \u0438\u0437 Google Sheets?\n\n\u0411\u0443\u0434\u0443\u0442 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u044b \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u043d\u044b\u0435 \u0437\u0430\u043f\u0438\u0441\u0438.'

    if (!confirm(confirmMsg)) return

    setSyncing(true)
    setSyncMenuOpen(false)

    const toastId = toast.loading(
      direction === 'to_sheets' ? 'Экспорт в Google Sheets...' : 'Импорт из Google Sheets...'
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
          toast.warning(`Обработано ${count} записей. Конфликты: ${conflicts}.`, { id: toastId })
        } else {
          toast.success(`Успешно! Обработано ${count} записей`, { id: toastId })
        }
        setTimeout(() => window.location.reload(), 1500)
      } else {
        toast.error(`Ошибка: ${data.error}`, { id: toastId })
      }
    } catch (error) {
      toast.error('Ошибка синхронизации', { id: toastId })
    } finally {
      setSyncing(false)
    }
  }

  const isActive = (path: string) => pathname === path

  const navLinkClass = (path: string) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg transition ${
      isActive(path)
        ? 'bg-teal-400/15 text-teal-200 border border-teal-400/20'
        : 'text-slate-200/80 hover:bg-white/5 hover:text-white'
    }`

  return (
    <header className="app-header sticky top-0 z-50 relative backdrop-blur">
      {/* Christmas lights */}
      <div className="absolute top-0 left-0 right-0 flex justify-around pointer-events-none overflow-hidden">
        {Array.from({ length: 15 }).map((_, i) => (
          <span
            key={i}
            className={`text-xs animate-twinkle twinkle-delay-${i}`}
          >
            {['🔴', '🟢', '🟡', '🔵'][i % 4]}
          </span>
        ))}
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/30">
              <span className="text-lg">🎄</span>
            </div>
            <span className="text-xl font-bold text-white hidden sm:block">
              DMED Letters <span className="text-amber-300 text-sm">✨</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/" className={navLinkClass('/')}>
              <Home className="w-4 h-4" />
              Главная
            </Link>
            <Link href="/letters" className={navLinkClass('/letters')}>
              <FileText className="w-4 h-4" />
              Письма
            </Link>
            <Link href="/reports" className={navLinkClass('/reports')}>
              <BarChart3 className="w-4 h-4" />
              Отчёты
            </Link>

            {session?.user.role === 'ADMIN' && (
              <>
                <div className="relative">
                  <button
                    onClick={() => setSyncMenuOpen(!syncMenuOpen)}
                    disabled={syncing}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition ${
                      syncing ? 'opacity-50' : 'text-slate-200/80 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                    <span className="hidden lg:inline">
                      {syncing ? 'Синхронизация...' : 'Google Sheets'}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition ${syncMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {syncMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setSyncMenuOpen(false)}
                      />
                      <div className="absolute top-full right-0 mt-2 panel panel-glass rounded-xl shadow-xl z-50 min-w-48 animate-scaleIn origin-top-right">
                        <button
                          onClick={() => handleSync('from_sheets')}
                          disabled={syncing}
                          className="w-full flex items-center gap-2 px-4 py-3 text-slate-200/80 hover:bg-white/5 hover:text-white transition rounded-t-lg"
                        >
                          <span className="text-lg">📥</span>
                          Импорт из Sheets
                        </button>
                        <button
                          onClick={() => handleSync('to_sheets')}
                          disabled={syncing}
                          className="w-full flex items-center gap-2 px-4 py-3 text-slate-200/80 hover:bg-white/5 hover:text-white transition rounded-b-lg"
                        >
                          <span className="text-lg">📤</span>
                          Экспорт в Sheets
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <Link href="/settings" className={navLinkClass('/settings')}>
                  <Settings className="w-4 h-4" />
                  <span className="hidden lg:inline">Настройки</span>
                </Link>
              </>
            )}
          </nav>

          {/* User Menu */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            {session?.user && (
              <>
                <Notifications />
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full">
                  {session.user.image ? (
                    <Image
                      src={session.user.image}
                      alt={session.user.name || session.user.email || 'User'}
                      width={28}
                      height={28}
                      className="w-7 h-7 rounded-full"
                      unoptimized
                    />
                  ) : (
                    <User className="w-7 h-7 p-1 bg-white/10 rounded-full" />
                  )}
                  <span className="text-sm text-slate-200 hidden lg:block max-w-[120px] truncate">
                    {session.user.name || session.user.email?.split('@')[0]}
                  </span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition"
                  title="Выйти"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/* Mobile right section */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            {session?.user && <Notifications />}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile menu */}
      <div
        className={`fixed top-16 right-0 bottom-0 w-64 panel panel-glass border-l border-white/10 z-50 transform transition-transform duration-300 md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <nav className="flex flex-col p-4 gap-1">
          {/* User info */}
          {session?.user && (
            <div className="flex items-center gap-3 p-3 mb-4 bg-white/10 rounded-lg">
              {session.user.image ? (
                <Image
                  src={session.user.image}
                  alt={session.user.name || session.user.email || 'User'}
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full"
                  unoptimized
                />
              ) : (
                <User className="w-10 h-10 p-2 bg-white/10 rounded-full" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">
                  {session.user.name || session.user.email?.split('@')[0]}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {session.user.role === 'ADMIN' ? 'Администратор' : 'Сотрудник'}
                </p>
              </div>
            </div>
          )}

          <Link
            href="/"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              isActive('/') ? 'bg-teal-400/15 text-teal-200 border border-teal-400/20' : 'text-slate-200/80 hover:bg-white/5'
            }`}
          >
            <Home className="w-5 h-5" />
            Главная
          </Link>

          <Link
            href="/letters"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              isActive('/letters') ? 'bg-teal-400/15 text-teal-200 border border-teal-400/20' : 'text-slate-200/80 hover:bg-white/5'
            }`}
          >
            <FileText className="w-5 h-5" />
            Письма
          </Link>

          <Link
            href="/reports"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              isActive('/reports') ? 'bg-teal-400/15 text-teal-200 border border-teal-400/20' : 'text-slate-200/80 hover:bg-white/5'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            Отчёты
          </Link>

          {session?.user.role === 'ADMIN' && (
            <>
              <div className="my-2 border-t border-white/10" />

              <button
                onClick={() => handleSync('from_sheets')}
                disabled={syncing}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-200/80 hover:bg-white/5 transition disabled:opacity-50"
              >
                <span className="text-lg">📥</span>
                Импорт из Sheets
              </button>

              <button
                onClick={() => handleSync('to_sheets')}
                disabled={syncing}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-200/80 hover:bg-white/5 transition disabled:opacity-50"
              >
                <span className="text-lg">📤</span>
                Экспорт в Sheets
              </button>

              <Link
                href="/settings"
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  isActive('/settings') ? 'bg-teal-400/15 text-teal-200 border border-teal-400/20' : 'text-slate-200/80 hover:bg-white/5'
                }`}
              >
                <Settings className="w-5 h-5" />
                Настройки
              </Link>
            </>
          )}

          <div className="my-2 border-t border-white/10" />

          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition"
          >
            <LogOut className="w-5 h-5" />
            Выйти
          </button>
        </nav>
      </div>
    </header>
  )
}

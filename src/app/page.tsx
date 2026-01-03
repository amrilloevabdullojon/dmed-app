'use client'

import { useSession } from 'next-auth/react'
import { Header } from '@/components/Header'
import { StatusBadge } from '@/components/StatusBadge'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { StatsWidgets } from '@/components/StatsWidgets'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import {
  FileText,
  Clock,
  AlertTriangle,
  Plus,
  ArrowRight,
  Calendar,
  User,
  Star,
  TrendingUp,
  BarChart3,
} from 'lucide-react'
import { formatDate, getDaysUntilDeadline, pluralizeDays, STATUS_LABELS } from '@/lib/utils'
import type { LetterStatus } from '@prisma/client'

interface Letter {
  id: string
  number: string
  org: string
  date: string
  deadlineDate: string
  status: LetterStatus
  type: string | null
  owner: {
    name: string | null
    email: string | null
  } | null
}

interface Stats {
  total: number
  active: number
  overdue: number
  completed: number
  urgent: number
  byStatus: Record<string, number>
}

export default function HomePage() {
  const { data: session, status } = useSession()
  useAuthRedirect(status)
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentLetters, setRecentLetters] = useState<Letter[]>([])
  const [urgentLetters, setUrgentLetters] = useState<Letter[]>([])
  const [overdueLetters, setOverdueLetters] = useState<Letter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session) {
      loadDashboard()
    }
  }, [session])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      // Загрузить все данные параллельно
      const [allRes, urgentRes, overdueRes] = await Promise.all([
        fetch('/api/letters?limit=1000'),
        fetch('/api/letters?filter=urgent&limit=5'),
        fetch('/api/letters?filter=overdue&limit=5'),
      ])

      const [allData, urgentData, overdueData] = await Promise.all([
        allRes.json(),
        urgentRes.json(),
        overdueRes.json(),
      ])

      const letters = allData.letters || []
      const now = new Date()

      // Подсчёт статистики
      const byStatus: Record<string, number> = {}
      letters.forEach((l: Letter) => {
        byStatus[l.status] = (byStatus[l.status] || 0) + 1
      })

      setStats({
        total: letters.length,
        active: letters.filter(
          (l: Letter) => !['READY', 'DONE'].includes(l.status)
        ).length,
        overdue: letters.filter((l: Letter) => {
          const deadline = new Date(l.deadlineDate)
          return deadline < now && !['READY', 'DONE'].includes(l.status)
        }).length,
        completed: letters.filter((l: Letter) =>
          ['READY', 'DONE'].includes(l.status)
        ).length,
        urgent: letters.filter((l: Letter) => {
          const deadline = new Date(l.deadlineDate)
          const diff = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          return diff >= 0 && diff <= 3 && !['READY', 'DONE'].includes(l.status)
        }).length,
        byStatus,
      })

      // Последние 5 писем
      setRecentLetters(letters.slice(0, 5))
      setUrgentLetters(urgentData.letters || [])
      setOverdueLetters(overdueData.letters || [])
    } catch (error) {
      console.error('Failed to load dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen app-shell flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const completionRate = stats
    ? Math.round((stats.completed / stats.total) * 100) || 0
    : 0
  const roleLabel =
    session.user.role === 'SUPERADMIN'
      ? '\u0421\u0443\u043f\u0435\u0440\u0430\u0434\u043c\u0438\u043d'
      : session.user.role === 'ADMIN'
        ? '\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440'
        : '\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a'

  return (
    <div className="min-h-screen app-shell bg-gray-900">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Welcome */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Добро пожаловать, {session.user.name || session.user.email?.split('@')[0]}!
            </h1>
            <p className="text-gray-400 mt-1">
              {roleLabel} •{' '}
              {new Date().toLocaleDateString('ru-RU', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <Link
            href="/letters/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            Новое письмо
          </Link>
        </div>

        {/* Stats Widgets */}
        <div className="mb-8">
          <StatsWidgets />
        </div>

        {/* Progress + Status breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Progress Card */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Прогресс</h3>
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="relative pt-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Выполнено</span>
                <span className="text-sm font-semibold text-emerald-400">
                  {completionRate}%
                </span>
              </div>
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>{stats?.completed || 0} выполнено</span>
                <span>{stats?.active || 0} в работе</span>
              </div>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="lg:col-span-2 bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">По статусам</h3>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {stats?.byStatus &&
                Object.entries(stats.byStatus).map(([status, count]) => (
                  <Link
                    key={status}
                    href={`/letters?status=${status}`}
                    className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition"
                  >
                    <StatusBadge status={status as LetterStatus} size="sm" />
                    <span className="text-white font-semibold">{count}</span>
                  </Link>
                ))}
            </div>
          </div>
        </div>

        {/* Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Overdue Letters */}
          {overdueLetters.length > 0 && (
            <div className="bg-gray-800 rounded-lg border border-red-500/30">
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <h3 className="font-semibold text-white">Просроченные</h3>
                </div>
                <Link
                  href="/letters?filter=overdue"
                  className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
                >
                  Все <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="divide-y divide-gray-700">
                {overdueLetters.map((letter) => {
                  const daysOverdue = Math.abs(getDaysUntilDeadline(letter.deadlineDate))
                  return (
                    <Link
                      key={letter.id}
                      href={`/letters/${letter.id}`}
                      className="block p-4 hover:bg-gray-700/50 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-emerald-400">
                              №{letter.number}
                            </span>
                            <StatusBadge status={letter.status} size="sm" />
                          </div>
                          <p className="text-white mt-1 line-clamp-1">{letter.org}</p>
                        </div>
                        <span className="text-xs text-red-400 whitespace-nowrap">
                          {daysOverdue} {pluralizeDays(daysOverdue)} просрочено
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Urgent Letters */}
          {urgentLetters.length > 0 && (
            <div className="bg-gray-800 rounded-lg border border-yellow-500/30">
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  <h3 className="font-semibold text-white">Срочные (3 дня)</h3>
                </div>
                <Link
                  href="/letters?filter=urgent"
                  className="text-sm text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
                >
                  Все <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="divide-y divide-gray-700">
                {urgentLetters.map((letter) => {
                  const daysLeft = getDaysUntilDeadline(letter.deadlineDate)
                  return (
                    <Link
                      key={letter.id}
                      href={`/letters/${letter.id}`}
                      className="block p-4 hover:bg-gray-700/50 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-emerald-400">
                              №{letter.number}
                            </span>
                            <StatusBadge status={letter.status} size="sm" />
                          </div>
                          <p className="text-white mt-1 line-clamp-1">{letter.org}</p>
                        </div>
                        <span className="text-xs text-yellow-400 whitespace-nowrap">
                          {daysLeft} {pluralizeDays(daysLeft)}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent Letters */}
          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                <h3 className="font-semibold text-white">Последние письма</h3>
              </div>
              <Link
                href="/letters"
                className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                Все <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-gray-700">
              {recentLetters.map((letter) => (
                <Link
                  key={letter.id}
                  href={`/letters/${letter.id}`}
                  className="block p-4 hover:bg-gray-700/50 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-emerald-400">
                          №{letter.number}
                        </span>
                        <StatusBadge status={letter.status} size="sm" />
                      </div>
                      <p className="text-white mt-1 line-clamp-1">{letter.org}</p>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(letter.date)}
                    </span>
                  </div>
                </Link>
              ))}
              {recentLetters.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  Нет писем
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="font-semibold text-white mb-4">Быстрые действия</h3>
            <div className="space-y-3">
              <Link
                href="/letters/new"
                className="flex items-center gap-3 p-3 bg-emerald-500/20 rounded-lg hover:bg-emerald-500/30 transition group"
              >
                <div className="p-2 bg-emerald-500/20 rounded-lg group-hover:bg-emerald-500/30 transition">
                  <Plus className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Новое письмо</p>
                  <p className="text-sm text-gray-400">Добавить входящее</p>
                </div>
              </Link>

              <Link
                href="/letters?status=NOT_REVIEWED"
                className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition group"
              >
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <Clock className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Не рассмотренные</p>
                  <p className="text-sm text-gray-400">Требуют внимания</p>
                </div>
              </Link>

              <Link
                href="/letters?filter=favorites"
                className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition group"
              >
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <Star className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Избранное</p>
                  <p className="text-sm text-gray-400">Отмеченные письма</p>
                </div>
              </Link>

              {(session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN') && (
                <Link
                  href="/reports"
                  className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition group"
                >
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Отчёты</p>
                    <p className="text-sm text-gray-400">Аналитика и статистика</p>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

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
  Inbox,
  Activity,
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

interface Request {
  id: string
  organization: string
  contactName: string
  status: string
  priority: string
  createdAt: string
}

export default function HomePage() {
  const { data: session, status } = useSession()
  useAuthRedirect(status)
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentLetters, setRecentLetters] = useState<Letter[]>([])
  const [urgentLetters, setUrgentLetters] = useState<Letter[]>([])
  const [overdueLetters, setOverdueLetters] = useState<Letter[]>([])
  const [recentRequests, setRecentRequests] = useState<Request[]>([])
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
      const [allRes, urgentRes, overdueRes, requestsRes] = await Promise.all([
        fetch('/api/letters?limit=1000'),
        fetch('/api/letters?filter=urgent&limit=5'),
        fetch('/api/letters?filter=overdue&limit=5'),
        fetch('/api/requests?limit=5&status=NEW,IN_REVIEW'),
      ])

      const [allData, urgentData, overdueData, requestsData] = await Promise.all([
        allRes.json(),
        urgentRes.json(),
        overdueRes.json(),
        requestsRes.json(),
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
        active: letters.filter((l: Letter) => !['READY', 'DONE'].includes(l.status)).length,
        overdue: letters.filter((l: Letter) => {
          const deadline = new Date(l.deadlineDate)
          return deadline < now && !['READY', 'DONE'].includes(l.status)
        }).length,
        completed: letters.filter((l: Letter) => ['READY', 'DONE'].includes(l.status)).length,
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
      setRecentRequests(requestsData.requests || [])
    } catch (error) {
      console.error('Failed to load dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center bg-gray-900">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-emerald-500"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const completionRate = stats ? Math.round((stats.completed / stats.total) * 100) || 0 : 0
  const roleLabel =
    session.user.role === 'SUPERADMIN'
      ? '\u0421\u0443\u043f\u0435\u0440\u0430\u0434\u043c\u0438\u043d'
      : session.user.role === 'ADMIN'
        ? '\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440'
        : '\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a'

  return (
    <div className="app-shell min-h-screen">
      <Header />

      <main className="animate-pageIn mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Welcome */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">
              Добро пожаловать, {session.user.name || session.user.email?.split('@')[0]}!
            </h1>
            <p className="text-muted mt-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-teal-400/20 bg-teal-500/15 px-2 py-0.5 text-xs text-teal-300">
                {roleLabel}
              </span>
              <span className="text-slate-500">•</span>
              {new Date().toLocaleDateString('ru-RU', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/letters/new"
              className="btn-primary inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 transition"
            >
              <Plus className="h-5 w-5" />
              Новое письмо
            </Link>
            <Link
              href="/request"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-white transition hover:bg-white/20"
            >
              <Inbox className="h-5 w-5" />
              Подать заявку
            </Link>
          </div>
        </div>

        {/* Stats Widgets */}
        <div className="mb-8">
          <StatsWidgets />
        </div>

        {/* Progress + Status breakdown */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Progress Card */}
          <div className="panel panel-glass rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-white">Прогресс</h3>
              <TrendingUp className="h-5 w-5 text-teal-400" />
            </div>
            <div className="relative pt-1">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-slate-400">Выполнено</span>
                <span className="text-sm font-semibold text-teal-400">{completionRate}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>{stats?.completed || 0} выполнено</span>
                <span>{stats?.active || 0} в работе</span>
              </div>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="panel panel-glass rounded-2xl p-6 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-white">По статусам</h3>
              <BarChart3 className="h-5 w-5 text-slate-400" />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {stats?.byStatus &&
                Object.entries(stats.byStatus).map(([status, count]) => (
                  <Link
                    key={status}
                    href={`/letters?status=${status}`}
                    className="panel-soft panel-glass flex items-center justify-between rounded-xl p-3 transition hover:bg-white/10"
                  >
                    <StatusBadge status={status as LetterStatus} size="sm" />
                    <span className="font-semibold text-white">{count}</span>
                  </Link>
                ))}
            </div>
          </div>
        </div>

        {/* Lists */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Overdue Letters */}
          {overdueLetters.length > 0 && (
            <div className="panel panel-glass rounded-2xl border-l-4 border-l-red-500">
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <h3 className="font-semibold text-white">Просроченные</h3>
                </div>
                <Link
                  href="/letters?filter=overdue"
                  className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300"
                >
                  Все <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="divide-y divide-white/5">
                {overdueLetters.map((letter) => {
                  const daysOverdue = Math.abs(getDaysUntilDeadline(letter.deadlineDate))
                  return (
                    <Link
                      key={letter.id}
                      href={`/letters/${letter.id}`}
                      className="block p-4 transition hover:bg-white/5"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-teal-400">
                              №{letter.number}
                            </span>
                            <StatusBadge status={letter.status} size="sm" />
                          </div>
                          <p className="mt-1 line-clamp-1 text-white">{letter.org}</p>
                        </div>
                        <span className="whitespace-nowrap text-xs text-red-400">
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
            <div className="panel panel-glass rounded-2xl border-l-4 border-l-amber-500">
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-400" />
                  <h3 className="font-semibold text-white">Срочные (3 дня)</h3>
                </div>
                <Link
                  href="/letters?filter=urgent"
                  className="flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300"
                >
                  Все <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="divide-y divide-white/5">
                {urgentLetters.map((letter) => {
                  const daysLeft = getDaysUntilDeadline(letter.deadlineDate)
                  return (
                    <Link
                      key={letter.id}
                      href={`/letters/${letter.id}`}
                      className="block p-4 transition hover:bg-white/5"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-teal-400">
                              №{letter.number}
                            </span>
                            <StatusBadge status={letter.status} size="sm" />
                          </div>
                          <p className="mt-1 line-clamp-1 text-white">{letter.org}</p>
                        </div>
                        <span className="whitespace-nowrap text-xs text-amber-400">
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
          <div className="panel panel-glass rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-400" />
                <h3 className="font-semibold text-white">Последние письма</h3>
              </div>
              <Link
                href="/letters"
                className="flex items-center gap-1 text-sm text-teal-400 hover:text-teal-300"
              >
                Все <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="divide-y divide-white/5">
              {recentLetters.map((letter) => (
                <Link
                  key={letter.id}
                  href={`/letters/${letter.id}`}
                  className="block p-4 transition hover:bg-white/5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-teal-400">№{letter.number}</span>
                        <StatusBadge status={letter.status} size="sm" />
                      </div>
                      <p className="mt-1 line-clamp-1 text-white">{letter.org}</p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-slate-500">
                      {formatDate(letter.date)}
                    </span>
                  </div>
                </Link>
              ))}
              {recentLetters.length === 0 && (
                <div className="p-8 text-center text-slate-500">Нет писем</div>
              )}
            </div>
          </div>

          {/* Recent Requests */}
          <div className="panel panel-glass rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div className="flex items-center gap-2">
                <Inbox className="h-5 w-5 text-emerald-400" />
                <h3 className="font-semibold text-white">Активные заявки</h3>
              </div>
              <Link
                href="/requests"
                className="flex items-center gap-1 text-sm text-teal-400 hover:text-teal-300"
              >
                Все <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="divide-y divide-white/5">
              {recentRequests.map((request) => (
                <Link
                  key={request.id}
                  href={`/requests/${request.id}`}
                  className="block p-4 transition hover:bg-white/5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="line-clamp-1 font-medium text-white">{request.organization}</p>
                      <p className="mt-1 text-sm text-slate-400">{request.contactName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          request.status === 'NEW'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {request.status === 'NEW' ? 'Новая' : 'В работе'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDate(request.createdAt)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
              {recentRequests.length === 0 && (
                <div className="p-8 text-center text-slate-500">Нет активных заявок</div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="panel panel-glass rounded-2xl p-6 lg:col-span-2">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-white">
              <Activity className="h-5 w-5 text-teal-400" />
              Быстрые действия
            </h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Link
                href="/letters/new"
                className="panel-soft panel-glass group flex items-center gap-3 rounded-xl p-4 transition hover:bg-white/10"
              >
                <div className="rounded-lg bg-teal-500/20 p-2">
                  <Plus className="h-5 w-5 text-teal-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Новое письмо</p>
                  <p className="text-xs text-slate-400">Добавить входящее</p>
                </div>
              </Link>

              <Link
                href="/request"
                className="panel-soft panel-glass group flex items-center gap-3 rounded-xl p-4 transition hover:bg-white/10"
              >
                <div className="rounded-lg bg-emerald-500/20 p-2">
                  <Inbox className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Подать заявку</p>
                  <p className="text-xs text-slate-400">Новое обращение</p>
                </div>
              </Link>

              <Link
                href="/letters?status=NOT_REVIEWED"
                className="panel-soft panel-glass group flex items-center gap-3 rounded-xl p-4 transition hover:bg-white/10"
              >
                <div className="rounded-lg bg-amber-500/20 p-2">
                  <Clock className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Не рассмотренные</p>
                  <p className="text-xs text-slate-400">Требуют внимания</p>
                </div>
              </Link>

              <Link
                href="/letters?filter=favorites"
                className="panel-soft panel-glass group flex items-center gap-3 rounded-xl p-4 transition hover:bg-white/10"
              >
                <div className="rounded-lg bg-yellow-500/20 p-2">
                  <Star className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Избранное</p>
                  <p className="text-xs text-slate-400">Отмеченные письма</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

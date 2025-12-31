'use client'

import { useSession } from 'next-auth/react'
import { Header } from '@/components/Header'
import { useEffect, useState } from 'react'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/utils'
import type { LetterStatus } from '@prisma/client'
import {
  Loader2,
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle,
  TrendingUp,
  Users,
  Calendar,
  Timer,
  RefreshCw,
} from 'lucide-react'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'

interface Stats {
  summary: {
    total: number
    overdue: number
    urgent: number
    done: number
    inProgress: number
    monthNew: number
    monthDone: number
    avgDays: number
  }
  byStatus: Record<LetterStatus, number>
  byOwner: Array<{ id: string; name: string; count: number }>
  byType: Array<{ type: string; count: number }>
  monthly: Array<{ month: string; created: number; done: number }>
}

const STATUS_CHART_COLORS: Record<LetterStatus, string> = {
  NOT_REVIEWED: '#6b7280',
  ACCEPTED: '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  CLARIFICATION: '#8b5cf6',
  READY: '#22c55e',
  DONE: '#10b981',
}

export default function ReportsPage() {
  const { data: session, status: authStatus } = useSession()
  useAuthRedirect(authStatus)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showAllOwners, setShowAllOwners] = useState(false)
  const [showAllTypes, setShowAllTypes] = useState(false)

  useEffect(() => {
    if (session) {
      loadStats()
    }
  }, [session])

  const loadStats = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const res = await fetch('/api/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    await loadStats(false)
    setRefreshing(false)
  }
  if (authStatus === 'loading' || (authStatus === 'authenticated' && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!session || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-gray-400">Пожалуйста, войдите в систему</p>
      </div>
    )
  }

  const maxMonthly = Math.max(
    ...stats.monthly.flatMap((m) => [m.created, m.done]),
    1
  )

  const totalStatusCount = Object.values(stats.byStatus).reduce((a, b) => a + b, 0)
  const ownersLimit = 10
  const typesLimit = 12
  const ownersToShow = showAllOwners ? stats.byOwner : stats.byOwner.slice(0, ownersLimit)
  const typesToShow = showAllTypes ? stats.byType : stats.byType.slice(0, typesLimit)

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {'\u041e\u0442\u0447\u0451\u0442\u044b \u0438 \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430'}
            </h1>
            {lastUpdated && (
              <p className="text-sm text-gray-400 mt-1">
                {'\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e'}: {lastUpdated.toLocaleString('ru-RU')}
              </p>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white hover:bg-gray-700 transition disabled:opacity-50 w-full sm:w-auto"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {'\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c'}
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 sm:p-4">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              <span className="text-gray-400 text-sm">Всего писем</span>
            </div>
            <div className="text-3xl font-bold text-white">{stats.summary.total}</div>
          </div>

          <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 sm:p-4">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-gray-400 text-sm">Просроченных</span>
            </div>
            <div className="text-3xl font-bold text-red-400">{stats.summary.overdue}</div>
          </div>

          <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 sm:p-4">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              <span className="text-gray-400 text-sm">Срочных (3 дня)</span>
            </div>
            <div className="text-3xl font-bold text-yellow-400">{stats.summary.urgent}</div>
          </div>

          <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 sm:p-4">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="text-gray-400 text-sm">Выполнено</span>
            </div>
            <div className="text-3xl font-bold text-emerald-400">{stats.summary.done}</div>
          </div>
        </div>

        {/* Second Row of Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 sm:p-4">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <span className="text-gray-400 text-sm">В работе</span>
            </div>
            <div className="text-3xl font-bold text-blue-400">{stats.summary.inProgress}</div>
          </div>

          <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 sm:p-4">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-purple-400" />
              <span className="text-gray-400 text-sm">Новых за месяц</span>
            </div>
            <div className="text-3xl font-bold text-purple-400">{stats.summary.monthNew}</div>
          </div>

          <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 sm:p-4">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-gray-400 text-sm">Закрыто за месяц</span>
            </div>
            <div className="text-3xl font-bold text-green-400">{stats.summary.monthDone}</div>
          </div>

          <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 sm:p-4">
            <div className="flex items-center gap-3 mb-2">
              <Timer className="w-5 h-5 text-orange-400" />
              <span className="text-gray-400 text-sm">Среднее время (дней)</span>
            </div>
            <div className="text-3xl font-bold text-orange-400">{stats.summary.avgDays}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Status Distribution */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Распределение по статусам</h3>

            {/* Pie Chart representation using bars */}
            <div className="space-y-3">
              {(Object.keys(stats.byStatus) as LetterStatus[]).map((status) => {
                const count = stats.byStatus[status]
                const percentage = totalStatusCount > 0 ? (count / totalStatusCount) * 100 : 0

                return (
                  <div key={status} className="flex items-center gap-3">
                    <div className="w-24 text-sm text-gray-400 truncate">
                      {STATUS_LABELS[status]}
                    </div>
                    <div className="flex-1 h-6 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: STATUS_CHART_COLORS[status],
                        }}
                      />
                    </div>
                    <div className="w-16 text-right">
                      <span className="text-white font-medium">{count}</span>
                      <span className="text-gray-500 text-sm ml-1">
                        ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-700">
              {(Object.keys(stats.byStatus) as LetterStatus[]).map((status) => (
                <div key={status} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: STATUS_CHART_COLORS[status] }}
                  />
                  <span className="text-xs text-gray-400">{STATUS_LABELS[status]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By Owner */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">По ответственным</h3>

            {stats.byOwner.length > 0 ? (
              <div className="space-y-3">
                {ownersToShow.map((owner, index) => {
                  const maxCount = stats.byOwner[0]?.count || 1
                  const percentage = (owner.count / maxCount) * 100

                  return (
                    <div key={owner.id} className="flex items-center gap-3">
                      <div className="w-6 text-gray-500 text-sm">{index + 1}.</div>
                      <div className="w-32 text-sm text-gray-300 truncate">{owner.name}</div>
                      <div className="flex-1 h-5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="w-10 text-right text-white font-medium">{owner.count}</div>
                    </div>
                  )
                })}
                {stats.byOwner.length > ownersLimit && (
                  <button
                    onClick={() => setShowAllOwners((prev) => !prev)}
                    className="text-sm text-emerald-400 hover:text-emerald-300 transition"
                  >
                    {showAllOwners
                      ? '\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c'
                      : '\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0432\u0441\u0435'}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Нет данных</p>
            )}
          </div>
        </div>

        {/* Monthly Chart */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Динамика за год</h3>

          <div className="flex items-end gap-2 h-64">
            {stats.monthly.map((month, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex-1 w-full flex items-end gap-1">
                  {/* Created bar */}
                  <div className="flex-1 flex flex-col justify-end">
                    <div
                      className="w-full bg-blue-500 rounded-t transition-all duration-500"
                      style={{
                        height: `${(month.created / maxMonthly) * 100}%`,
                        minHeight: month.created > 0 ? '8px' : '0',
                      }}
                    />
                  </div>
                  {/* Done bar */}
                  <div className="flex-1 flex flex-col justify-end">
                    <div
                      className="w-full bg-emerald-500 rounded-t transition-all duration-500"
                      style={{
                        height: `${(month.done / maxMonthly) * 100}%`,
                        minHeight: month.done > 0 ? '8px' : '0',
                      }}
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2">{month.month}</div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded" />
              <span className="text-sm text-gray-400">Создано</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-500 rounded" />
              <span className="text-sm text-gray-400">Закрыто</span>
            </div>
          </div>
        </div>

        {/* By Type */}
        {stats.byType.length > 0 && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">По типам запросов</h3>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {typesToShow.map((item) => (
                <div
                  key={item.type}
                  className="bg-gray-700/50 rounded-lg p-4 text-center"
                >
                  <div className="text-2xl font-bold text-white mb-1">{item.count}</div>
                  <div className="text-sm text-gray-400 truncate">{item.type}</div>
                </div>
              ))}
            </div>

            {stats.byType.length > typesLimit && (
              <button
                onClick={() => setShowAllTypes((prev) => !prev)}
                className="mt-4 text-sm text-emerald-400 hover:text-emerald-300 transition"
              >
                {showAllTypes
                  ? '\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c'
                  : '\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0432\u0441\u0435'}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

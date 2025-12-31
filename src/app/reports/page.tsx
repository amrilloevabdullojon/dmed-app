'use client'

import { useSession } from 'next-auth/react'
import { Header } from '@/components/Header'
import { useEffect, useMemo, useState } from 'react'
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
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Filter,
  Layers,
  Download,
  Share2,
  Save,
} from 'lucide-react'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { toast } from 'sonner'

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
  const [showAllTypes, setShowAllTypes] = useState(false)
  const [periodMonths, setPeriodMonths] = useState(6)
  const [chartView, setChartView] = useState<'status' | 'owner' | 'type'>('status')
  const [ownerSort, setOwnerSort] = useState<'count' | 'name'>('count')
  const [ownerSortDir, setOwnerSortDir] = useState<'asc' | 'desc'>('desc')
  const [ownerPage, setOwnerPage] = useState(1)

  const applyView = (view: {
    periodMonths?: number
    chartView?: 'status' | 'owner' | 'type'
    ownerSort?: 'count' | 'name'
    ownerSortDir?: 'asc' | 'desc'
  }) => {
    if (view.periodMonths && [3, 6, 12].includes(view.periodMonths)) {
      setPeriodMonths(view.periodMonths)
    }
    if (view.chartView) {
      setChartView(view.chartView)
    }
    if (view.ownerSort) {
      setOwnerSort(view.ownerSort)
    }
    if (view.ownerSortDir) {
      setOwnerSortDir(view.ownerSortDir)
    }
  }

  useEffect(() => {
    if (session) {
      loadStats()
    }
  }, [session])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const urlView = {
      periodMonths: Number(params.get('period') || 0),
      chartView: params.get('chart') as 'status' | 'owner' | 'type' | null,
    }

    if ([3, 6, 12].includes(urlView.periodMonths) || urlView.chartView) {
      applyView({
        periodMonths: [3, 6, 12].includes(urlView.periodMonths) ? urlView.periodMonths : undefined,
        chartView: urlView.chartView || undefined,
      })
      return
    }

    const saved = window.localStorage.getItem('reportsView')
    if (saved) {
      try {
        applyView(JSON.parse(saved))
      } catch {
        window.localStorage.removeItem('reportsView')
      }
    }
  }, [])

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

  const handleResetView = () => {
    setPeriodMonths(6)
    setChartView('status')
    setOwnerSort('count')
    setOwnerSortDir('desc')
    setOwnerPage(1)
    setShowAllTypes(false)
  }

  const handleSaveView = () => {
    if (typeof window === 'undefined') return
    const payload = {
      periodMonths,
      chartView,
      ownerSort,
      ownerSortDir,
    }
    window.localStorage.setItem('reportsView', JSON.stringify(payload))
    toast.success('\u0412\u0438\u0434 \u043e\u0442\u0447\u0451\u0442\u043e\u0432 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d')
  }

  const handleShare = async () => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('period', String(periodMonths))
    url.searchParams.set('chart', chartView)
    try {
      await navigator.clipboard.writeText(url.toString())
      toast.success('\u0421\u0441\u044b\u043b\u043a\u0430 \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0430')
    } catch (error) {
      console.error('Failed to copy link', error)
      toast.error('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0441\u0441\u044b\u043b\u043a\u0443')
    }
  }

  const handleExport = () => {
    if (!stats) return
    const rows: string[][] = [
      ['Metric', 'Value'],
      ['Total', String(stats.summary.total)],
      ['Overdue', String(stats.summary.overdue)],
      ['Urgent', String(stats.summary.urgent)],
      ['Done', String(stats.summary.done)],
      ['In progress', String(stats.summary.inProgress)],
      ['Month new', String(stats.summary.monthNew)],
      ['Month done', String(stats.summary.monthDone)],
      ['Average days', String(stats.summary.avgDays)],
      [],
      ['Month', 'Created', 'Done'],
      ...periodMonthly.map((m) => [m.month, String(m.created), String(m.done)]),
      [],
      ['Owner', 'Count'],
      ...stats.byOwner.map((o) => [o.name, String(o.count)]),
      [],
      ['Type', 'Count'],
      ...stats.byType.map((t) => [t.type, String(t.count)]),
    ]

    const csv = rows.map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reports-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleOwnerSort = (field: 'count' | 'name') => {
    if (ownerSort === field) {
      setOwnerSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setOwnerSort(field)
      setOwnerSortDir(field === 'name' ? 'asc' : 'desc')
    }
    setOwnerPage(1)
  }

  const handleMoreOwners = () => {
    setOwnerPage((prev) => prev + 1)
  }

  const handleCollapseOwners = () => {
    setOwnerPage(1)
  }

  const periodOptions = [3, 6, 12]

  const periodMonthly = useMemo(() => {
    if (!stats) return []
    return stats.monthly.slice(-periodMonths)
  }, [stats, periodMonths])

  const prevMonthly = useMemo(() => {
    if (!stats) return []
    return stats.monthly.slice(-(periodMonths * 2), -periodMonths)
  }, [stats, periodMonths])

  const sumBy = (items: Array<{ created: number; done: number }>, key: 'created' | 'done') =>
    items.reduce((acc, item) => acc + item[key], 0)

  const periodCreated = sumBy(periodMonthly, 'created')
  const periodDone = sumBy(periodMonthly, 'done')
  const prevCreated = prevMonthly.length > 0 ? sumBy(prevMonthly, 'created') : null
  const prevDone = prevMonthly.length > 0 ? sumBy(prevMonthly, 'done') : null

  const getTrend = (
    current: number,
    previous: number | null
  ): { direction: 'up' | 'down' | 'flat'; label: string } => {
    if (previous === null) return { direction: 'flat', label: '\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445' }
    if (previous === 0) {
      return current === 0
        ? { direction: 'flat', label: '0%' }
        : { direction: 'up', label: '+100%' }
    }
    const diff = current - previous
    const pct = Math.round((diff / previous) * 100)
    const sign = diff > 0 ? '+' : diff < 0 ? '-' : ''
    return { direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat', label: `${sign}${Math.abs(pct)}%` }
  }

  const createdTrend = getTrend(periodCreated, prevCreated)
  const doneTrend = getTrend(periodDone, prevDone)
  const avgPerMonth = periodMonthly.length > 0 ? Math.round(periodCreated / periodMonthly.length) : 0
  const prevAvgPerMonth =
    prevMonthly.length > 0 ? Math.round(sumBy(prevMonthly, 'created') / prevMonthly.length) : null
  const avgTrend = getTrend(avgPerMonth, prevAvgPerMonth)

  const ownersSorted = useMemo(() => {
    if (!stats) return []
    const list = [...stats.byOwner]
    list.sort((a, b) => {
      if (ownerSort === 'name') {
        return ownerSortDir === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name)
      }
      return ownerSortDir === 'asc' ? a.count - b.count : b.count - a.count
    })
    return list
  }, [stats, ownerSort, ownerSortDir])

  const ownersByCount = useMemo(() => {
    if (!stats) return []
    return [...stats.byOwner].sort((a, b) => b.count - a.count)
  }, [stats])

  const typesChart = useMemo(() => {
    if (!stats) return []
    return [...stats.byType].sort((a, b) => b.count - a.count).slice(0, 6)
  }, [stats])

  const ownerPageSize = 8
  const ownersToShow = ownersSorted.slice(0, ownerPage * ownerPageSize)
  const ownersChart = ownersByCount.slice(0, 6)
  const hasMoreOwners = ownersToShow.length < ownersSorted.length
  const canCollapseOwners = ownerPage > 1

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center app-shell">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center app-shell">
        <p className="text-gray-400">
          {'\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0432\u043e\u0439\u0434\u0438\u0442\u0435 \u0432 \u0441\u0438\u0441\u0442\u0435\u043c\u0443'}
        </p>
      </div>
    )
  }

  const isInitialLoading = loading && !stats
  if (isInitialLoading) {
    return (
      <div className="min-h-screen app-shell">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
          <div className="h-16 rounded-2xl bg-white/5 animate-shimmer" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-white/5 animate-shimmer" />
            ))}
          </div>
          <div className="h-40 rounded-2xl bg-white/5 animate-shimmer" />
          <div className="h-64 rounded-2xl bg-white/5 animate-shimmer" />
        </main>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center app-shell">
        <p className="text-gray-400">{'\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445.'}</p>
      </div>
    )
  }

  const maxMonthly = Math.max(
    ...periodMonthly.flatMap((m) => [m.created, m.done]),
    1
  )

  const totalStatusCount = Object.values(stats.byStatus).reduce((a, b) => a + b, 0)
  const typesLimit = 12
  const typesToShow = showAllTypes ? stats.byType : stats.byType.slice(0, typesLimit)
  const maxOwnerCount = ownersByCount[0]?.count || 1
  const maxTypeCount = typesChart[0]?.count || 1
  const totalOwnerCount = ownersByCount.reduce((acc, owner) => acc + owner.count, 0)

  const renderTrend = (trend: { direction: 'up' | 'down' | 'flat'; label: string }) => {
    if (trend.direction === 'up') {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
          <ArrowUpRight className="w-3.5 h-3.5" />
          {trend.label}
        </span>
      )
    }
    if (trend.direction === 'down') {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-red-300">
          <ArrowDownRight className="w-3.5 h-3.5" />
          {trend.label}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
        <Minus className="w-3.5 h-3.5" />
        {trend.label}
      </span>
    )
  }

  const SortIcon = ownerSortDir === 'asc' ? ArrowUpRight : ArrowDownRight

  return (
    <div className="min-h-screen app-shell">
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

        <div className="panel panel-glass rounded-2xl p-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400 uppercase tracking-wide">
                {'\u041f\u0435\u0440\u0438\u043e\u0434'}
              </span>
              {periodOptions.map((months) => (
                <button
                  key={months}
                  onClick={() => setPeriodMonths(months)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition app-chip ${
                    periodMonths === months ? 'app-chip-active' : ''
                  }`}
                  aria-label={`\u041f\u0435\u0440\u0438\u043e\u0434 ${months} \u043c\u0435\u0441\u044f\u0446\u0435\u0432`}
                >
                  <Calendar className="w-4 h-4" />
                  {months} {'\u043c\u0435\u0441'}
                </button>
              ))}
              <button
                onClick={handleResetView}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition btn-ghost"
                aria-label="Reset report view"
              >
                <RefreshCw className="w-4 h-4" />
                {'\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c'}
              </button>
              <button
                onClick={handleSaveView}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition btn-secondary"
                aria-label="Save report view"
              >
                <Save className="w-4 h-4" />
                {'\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0432\u0438\u0434'}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExport}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition btn-secondary w-full sm:w-auto"
              >
                <Download className="w-4 h-4" />
                {'\u042d\u043a\u0441\u043f\u043e\u0440\u0442 CSV'}
              </button>
              <button
                onClick={handleShare}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition btn-primary w-full sm:w-auto"
              >
                <Share2 className="w-4 h-4" />
                {'\u041f\u043e\u0434\u0435\u043b\u0438\u0442\u044c\u0441\u044f'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="panel panel-soft rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              <span className="text-gray-400 text-sm">{'\u0412\u0441\u0435 \u043f\u0438\u0441\u044c\u043c\u0430'}</span>
            </div>
            <div className="text-3xl font-bold text-white">{stats.summary.total}</div>
          </div>

          <div className="panel panel-soft rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-gray-400 text-sm">{'\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043d\u044b\u0435'}</span>
            </div>
            <div className="text-3xl font-bold text-red-400">{stats.summary.overdue}</div>
          </div>

          <div className="panel panel-soft rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              <span className="text-gray-400 text-sm">{'\u0421\u0440\u043e\u0447\u043d\u044b\u0435 (3 \u0434\u043d\u044f)'}</span>
            </div>
            <div className="text-3xl font-bold text-yellow-400">{stats.summary.urgent}</div>
          </div>

          <div className="panel panel-soft rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <span className="text-gray-400 text-sm">{'\u0412 \u0440\u0430\u0431\u043e\u0442\u0435'}</span>
            </div>
            <div className="text-3xl font-bold text-blue-400">{stats.summary.inProgress}</div>
          </div>

          <div className="panel panel-soft rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="text-gray-400 text-sm">{'\u0412\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e'}</span>
            </div>
            <div className="text-3xl font-bold text-emerald-400">{stats.summary.done}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="panel panel-soft rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-purple-400" />
                <span className="text-gray-400 text-sm">{'\u0421\u043e\u0437\u0434\u0430\u043d\u043e \u0437\u0430'} {periodMonths} {'\u043c\u0435\u0441'}</span>
              </div>
              {renderTrend(createdTrend)}
            </div>
            <div className="text-3xl font-bold text-purple-400">{periodCreated}</div>
          </div>

          <div className="panel panel-soft rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span className="text-gray-400 text-sm">{'\u0417\u0430\u043a\u0440\u044b\u0442\u043e \u0437\u0430'} {periodMonths} {'\u043c\u0435\u0441'}</span>
              </div>
              {renderTrend(doneTrend)}
            </div>
            <div className="text-3xl font-bold text-emerald-400">{periodDone}</div>
          </div>

          <div className="panel panel-soft rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-400" />
                <span className="text-gray-400 text-sm">{'\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0432 \u043c\u0435\u0441\u044f\u0446'}</span>
              </div>
              {renderTrend(avgTrend)}
            </div>
            <div className="text-3xl font-bold text-blue-400">{avgPerMonth}</div>
          </div>

          <div className="panel panel-soft rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <Timer className="w-5 h-5 text-orange-400" />
              <span className="text-gray-400 text-sm">{'\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0432\u0440\u0435\u043c\u044f \u0434\u043e \u0437\u0430\u043a\u0440\u044b\u0442\u0438\u044f'}</span>
            </div>
            <div className="text-3xl font-bold text-orange-400">{stats.summary.avgDays}</div>
          </div>
        </div>

        <div className="panel panel-solid rounded-2xl p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">{'\u0420\u0430\u0441\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u0438\u0435'}</h3>
              <p className="text-sm text-gray-400">{'\u041f\u0438\u0441\u044c\u043c\u0430 \u043f\u043e \u0441\u0442\u0430\u0442\u0443\u0441\u0430\u043c, \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044f\u043c \u0438 \u0442\u0438\u043f\u0430\u043c'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setChartView('status')}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition app-chip ${
                  chartView === 'status' ? 'app-chip-active' : ''
                }`}
              >
                <Filter className="w-4 h-4" />
                {'\u0421\u0442\u0430\u0442\u0443\u0441\u044b'}
              </button>
              <button
                onClick={() => setChartView('owner')}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition app-chip ${
                  chartView === 'owner' ? 'app-chip-active' : ''
                }`}
              >
                <Users className="w-4 h-4" />
                {'\u0418\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u0438'}
              </button>
              <button
                onClick={() => setChartView('type')}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition app-chip ${
                  chartView === 'type' ? 'app-chip-active' : ''
                }`}
              >
                <Layers className="w-4 h-4" />
                {'\u0422\u0438\u043f\u044b'}
              </button>
            </div>
          </div>

          {chartView === 'status' && (
            <>
              {totalStatusCount > 0 ? (
                <>
                  <div className="space-y-3">
                    {(Object.keys(stats.byStatus) as LetterStatus[]).map((status) => {
                      const count = stats.byStatus[status]
                      const percentage = totalStatusCount > 0 ? (count / totalStatusCount) * 100 : 0

                      return (
                        <div key={status} className="flex items-center gap-3">
                          <div className="w-28 text-sm text-gray-400 truncate">
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
                            <span className="text-gray-500 text-sm ml-1">({percentage.toFixed(0)}%)</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

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
                </>
              ) : (
                <p className="text-sm text-gray-500 py-6">{'\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445.'}</p>
              )}
            </>
          )}

          {chartView === 'owner' && (
            <>
              {ownersChart.length > 0 ? (
                <div className="space-y-3">
                  {ownersChart.map((owner, index) => {
                    const percentage = maxOwnerCount > 0 ? (owner.count / maxOwnerCount) * 100 : 0
                    return (
                      <div key={owner.id} className="flex items-center gap-3">
                        <div className="w-6 text-gray-500 text-sm">{index + 1}.</div>
                        <div className="w-36 text-sm text-gray-300 truncate">{owner.name}</div>
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
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-6">{'\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445.'}</p>
              )}
            </>
          )}

          {chartView === 'type' && (
            <>
              {typesChart.length > 0 ? (
                <div className="space-y-3">
                  {typesChart.map((item) => {
                    const percentage = maxTypeCount > 0 ? (item.count / maxTypeCount) * 100 : 0
                    return (
                      <div key={item.type} className="flex items-center gap-3">
                        <div className="w-40 text-sm text-gray-300 truncate">{item.type}</div>
                        <div className="flex-1 h-5 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-500 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="w-10 text-right text-white font-medium">{item.count}</div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-6">{'\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445.'}</p>
              )}
            </>
          )}
        </div>

        <div className="panel panel-solid rounded-2xl p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">{'\u0410\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u044c \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u0435\u0439'}</h3>
              <p className="text-sm text-gray-400">{'\u0421\u043e\u0440\u0442\u0438\u0440\u0443\u0439\u0442\u0435 \u0438 \u043f\u0440\u043e\u043b\u0438\u0441\u0442\u044b\u0432\u0430\u0439\u0442\u0435 \u0442\u043e\u043f'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleOwnerSort('count')}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition app-chip ${
                  ownerSort === 'count' ? 'app-chip-active' : ''
                }`}
              >
                <Filter className="w-4 h-4" />
                {'\u041f\u043e \u043e\u0431\u044a\u0435\u043c\u0443'}
                {ownerSort === 'count' && <SortIcon className="w-4 h-4" />}
              </button>
              <button
                onClick={() => handleOwnerSort('name')}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition app-chip ${
                  ownerSort === 'name' ? 'app-chip-active' : ''
                }`}
              >
                <Users className="w-4 h-4" />
                {'\u041f\u043e \u0438\u043c\u0435\u043d\u0438'}
                {ownerSort === 'name' && <SortIcon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {ownersSorted.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 uppercase tracking-wide">
                      <th className="px-2 pb-3 text-left">{'\u0418\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c'}</th>
                      <th className="px-2 pb-3 text-right">{'\u041f\u0438\u0441\u0435\u043c'}</th>
                      <th className="hidden sm:table-cell px-2 pb-3 text-right">{'\u0414\u043e\u043b\u044f'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {ownersToShow.map((owner) => {
                      const share = totalOwnerCount > 0
                        ? Math.round((owner.count / totalOwnerCount) * 100)
                        : 0
                      const progress = maxOwnerCount > 0 ? (owner.count / maxOwnerCount) * 100 : 0
                      return (
                        <tr key={owner.id} className="text-sm">
                          <td className="px-2 py-3 text-white">
                            <div className="font-medium">{owner.name}</div>
                            <div className="text-xs text-gray-500">{share}% {'\u043e\u0442 \u0432\u0441\u0435\u0445 \u043f\u0438\u0441\u0435\u043c'}</div>
                          </td>
                          <td className="px-2 py-3 text-right text-white font-semibold">{owner.count}</td>
                          <td className="hidden sm:table-cell px-2 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-2 bg-emerald-500 rounded-full"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-400 w-10 text-right">{share}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-4">
                {hasMoreOwners && (
                  <button
                    onClick={handleMoreOwners}
                    className="text-sm text-emerald-400 hover:text-emerald-300 transition"
                  >
                    {'\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0435\u0449\u0435'}
                  </button>
                )}
                {canCollapseOwners && (
                  <button
                    onClick={handleCollapseOwners}
                    className="text-sm text-gray-400 hover:text-gray-300 transition"
                  >
                    {'\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 py-6">{'\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445.'}</p>
          )}
        </div>

        <div className="panel panel-solid rounded-2xl p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">{'\u0414\u0438\u043d\u0430\u043c\u0438\u043a\u0430 \u043f\u043e \u043c\u0435\u0441\u044f\u0446\u0430\u043c'}</h3>
              <p className="text-sm text-gray-400">{'\u0421\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u0435 \u0441\u043e\u0437\u0434\u0430\u043d\u043d\u044b\u0445 \u0438 \u0437\u0430\u043a\u0440\u044b\u0442\u044b\u0445'}</p>
            </div>
            <span className="text-xs text-gray-500">{periodMonthly.length} {'\u043c\u0435\u0441'}</span>
          </div>

          {periodMonthly.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="flex items-end gap-3 h-64 min-w-[520px]">
                {periodMonthly.map((month, index) => {
                  const label = `${month.month}: ${month.created} / ${month.done}`
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2" title={label}>
                      <div className="flex-1 w-full flex items-end gap-1">
                        <div className="flex-1 flex flex-col justify-end">
                          <div
                            className="w-full bg-blue-500 rounded-t transition-all duration-500"
                            style={{
                              height: `${(month.created / maxMonthly) * 100}%`,
                              minHeight: month.created > 0 ? '8px' : '0',
                            }}
                          />
                        </div>
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
                      <div className="text-xs text-gray-500">{month.month}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-6">{'\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445.'}</p>
          )}

          <div className="flex flex-wrap justify-center gap-6 mt-4 pt-4 border-t border-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded" />
              <span className="text-sm text-gray-400">{'\u0421\u043e\u0437\u0434\u0430\u043d\u043e'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-500 rounded" />
              <span className="text-sm text-gray-400">{'\u0417\u0430\u043a\u0440\u044b\u0442\u043e'}</span>
            </div>
          </div>
        </div>

        {stats.byType.length > 0 && (
          <div className="panel panel-solid rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <h3 className="text-lg font-semibold text-white">{'\u0422\u0438\u043f\u044b \u043f\u0438\u0441\u0435\u043c'}</h3>
              <span className="text-xs text-gray-500">
                {typesToShow.length} / {stats.byType.length}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {typesToShow.map((item) => (
                <div key={item.type} className="panel panel-soft rounded-lg p-4 text-center">
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
                {showAllTypes ? '\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c' : '\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0432\u0441\u0435'}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

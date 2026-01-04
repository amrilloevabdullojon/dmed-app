'use client'

import { useSession } from 'next-auth/react'
import { Header } from '@/components/Header'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { STATUS_LABELS } from '@/lib/utils'
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
  Target,
  Zap,
  ExternalLink,
  ChevronRight,
  X,
  FileDown,
  Printer,
} from 'lucide-react'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { useToast } from '@/components/Toast'

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

// Donut Chart Component
function DonutChart({
  data,
  size = 200,
  strokeWidth = 24,
  onSegmentClick,
}: {
  data: Array<{ label: string; value: number; color: string; key: string }>
  size?: number
  strokeWidth?: number
  onSegmentClick?: (key: string) => void
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  if (total === 0) return null

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  let currentOffset = 0

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 transform">
        {data.map((item) => {
          const percentage = item.value / total
          const strokeDasharray = `${percentage * circumference} ${circumference}`
          const strokeDashoffset = -currentOffset * circumference
          currentOffset += percentage

          return (
            <circle
              key={item.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              className={`transition-all duration-500 ${onSegmentClick ? 'cursor-pointer hover:opacity-80' : ''}`}
              onClick={() => onSegmentClick?.(item.key)}
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{total}</span>
        <span className="text-sm text-gray-400">всего</span>
      </div>
    </div>
  )
}

// KPI Card with Goal
function KPICard({
  title,
  value,
  goal,
  icon: Icon,
  color,
  trend,
}: {
  title: string
  value: number
  goal: number
  icon: React.ElementType
  color: string
  trend?: { direction: 'up' | 'down' | 'flat'; label: string }
}) {
  const progress = goal > 0 ? Math.min((value / goal) * 100, 100) : 0
  const isAchieved = value >= goal

  return (
    <div className="panel panel-glass rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${color}`} />
          <span className="text-sm text-gray-400">{title}</span>
        </div>
        {trend && (
          <span
            className={`inline-flex items-center gap-1 text-xs ${
              trend.direction === 'up'
                ? 'text-emerald-400'
                : trend.direction === 'down'
                  ? 'text-red-400'
                  : 'text-gray-400'
            }`}
          >
            {trend.direction === 'up' && <ArrowUpRight className="h-3 w-3" />}
            {trend.direction === 'down' && <ArrowDownRight className="h-3 w-3" />}
            {trend.direction === 'flat' && <Minus className="h-3 w-3" />}
            {trend.label}
          </span>
        )}
      </div>
      <div className="mb-3 flex items-end gap-2">
        <span className={`text-3xl font-bold ${color}`}>{value}</span>
        <span className="mb-1 text-sm text-gray-500">/ {goal}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-700">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isAchieved ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">{progress.toFixed(0)}% от цели</span>
        {isAchieved && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle className="h-3 w-3" />
            Достигнуто
          </span>
        )}
      </div>
    </div>
  )
}

// Owner Detail Modal
function OwnerDetailModal({
  owner,
  onClose,
  onNavigate,
}: {
  owner: { id: string; name: string; count: number } | null
  onClose: () => void
  onNavigate: (ownerId: string) => void
}) {
  if (!owner) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="panel panel-glass animate-scaleIn relative w-full max-w-md rounded-2xl p-6">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 text-gray-400 transition hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
            <Users className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{owner.name}</h3>
            <p className="text-sm text-gray-400">Исполнитель</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="panel panel-soft rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">{owner.count}</div>
            <div className="text-xs text-gray-400">Всего писем</div>
          </div>
          <div className="panel panel-soft rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">—</div>
            <div className="text-xs text-gray-400">Выполнено</div>
          </div>
        </div>

        <button
          onClick={() => onNavigate(owner.id)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-white transition hover:bg-emerald-500"
        >
          <FileText className="h-4 w-4" />
          Показать письма
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const { data: session, status: authStatus } = useSession()
  useAuthRedirect(authStatus)
  const router = useRouter()
  const toast = useToast()
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
  const [selectedOwner, setSelectedOwner] = useState<{
    id: string
    name: string
    count: number
  } | null>(null)
  const [filterOwner, setFilterOwner] = useState<string | null>(null)

  // KPI Goals (configurable)
  const kpiGoals = {
    monthlyDone: 50,
    avgDaysTarget: 5,
    overdueMax: 5,
  }

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
    setFilterOwner(null)
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
    toast.success('Вид отчётов сохранён')
  }

  const handleShare = async () => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('period', String(periodMonths))
    url.searchParams.set('chart', chartView)
    try {
      await navigator.clipboard.writeText(url.toString())
      toast.success('Ссылка скопирована')
    } catch (error) {
      console.error('Failed to copy link', error)
      toast.error('Не удалось скопировать ссылку')
    }
  }

  const handleExportPDF = () => {
    if (!stats) return
    // Create a printable version of the report
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Не удалось открыть окно печати')
      return
    }

    const statusRows = (Object.keys(stats.byStatus) as LetterStatus[])
      .map(
        (status) =>
          `<tr><td>${STATUS_LABELS[status]}</td><td style="text-align:right">${stats.byStatus[status]}</td></tr>`
      )
      .join('')

    const ownerRows = stats.byOwner
      .slice(0, 10)
      .map(
        (owner) => `<tr><td>${owner.name}</td><td style="text-align:right">${owner.count}</td></tr>`
      )
      .join('')

    const monthlyRows = periodMonthly
      .map(
        (m) =>
          `<tr><td>${m.month}</td><td style="text-align:right">${m.created}</td><td style="text-align:right">${m.done}</td></tr>`
      )
      .join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Отчёт - ${new Date().toLocaleDateString('ru-RU')}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1f2937; }
          h1 { font-size: 24px; margin-bottom: 8px; }
          h2 { font-size: 18px; margin-top: 32px; margin-bottom: 12px; color: #374151; }
          .meta { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
          .summary-card { background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; }
          .summary-card .value { font-size: 32px; font-weight: 700; color: #111827; }
          .summary-card .label { font-size: 12px; color: #6b7280; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
          th { background: #f9fafb; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6b7280; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
          @media print { body { padding: 20px; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <h1>Отчёт по письмам</h1>
        <p class="meta">Сформирован: ${new Date().toLocaleString('ru-RU')} | Период: ${periodMonths} мес.</p>

        <div class="summary">
          <div class="summary-card">
            <div class="value">${stats.summary.total}</div>
            <div class="label">Всего писем</div>
          </div>
          <div class="summary-card">
            <div class="value" style="color: #ef4444">${stats.summary.overdue}</div>
            <div class="label">Просроченных</div>
          </div>
          <div class="summary-card">
            <div class="value" style="color: #3b82f6">${stats.summary.inProgress}</div>
            <div class="label">В работе</div>
          </div>
          <div class="summary-card">
            <div class="value" style="color: #10b981">${stats.summary.done}</div>
            <div class="label">Выполнено</div>
          </div>
        </div>

        <h2>По статусам</h2>
        <table>
          <thead><tr><th>Статус</th><th style="text-align:right">Количество</th></tr></thead>
          <tbody>${statusRows}</tbody>
        </table>

        <h2>По исполнителям (топ 10)</h2>
        <table>
          <thead><tr><th>Исполнитель</th><th style="text-align:right">Писем</th></tr></thead>
          <tbody>${ownerRows}</tbody>
        </table>

        <h2>По месяцам</h2>
        <table>
          <thead><tr><th>Месяц</th><th style="text-align:right">Создано</th><th style="text-align:right">Закрыто</th></tr></thead>
          <tbody>${monthlyRows}</tbody>
        </table>

        <div class="footer">
          DMED App | Автоматически сгенерированный отчёт
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  const handleExportCSV = () => {
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

  const handleStatusClick = (status: string) => {
    router.push(`/letters?status=${status}`)
  }

  const handleOwnerClick = (owner: { id: string; name: string; count: number }) => {
    setSelectedOwner(owner)
  }

  const handleNavigateToOwnerLetters = (ownerId: string) => {
    router.push(`/letters?owner=${ownerId}`)
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
    if (previous === null) return { direction: 'flat', label: 'Нет данных' }
    if (previous === 0) {
      return current === 0
        ? { direction: 'flat', label: '0%' }
        : { direction: 'up', label: '+100%' }
    }
    const diff = current - previous
    const pct = Math.round((diff / previous) * 100)
    const sign = diff > 0 ? '+' : diff < 0 ? '-' : ''
    return {
      direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
      label: `${sign}${Math.abs(pct)}%`,
    }
  }

  const createdTrend = getTrend(periodCreated, prevCreated)
  const doneTrend = getTrend(periodDone, prevDone)
  const avgPerMonth =
    periodMonthly.length > 0 ? Math.round(periodCreated / periodMonthly.length) : 0
  const prevAvgPerMonth =
    prevMonthly.length > 0 ? Math.round(sumBy(prevMonthly, 'created') / prevMonthly.length) : null
  const avgTrend = getTrend(avgPerMonth, prevAvgPerMonth)

  const ownersSorted = useMemo(() => {
    if (!stats) return []
    let list = [...stats.byOwner]
    if (filterOwner) {
      list = list.filter((o) => o.id === filterOwner)
    }
    list.sort((a, b) => {
      if (ownerSort === 'name') {
        return ownerSortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      }
      return ownerSortDir === 'asc' ? a.count - b.count : b.count - a.count
    })
    return list
  }, [stats, ownerSort, ownerSortDir, filterOwner])

  const ownersByCount = useMemo(() => {
    if (!stats) return []
    return [...stats.byOwner].sort((a, b) => b.count - a.count)
  }, [stats])

  const typesChart = useMemo(() => {
    if (!stats) return []
    return [...stats.byType].sort((a, b) => b.count - a.count).slice(0, 6)
  }, [stats])

  const donutData = useMemo(() => {
    if (!stats) return []
    return (Object.keys(stats.byStatus) as LetterStatus[]).map((status) => ({
      key: status,
      label: STATUS_LABELS[status],
      value: stats.byStatus[status],
      color: STATUS_CHART_COLORS[status],
    }))
  }, [stats])

  const ownerPageSize = 8
  const ownersToShow = ownersSorted.slice(0, ownerPage * ownerPageSize)
  const ownersChart = ownersByCount.slice(0, 6)
  const hasMoreOwners = ownersToShow.length < ownersSorted.length
  const canCollapseOwners = ownerPage > 1

  if (authStatus === 'loading') {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <p className="text-gray-400">Пожалуйста, войдите в систему</p>
      </div>
    )
  }

  const isInitialLoading = loading && !stats
  if (isInitialLoading) {
    return (
      <div className="app-shell min-h-screen">
        <Header />
        <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="animate-shimmer h-16 rounded-2xl bg-white/5" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-shimmer h-24 rounded-xl bg-white/5" />
            ))}
          </div>
          <div className="animate-shimmer h-40 rounded-2xl bg-white/5" />
          <div className="animate-shimmer h-64 rounded-2xl bg-white/5" />
        </main>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <p className="text-gray-400">Нет данных.</p>
      </div>
    )
  }

  const maxMonthly = Math.max(...periodMonthly.flatMap((m) => [m.created, m.done]), 1)

  const totalStatusCount = Object.values(stats.byStatus).reduce((a, b) => a + b, 0)
  const typesLimit = 12
  const typesToShow = showAllTypes ? stats.byType : stats.byType.slice(0, typesLimit)
  const maxOwnerCount = ownersByCount[0]?.count || 1
  const maxTypeCount = typesChart[0]?.count || 1
  const totalOwnerCount = ownersByCount.reduce((acc, owner) => acc + owner.count, 0)

  const SortIcon = ownerSortDir === 'asc' ? ArrowUpRight : ArrowDownRight

  return (
    <div className="app-shell min-h-screen">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Отчёты и статистика</h1>
            {lastUpdated && (
              <p className="mt-1 text-sm text-gray-400">
                Обновлено: {lastUpdated.toLocaleString('ru-RU')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white transition hover:bg-gray-700 disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Обновить
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="panel panel-glass mb-6 rounded-2xl p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="no-scrollbar flex items-center gap-2 overflow-x-auto sm:flex-wrap">
              <span className="text-xs uppercase tracking-wide text-gray-400">Период</span>
              {periodOptions.map((months) => (
                <button
                  key={months}
                  onClick={() => setPeriodMonths(months)}
                  className={`app-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                    periodMonths === months ? 'app-chip-active' : ''
                  }`}
                >
                  <Calendar className="h-4 w-4" />
                  {months} мес
                </button>
              ))}
              <button
                onClick={handleResetView}
                className="btn-ghost inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition"
              >
                <RefreshCw className="h-4 w-4" />
                Сбросить
              </button>
              <button
                onClick={handleSaveView}
                className="btn-secondary inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition"
              >
                <Save className="h-4 w-4" />
                Сохранить вид
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="btn-secondary inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 transition sm:w-auto"
              >
                <Download className="h-4 w-4" />
                CSV
              </button>
              <button
                onClick={handleExportPDF}
                className="btn-secondary inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 transition sm:w-auto"
              >
                <Printer className="h-4 w-4" />
                PDF
              </button>
              <button
                onClick={handleShare}
                className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 transition sm:w-auto"
              >
                <Share2 className="h-4 w-4" />
                Поделиться
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards with Goals */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KPICard
            title="Закрыто за месяц"
            value={stats.summary.monthDone}
            goal={kpiGoals.monthlyDone}
            icon={Target}
            color="text-emerald-400"
            trend={doneTrend}
          />
          <KPICard
            title="Среднее время (дней)"
            value={stats.summary.avgDays}
            goal={kpiGoals.avgDaysTarget}
            icon={Zap}
            color="text-blue-400"
          />
          <KPICard
            title="Просроченные"
            value={stats.summary.overdue}
            goal={kpiGoals.overdueMax}
            icon={AlertTriangle}
            color="text-red-400"
          />
        </div>

        {/* Quick Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
          <button
            onClick={() => router.push('/letters')}
            className="panel panel-soft group rounded-xl p-4 text-left transition hover:bg-white/10"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-400" />
                <span className="text-sm text-gray-400">Все письма</span>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-600 transition group-hover:text-gray-400" />
            </div>
            <div className="text-3xl font-bold text-white">{stats.summary.total}</div>
          </button>

          <button
            onClick={() => handleStatusClick('NOT_REVIEWED')}
            className="panel panel-soft group rounded-xl p-4 text-left transition hover:bg-white/10"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <span className="text-sm text-gray-400">Просроченные</span>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-600 transition group-hover:text-gray-400" />
            </div>
            <div className="text-3xl font-bold text-red-400">{stats.summary.overdue}</div>
          </button>

          <button
            onClick={() => handleStatusClick('IN_PROGRESS')}
            className="panel panel-soft group rounded-xl p-4 text-left transition hover:bg-white/10"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-400" />
                <span className="text-sm text-gray-400">Срочные</span>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-600 transition group-hover:text-gray-400" />
            </div>
            <div className="text-3xl font-bold text-yellow-400">{stats.summary.urgent}</div>
          </button>

          <button
            onClick={() => handleStatusClick('IN_PROGRESS')}
            className="panel panel-soft group rounded-xl p-4 text-left transition hover:bg-white/10"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-400" />
                <span className="text-sm text-gray-400">В работе</span>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-600 transition group-hover:text-gray-400" />
            </div>
            <div className="text-3xl font-bold text-blue-400">{stats.summary.inProgress}</div>
          </button>

          <button
            onClick={() => handleStatusClick('DONE')}
            className="panel panel-soft group rounded-xl p-4 text-left transition hover:bg-white/10"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
                <span className="text-sm text-gray-400">Выполнено</span>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-600 transition group-hover:text-gray-400" />
            </div>
            <div className="text-3xl font-bold text-emerald-400">{stats.summary.done}</div>
          </button>
        </div>

        {/* Period Comparison */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div className="panel panel-soft rounded-xl p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-purple-400" />
                <span className="text-sm text-gray-400">Создано за {periodMonths} мес</span>
              </div>
              <span
                className={`inline-flex items-center gap-1 text-xs ${
                  createdTrend.direction === 'up'
                    ? 'text-emerald-400'
                    : createdTrend.direction === 'down'
                      ? 'text-red-400'
                      : 'text-gray-400'
                }`}
              >
                {createdTrend.direction === 'up' && <ArrowUpRight className="h-3 w-3" />}
                {createdTrend.direction === 'down' && <ArrowDownRight className="h-3 w-3" />}
                {createdTrend.label}
              </span>
            </div>
            <div className="text-3xl font-bold text-purple-400">{periodCreated}</div>
            {prevCreated !== null && (
              <div className="mt-1 text-xs text-gray-500">Прошлый период: {prevCreated}</div>
            )}
          </div>

          <div className="panel panel-soft rounded-xl p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
                <span className="text-sm text-gray-400">Закрыто за {periodMonths} мес</span>
              </div>
              <span
                className={`inline-flex items-center gap-1 text-xs ${
                  doneTrend.direction === 'up'
                    ? 'text-emerald-400'
                    : doneTrend.direction === 'down'
                      ? 'text-red-400'
                      : 'text-gray-400'
                }`}
              >
                {doneTrend.direction === 'up' && <ArrowUpRight className="h-3 w-3" />}
                {doneTrend.direction === 'down' && <ArrowDownRight className="h-3 w-3" />}
                {doneTrend.label}
              </span>
            </div>
            <div className="text-3xl font-bold text-emerald-400">{periodDone}</div>
            {prevDone !== null && (
              <div className="mt-1 text-xs text-gray-500">Прошлый период: {prevDone}</div>
            )}
          </div>

          <div className="panel panel-soft rounded-xl p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-blue-400" />
                <span className="text-sm text-gray-400">Среднее в месяц</span>
              </div>
              <span
                className={`inline-flex items-center gap-1 text-xs ${
                  avgTrend.direction === 'up'
                    ? 'text-emerald-400'
                    : avgTrend.direction === 'down'
                      ? 'text-red-400'
                      : 'text-gray-400'
                }`}
              >
                {avgTrend.direction === 'up' && <ArrowUpRight className="h-3 w-3" />}
                {avgTrend.direction === 'down' && <ArrowDownRight className="h-3 w-3" />}
                {avgTrend.label}
              </span>
            </div>
            <div className="text-3xl font-bold text-blue-400">{avgPerMonth}</div>
            {prevAvgPerMonth !== null && (
              <div className="mt-1 text-xs text-gray-500">Прошлый период: {prevAvgPerMonth}</div>
            )}
          </div>

          <div className="panel panel-soft rounded-xl p-4">
            <div className="mb-2 flex items-center gap-3">
              <Timer className="h-5 w-5 text-orange-400" />
              <span className="text-sm text-gray-400">Время до закрытия</span>
            </div>
            <div className="text-3xl font-bold text-orange-400">{stats.summary.avgDays}</div>
            <div className="mt-1 text-xs text-gray-500">дней в среднем</div>
          </div>
        </div>

        {/* Distribution Chart with Donut */}
        <div className="panel panel-solid mb-8 rounded-2xl p-6">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Распределение</h3>
              <p className="text-sm text-gray-400">Нажмите на сегмент для перехода к списку</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setChartView('status')}
                className={`app-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                  chartView === 'status' ? 'app-chip-active' : ''
                }`}
              >
                <Filter className="h-4 w-4" />
                Статусы
              </button>
              <button
                onClick={() => setChartView('owner')}
                className={`app-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                  chartView === 'owner' ? 'app-chip-active' : ''
                }`}
              >
                <Users className="h-4 w-4" />
                Исполнители
              </button>
              <button
                onClick={() => setChartView('type')}
                className={`app-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                  chartView === 'type' ? 'app-chip-active' : ''
                }`}
              >
                <Layers className="h-4 w-4" />
                Типы
              </button>
            </div>
          </div>

          {chartView === 'status' && (
            <div className="flex flex-col items-center gap-8 lg:flex-row">
              {/* Donut Chart */}
              <div className="flex-shrink-0">
                <DonutChart data={donutData} size={220} onSegmentClick={handleStatusClick} />
              </div>

              {/* Legend & Bars */}
              <div className="w-full flex-1">
                {totalStatusCount > 0 ? (
                  <div className="space-y-3">
                    {(Object.keys(stats.byStatus) as LetterStatus[]).map((status) => {
                      const count = stats.byStatus[status]
                      const percentage = totalStatusCount > 0 ? (count / totalStatusCount) * 100 : 0

                      return (
                        <button
                          key={status}
                          onClick={() => handleStatusClick(status)}
                          className="group flex w-full items-center gap-3 rounded-lg p-2 transition hover:bg-white/5"
                        >
                          <div
                            className="h-3 w-3 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: STATUS_CHART_COLORS[status] }}
                          />
                          <div className="w-28 truncate text-left text-sm text-gray-400">
                            {STATUS_LABELS[status]}
                          </div>
                          <div className="h-5 flex-1 overflow-hidden rounded-full bg-gray-700">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: STATUS_CHART_COLORS[status],
                              }}
                            />
                          </div>
                          <div className="flex w-16 items-center gap-1 text-right">
                            <span className="font-medium text-white">{count}</span>
                            <span className="text-sm text-gray-500">
                              ({percentage.toFixed(0)}%)
                            </span>
                          </div>
                          <ExternalLink className="h-4 w-4 text-gray-600 transition group-hover:text-emerald-400" />
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="py-6 text-sm text-gray-500">Нет данных.</p>
                )}
              </div>
            </div>
          )}

          {chartView === 'owner' && (
            <>
              {ownersChart.length > 0 ? (
                <div className="space-y-3">
                  {ownersChart.map((owner, index) => {
                    const percentage = maxOwnerCount > 0 ? (owner.count / maxOwnerCount) * 100 : 0
                    return (
                      <button
                        key={owner.id}
                        onClick={() => handleOwnerClick(owner)}
                        className="group flex w-full items-center gap-3 rounded-lg p-2 transition hover:bg-white/5"
                      >
                        <div className="w-6 text-sm text-gray-500">{index + 1}.</div>
                        <div className="w-36 truncate text-left text-sm text-gray-300">
                          {owner.name}
                        </div>
                        <div className="h-5 flex-1 overflow-hidden rounded-full bg-gray-700">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="w-10 text-right font-medium text-white">{owner.count}</div>
                        <ExternalLink className="h-4 w-4 text-gray-600 transition group-hover:text-emerald-400" />
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="py-6 text-sm text-gray-500">Нет данных.</p>
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
                        <div className="w-40 truncate text-sm text-gray-300">{item.type}</div>
                        <div className="h-5 flex-1 overflow-hidden rounded-full bg-gray-700">
                          <div
                            className="h-full rounded-full bg-sky-500 transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="w-10 text-right font-medium text-white">{item.count}</div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="py-6 text-sm text-gray-500">Нет данных.</p>
              )}
            </>
          )}
        </div>

        {/* Owners Activity Table */}
        <div className="panel panel-solid mb-8 rounded-2xl p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Активность исполнителей</h3>
              <p className="text-sm text-gray-400">Нажмите на исполнителя для просмотра деталей</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {filterOwner && (
                <button
                  onClick={() => setFilterOwner(null)}
                  className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-1 text-xs text-emerald-400"
                >
                  <X className="h-3 w-3" />
                  Сбросить фильтр
                </button>
              )}
              <button
                onClick={() => handleOwnerSort('count')}
                className={`app-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                  ownerSort === 'count' ? 'app-chip-active' : ''
                }`}
              >
                <Filter className="h-4 w-4" />
                По объему
                {ownerSort === 'count' && <SortIcon className="h-4 w-4" />}
              </button>
              <button
                onClick={() => handleOwnerSort('name')}
                className={`app-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                  ownerSort === 'name' ? 'app-chip-active' : ''
                }`}
              >
                <Users className="h-4 w-4" />
                По имени
                {ownerSort === 'name' && <SortIcon className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {ownersSorted.length > 0 ? (
            <>
              <div className="hidden overflow-x-auto sm:block">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-gray-400">
                      <th className="px-2 pb-3 text-left">Исполнитель</th>
                      <th className="px-2 pb-3 text-right">Писем</th>
                      <th className="px-2 pb-3 text-right">Доля</th>
                      <th className="px-2 pb-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {ownersToShow.map((owner) => {
                      const share =
                        totalOwnerCount > 0 ? Math.round((owner.count / totalOwnerCount) * 100) : 0
                      const progress = maxOwnerCount > 0 ? (owner.count / maxOwnerCount) * 100 : 0
                      return (
                        <tr
                          key={owner.id}
                          className="cursor-pointer text-sm transition hover:bg-white/5"
                          onClick={() => handleOwnerClick(owner)}
                        >
                          <td className="px-2 py-3 text-white">
                            <div className="font-medium">{owner.name}</div>
                            <div className="text-xs text-gray-500">{share}% от всех писем</div>
                          </td>
                          <td className="px-2 py-3 text-right font-semibold text-white">
                            {owner.count}
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-700">
                                <div
                                  className="h-2 rounded-full bg-emerald-500"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="w-10 text-right text-xs text-gray-400">
                                {share}%
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            <ExternalLink className="h-4 w-4 text-gray-600" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile view */}
              <div className="space-y-3 sm:hidden">
                {ownersToShow.map((owner) => {
                  const share =
                    totalOwnerCount > 0 ? Math.round((owner.count / totalOwnerCount) * 100) : 0
                  const progress = maxOwnerCount > 0 ? (owner.count / maxOwnerCount) * 100 : 0
                  return (
                    <button
                      key={owner.id}
                      onClick={() => handleOwnerClick(owner)}
                      className="panel-soft panel-glass w-full rounded-xl p-4 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-white">{owner.name}</div>
                          <div className="text-xs text-gray-500">{share}% от всех</div>
                        </div>
                        <div className="text-right font-semibold text-white">{owner.count}</div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-700">
                        <div
                          className="h-2 rounded-full bg-emerald-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {hasMoreOwners && (
                  <button
                    onClick={handleMoreOwners}
                    className="text-sm text-emerald-400 transition hover:text-emerald-300"
                  >
                    Показать еще
                  </button>
                )}
                {canCollapseOwners && (
                  <button
                    onClick={handleCollapseOwners}
                    className="text-sm text-gray-400 transition hover:text-gray-300"
                  >
                    Свернуть
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="py-6 text-sm text-gray-500">Нет данных.</p>
          )}
        </div>

        {/* Monthly Chart */}
        <div className="panel panel-solid mb-8 rounded-2xl p-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Динамика по месяцам</h3>
              <p className="text-sm text-gray-400">Сравнение созданных и закрытых</p>
            </div>
            <span className="text-xs text-gray-500">{periodMonthly.length} мес</span>
          </div>

          {periodMonthly.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="flex h-64 min-w-[520px] items-end gap-3">
                {periodMonthly.map((month, index) => {
                  const label = `${month.month}: ${month.created} / ${month.done}`
                  return (
                    <div
                      key={index}
                      className="flex flex-1 flex-col items-center gap-2"
                      title={label}
                    >
                      <div className="flex w-full flex-1 items-end gap-1">
                        <div className="flex flex-1 flex-col justify-end">
                          <div
                            className="w-full rounded-t bg-blue-500 transition-all duration-500"
                            style={{
                              height: `${(month.created / maxMonthly) * 100}%`,
                              minHeight: month.created > 0 ? '8px' : '0',
                            }}
                          />
                        </div>
                        <div className="flex flex-1 flex-col justify-end">
                          <div
                            className="w-full rounded-t bg-emerald-500 transition-all duration-500"
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
            <p className="py-6 text-sm text-gray-500">Нет данных.</p>
          )}

          <div className="mt-4 flex flex-wrap justify-center gap-6 border-t border-gray-700 pt-4">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-blue-500" />
              <span className="text-sm text-gray-400">Создано</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-emerald-500" />
              <span className="text-sm text-gray-400">Закрыто</span>
            </div>
          </div>
        </div>

        {/* Types */}
        {stats.byType.length > 0 && (
          <div className="panel panel-solid rounded-2xl p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-semibold text-white">Типы писем</h3>
              <span className="text-xs text-gray-500">
                {typesToShow.length} / {stats.byType.length}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {typesToShow.map((item) => (
                <div key={item.type} className="panel panel-soft rounded-lg p-4 text-center">
                  <div className="mb-1 text-2xl font-bold text-white">{item.count}</div>
                  <div className="truncate text-sm text-gray-400">{item.type}</div>
                </div>
              ))}
            </div>

            {stats.byType.length > typesLimit && (
              <button
                onClick={() => setShowAllTypes((prev) => !prev)}
                className="mt-4 text-sm text-emerald-400 transition hover:text-emerald-300"
              >
                {showAllTypes ? 'Свернуть' : 'Показать все'}
              </button>
            )}
          </div>
        )}
      </main>

      {/* Owner Detail Modal */}
      <OwnerDetailModal
        owner={selectedOwner}
        onClose={() => setSelectedOwner(null)}
        onNavigate={handleNavigateToOwnerLetters}
      />
    </div>
  )
}

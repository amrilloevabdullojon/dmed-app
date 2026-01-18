'use client'

import { useSession } from 'next-auth/react'
import { Header } from '@/components/Header'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { STATUS_LABELS } from '@/lib/utils'
import type { LetterStatus } from '@/types/prisma'
import {
  Loader2,
  Building2,
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
  Search,
  Filter,
  Layers,
  Download,
  FileSpreadsheet,
  Share2,
  Save,
  Target,
  Zap,
  ExternalLink,
  LayoutGrid,
  Table,
  BarChart3,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  Printer,
} from 'lucide-react'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { useToast } from '@/components/Toast'
import { ResponsiveChart } from '@/components/mobile/ResponsiveChart'
import { ScrollIndicator } from '@/components/mobile/ScrollIndicator'

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
  byOrgTypePeriod: Array<{
    periodKey: string
    periodLabel: string
    org: string
    type: string
    count: number
  }>
  monthly: Array<{ month: string; created: number; done: number }>
  report?: {
    letters: ReportLetter[]
  }
}

interface ReportLetter {
  createdAt: string
  org: string
  type: string
  status: LetterStatus
  ownerId: string | null
}

interface ReportAggregateRow {
  periodKey: string
  periodLabel: string
  periodSort: number
  groupKey: string
  groupLabel: string
  org?: string
  type?: string
  count: number
  secondaryLabel?: string
}

interface ReportPeriodGroup {
  periodKey: string
  periodLabel: string
  periodSort: number
  totalCount: number
  maxCount: number
  rows: ReportAggregateRow[]
}

const STATUS_CHART_COLORS: Record<LetterStatus, string> = {
  NOT_REVIEWED: '#6b7280',
  ACCEPTED: '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  CLARIFICATION: '#8b5cf6',
  READY: '#22c55e',
  DONE: '#10b981',
}

const REPORT_STATUS_OPTIONS: LetterStatus[] = [
  'NOT_REVIEWED',
  'ACCEPTED',
  'IN_PROGRESS',
  'CLARIFICATION',
  'READY',
  'DONE',
]

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

  // Calculate offsets without mutation
  const segments = data.map((item, index) => {
    const percentage = item.value / total
    const strokeDasharray = `${percentage * circumference} ${circumference}`
    const offset = data.slice(0, index).reduce((acc, d) => acc + d.value / total, 0)
    const strokeDashoffset = -offset * circumference

    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
    }
  })

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 transform">
        {segments.map((segment) => (
          <circle
            key={segment.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeDasharray={segment.strokeDasharray}
            strokeDashoffset={segment.strokeDashoffset}
            className={`transition-all duration-500 ${onSegmentClick ? 'cursor-pointer hover:opacity-80' : ''}`}
            onClick={() => onSegmentClick?.(segment.key)}
          />
        ))}
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
            <h3 className="text-lg font-semibold text-white">{owner.name || owner.id}</h3>
            <p className="text-sm text-gray-400">Исполнитель</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
  const [reportView, setReportView] = useState<'cards' | 'table' | 'heatmap'>('cards')
  const [reportGroupBy, setReportGroupBy] = useState<'orgType' | 'org' | 'type'>('orgType')
  const [reportGranularity, setReportGranularity] = useState<'month' | 'quarter' | 'week'>('month')
  const [reportStatusFilter, setReportStatusFilter] = useState<LetterStatus | 'all'>('all')
  const [reportOwnerFilter, setReportOwnerFilter] = useState('')
  const [reportOrgFilter, setReportOrgFilter] = useState('')
  const [reportTypeFilter, setReportTypeFilter] = useState('')
  const [reportSearch, setReportSearch] = useState('')
  const [reportExportColumns, setReportExportColumns] = useState({
    period: true,
    org: true,
    type: true,
    status: false,
    owner: false,
    count: true,
  })
  const [expandedReportPeriods, setExpandedReportPeriods] = useState<Record<string, boolean>>({})

  // KPI Goals (configurable)
  const kpiGoals = {
    monthlyDone: 50,
    avgDaysTarget: 5,
    overdueMax: 5,
  }

  const applyView = useCallback(
    (view: {
      periodMonths?: number
      chartView?: 'status' | 'owner' | 'type'
      ownerSort?: 'count' | 'name'
      ownerSortDir?: 'asc' | 'desc'
      reportView?: 'cards' | 'table' | 'heatmap'
      reportGroupBy?: 'orgType' | 'org' | 'type'
      reportGranularity?: 'month' | 'quarter' | 'week'
      reportStatusFilter?: LetterStatus | 'all'
      reportOwnerFilter?: string
      reportOrgFilter?: string
      reportTypeFilter?: string
      reportSearch?: string
      reportExportColumns?: Partial<typeof reportExportColumns>
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
      if (view.reportView && ['cards', 'table', 'heatmap'].includes(view.reportView)) {
        setReportView(view.reportView)
      }
      if (view.reportGroupBy && ['orgType', 'org', 'type'].includes(view.reportGroupBy)) {
        setReportGroupBy(view.reportGroupBy)
      }
      if (view.reportGranularity && ['month', 'quarter', 'week'].includes(view.reportGranularity)) {
        setReportGranularity(view.reportGranularity)
      }
      if (view.reportStatusFilter) {
        setReportStatusFilter(view.reportStatusFilter)
      }
      if (typeof view.reportOwnerFilter === 'string') {
        setReportOwnerFilter(view.reportOwnerFilter)
      }
      if (typeof view.reportOrgFilter === 'string') {
        setReportOrgFilter(view.reportOrgFilter)
      }
      if (typeof view.reportTypeFilter === 'string') {
        setReportTypeFilter(view.reportTypeFilter)
      }
      if (typeof view.reportSearch === 'string') {
        setReportSearch(view.reportSearch)
      }
      if (view.reportExportColumns) {
        setReportExportColumns((prev) => ({ ...prev, ...view.reportExportColumns }))
      }
    },
    []
  )

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
      reportView: params.get('rview') as 'cards' | 'table' | 'heatmap' | null,
      reportGroupBy: params.get('rgroup') as 'orgType' | 'org' | 'type' | null,
      reportGranularity: params.get('rgran') as 'month' | 'quarter' | 'week' | null,
      reportStatusFilter: params.get('rstatus') as LetterStatus | 'all' | null,
      reportOwnerFilter: params.get('rowner'),
      reportOrgFilter: params.get('rorg'),
      reportTypeFilter: params.get('rtype'),
      reportSearch: params.get('rq'),
    }

    if (
      [3, 6, 12].includes(urlView.periodMonths) ||
      urlView.chartView ||
      urlView.reportView ||
      urlView.reportGroupBy ||
      urlView.reportGranularity ||
      urlView.reportStatusFilter ||
      urlView.reportOwnerFilter ||
      urlView.reportOrgFilter ||
      urlView.reportTypeFilter ||
      urlView.reportSearch
    ) {
      applyView({
        periodMonths: [3, 6, 12].includes(urlView.periodMonths) ? urlView.periodMonths : undefined,
        chartView: urlView.chartView || undefined,
        reportView: urlView.reportView || undefined,
        reportGroupBy: urlView.reportGroupBy || undefined,
        reportGranularity: urlView.reportGranularity || undefined,
        reportStatusFilter: urlView.reportStatusFilter || undefined,
        reportOwnerFilter: urlView.reportOwnerFilter || undefined,
        reportOrgFilter: urlView.reportOrgFilter || undefined,
        reportTypeFilter: urlView.reportTypeFilter || undefined,
        reportSearch: urlView.reportSearch || undefined,
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
  }, [applyView])

  useEffect(() => {
    setExpandedReportPeriods({})
  }, [
    periodMonths,
    reportGroupBy,
    reportGranularity,
    reportStatusFilter,
    reportOwnerFilter,
    reportOrgFilter,
    reportTypeFilter,
    reportSearch,
  ])

  const loadStats = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const res = await fetch('/api/stats?includeReport=1')
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
    setReportView('cards')
    setReportGroupBy('orgType')
    setReportGranularity('month')
    setReportStatusFilter('all')
    setReportOwnerFilter('')
    setReportOrgFilter('')
    setReportTypeFilter('')
    setReportSearch('')
    setReportExportColumns({
      period: true,
      org: true,
      type: true,
      status: false,
      owner: false,
      count: true,
    })
    setExpandedReportPeriods({})
  }

  const handleReportReset = () => {
    setReportStatusFilter('all')
    setReportOwnerFilter('')
    setReportOrgFilter('')
    setReportTypeFilter('')
    setReportSearch('')
    setExpandedReportPeriods({})
  }

  const handleSaveView = () => {
    if (typeof window === 'undefined') return
    const payload = {
      periodMonths,
      chartView,
      ownerSort,
      ownerSortDir,
      reportView,
      reportGroupBy,
      reportGranularity,
      reportStatusFilter,
      reportOwnerFilter,
      reportOrgFilter,
      reportTypeFilter,
      reportSearch,
      reportExportColumns,
    }
    window.localStorage.setItem('reportsView', JSON.stringify(payload))
    toast.success('Вид отчётов сохранён')
  }

  const handleShare = async () => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('period', String(periodMonths))
    url.searchParams.set('chart', chartView)
    if (reportView !== 'cards') url.searchParams.set('rview', reportView)
    if (reportGroupBy !== 'orgType') url.searchParams.set('rgroup', reportGroupBy)
    if (reportGranularity !== 'month') url.searchParams.set('rgran', reportGranularity)
    if (reportStatusFilter !== 'all') url.searchParams.set('rstatus', reportStatusFilter)
    if (reportOwnerFilter) url.searchParams.set('rowner', reportOwnerFilter)
    if (reportOrgFilter) url.searchParams.set('rorg', reportOrgFilter)
    if (reportTypeFilter) url.searchParams.set('rtype', reportTypeFilter)
    if (reportSearch) url.searchParams.set('rq', reportSearch)
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
        (owner) =>
          `<tr><td>${owner.name || owner.id}</td><td style="text-align:right">${owner.count}</td></tr>`
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
      ...(reportExportHeaders.length > 0 ? [[], reportExportHeaders, ...reportExportRows] : []),
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

  const handleExportOrgTypeCSV = () => {
    if (!stats) return
    if (reportExportRows.length === 0 || reportExportHeaders.length === 0) {
      toast.error('No data to export for the selected period')
      return
    }
    const rows: string[][] = [reportExportHeaders, ...reportExportRows]
    const csv = rows.map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `report-${reportGroupBy}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleExportOrgTypeXLSX = async () => {
    if (!stats) return
    if (reportExportRows.length === 0 || reportExportHeaders.length === 0) {
      toast.error('Failed to export XLSX')
      return
    }
    try {
      const excelJSImport = await import('exceljs')
      const ExcelJS = excelJSImport.default ?? excelJSImport
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Report')
      sheet.addRow(reportExportHeaders)
      reportExportRows.forEach((row) => sheet.addRow(row))
      sheet.getRow(1).font = { bold: true }
      reportExportHeaders.forEach((header, index) => {
        const column = sheet.getColumn(index + 1)
        const maxLength = Math.max(
          header.length,
          ...reportExportRows.map((row) => (row[index] || '').length)
        )
        column.width = Math.min(Math.max(12, maxLength + 4), 60)
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `report-${reportGroupBy}-${new Date().toISOString().slice(0, 10)}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export XLSX', error)
      toast.error('Failed to generate XLSX')
    }
  }

  const handleExportOrgTypePDF = () => {
    if (!stats) return
    if (reportExportRows.length === 0 || reportExportHeaders.length === 0) {
      toast.error('Нет данных для экспорта за выбранный период')
      return
    }

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Не удалось открыть окно для печати')
      return
    }

    const headerRow = reportExportHeaders.map((header) => `<th>${header}</th>`).join('')
    const bodyRows = reportExportRows
      .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
      .join('')

    const filters = [
      `Период: ${periodMonths} мес.`,
      `Группировка: ${reportGroupBy === 'orgType' ? 'Учреждение + Тип' : reportGroupBy === 'org' ? 'Учреждение' : 'Тип'}`,
      `Детализация: ${reportGranularity === 'month' ? 'Месяц' : reportGranularity === 'quarter' ? 'Квартал' : 'Неделя'}`,
      reportStatusFilter !== 'all' ? `Статус: ${reportStatusLabel}` : null,
      reportOwnerFilter ? `Ответственный: ${reportOwnerLabel}` : null,
      reportOrgFilter ? `Учреждение: ${reportOrgFilter}` : null,
      reportTypeFilter ? `Тип: ${reportTypeFilter}` : null,
      reportSearch ? `Поиск: ${reportSearch}` : null,
    ]
      .filter(Boolean)
      .join(' | ')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Отчет по учреждениям - ${new Date().toLocaleDateString('ru-RU')}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px; color: #111827; }
          h1 { font-size: 22px; margin-bottom: 6px; }
          .meta { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
          th { background: #f9fafb; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6b7280; }
          .footer { margin-top: 28px; font-size: 12px; color: #9ca3af; text-align: center; }
        </style>
      </head>
      <body>
        <h1>Отчет по учреждениям и типам писем</h1>
        <div class="meta">${filters}</div>
        <table>
          <thead><tr>${headerRow}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
        <div class="footer">DMED App</div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  const handleReportDrilldown = (row: ReportAggregateRow) => {
    const params = new URLSearchParams()
    if (reportStatusFilter !== 'all') params.set('status', reportStatusFilter)
    if (reportOwnerFilter) {
      if (reportOwnerFilter === 'unassigned') {
        params.set('filter', 'unassigned')
      } else {
        params.set('owner', reportOwnerFilter)
      }
    }
    const orgValue = row.org || reportOrgFilter
    if (orgValue) params.set('search', orgValue)
    const typeValue = row.type || reportTypeFilter
    if (typeValue) params.set('type', typeValue)
    router.push(`/letters?${params.toString()}`)
  }

  const handleStatusClick = (status: string) => {
    router.push(`/letters?status=${status}`)
  }

  const handleOwnerClick = (owner: { id: string; name: string; count: number }) => {
    setSelectedOwner({ id: owner.id, name: owner.name, count: owner.count })
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

  const toggleReportPeriod = (periodKey: string) => {
    setExpandedReportPeriods((prev) => ({
      ...prev,
      [periodKey]: !prev[periodKey],
    }))
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

  const reportLetters = useMemo(() => {
    if (!stats?.report?.letters) return []
    return stats.report.letters.map((letter) => ({
      ...letter,
      createdAt: new Date(letter.createdAt),
    }))
  }, [stats])

  const reportOrgOptions = useMemo(() => {
    const unique = new Set<string>()
    reportLetters.forEach((letter) => unique.add(letter.org))
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'ru-RU'))
  }, [reportLetters])

  const reportTypeOptions = useMemo(() => {
    const unique = new Set<string>()
    reportLetters.forEach((letter) => unique.add(letter.type))
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'ru-RU'))
  }, [reportLetters])

  const reportOwnerOptions = useMemo(() => stats?.byOwner ?? [], [stats])

  const reportOwnerLabel = useMemo(() => {
    if (!reportOwnerFilter) return 'Все ответственные'
    if (reportOwnerFilter === 'unassigned') return 'Без ответственного'
    const owner = reportOwnerOptions.find((item) => item.id === reportOwnerFilter)
    return owner?.name || owner?.id || reportOwnerFilter
  }, [reportOwnerFilter, reportOwnerOptions])

  const reportStatusLabel =
    reportStatusFilter === 'all' ? 'Все статусы' : STATUS_LABELS[reportStatusFilter]

  const reportPeriodStart = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() - (periodMonths - 1), 1)
  }, [periodMonths])

  const reportSearchValue = reportSearch.trim().toLowerCase()

  const reportFilteredLetters = useMemo(() => {
    if (reportLetters.length === 0) return []
    return reportLetters.filter((letter) => {
      if (letter.createdAt < reportPeriodStart) return false
      if (reportStatusFilter !== 'all' && letter.status !== reportStatusFilter) return false
      if (reportOwnerFilter) {
        if (reportOwnerFilter === 'unassigned') {
          if (letter.ownerId) return false
        } else if (letter.ownerId !== reportOwnerFilter) {
          return false
        }
      }
      if (reportOrgFilter && letter.org !== reportOrgFilter) return false
      if (reportTypeFilter && letter.type !== reportTypeFilter) return false
      if (reportSearchValue) {
        const haystack = `${letter.org} ${letter.type}`.toLowerCase()
        if (!haystack.includes(reportSearchValue)) return false
      }
      return true
    })
  }, [
    reportLetters,
    reportPeriodStart,
    reportStatusFilter,
    reportOwnerFilter,
    reportOrgFilter,
    reportTypeFilter,
    reportSearchValue,
  ])

  const reportAggregates = useMemo<ReportAggregateRow[]>(() => {
    if (reportFilteredLetters.length === 0) return []
    const rows = new Map<string, ReportAggregateRow>()
    const secondaryMap = new Map<string, Map<string, number>>()

    const getBucket = (date: Date) => {
      if (reportGranularity === 'week') {
        const start = new Date(date)
        const day = (start.getDay() + 6) % 7
        start.setDate(start.getDate() - day)
        start.setHours(0, 0, 0, 0)
        const end = new Date(start)
        end.setDate(start.getDate() + 6)
        const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(
          start.getDate()
        ).padStart(2, '0')}`
        const label = `${start.toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: 'short',
        })} – ${end.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })} ${start.getFullYear()}`
        return { key, label, sortValue: start.getTime() }
      }
      if (reportGranularity === 'quarter') {
        const year = date.getFullYear()
        const quarter = Math.floor(date.getMonth() / 3) + 1
        const key = `${year}-Q${quarter}`
        return {
          key,
          label: `${quarter} кв. ${year}`,
          sortValue: new Date(year, (quarter - 1) * 3, 1).getTime(),
        }
      }
      const year = date.getFullYear()
      const month = date.getMonth()
      const key = `${year}-${String(month + 1).padStart(2, '0')}`
      return {
        key,
        label: date.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }),
        sortValue: new Date(year, month, 1).getTime(),
      }
    }

    reportFilteredLetters.forEach((letter) => {
      const bucket = getBucket(letter.createdAt)
      const org = letter.org
      const type = letter.type
      let groupKey = ''
      let groupLabel = ''
      let orgValue: string | undefined
      let typeValue: string | undefined

      if (reportGroupBy === 'orgType') {
        groupKey = `${org}||${type}`
        groupLabel = org
        orgValue = org
        typeValue = type
      } else if (reportGroupBy === 'org') {
        groupKey = org
        groupLabel = org
        orgValue = org
      } else {
        groupKey = type
        groupLabel = type
        typeValue = type
      }

      const rowKey = `${bucket.key}||${groupKey}`
      const existing = rows.get(rowKey)
      if (existing) {
        existing.count += 1
      } else {
        rows.set(rowKey, {
          periodKey: bucket.key,
          periodLabel: bucket.label,
          periodSort: bucket.sortValue,
          groupKey,
          groupLabel,
          org: orgValue,
          type: typeValue,
          count: 1,
        })
      }

      if (reportGroupBy !== 'orgType') {
        const secondaryKey = `${bucket.key}||${groupKey}`
        const bucketMap = secondaryMap.get(secondaryKey) || new Map<string, number>()
        const secondaryLabel = reportGroupBy === 'org' ? type : org
        bucketMap.set(secondaryLabel, (bucketMap.get(secondaryLabel) || 0) + 1)
        secondaryMap.set(secondaryKey, bucketMap)
      }
    })

    if (reportGroupBy !== 'orgType') {
      rows.forEach((row) => {
        const secondaryKey = `${row.periodKey}||${row.groupKey}`
        const candidates = secondaryMap.get(secondaryKey)
        if (!candidates || candidates.size === 0) return
        const top = Array.from(candidates.entries()).sort((a, b) => b[1] - a[1])[0]
        row.secondaryLabel = top?.[0]
      })
    }

    return Array.from(rows.values()).sort((a, b) => {
      if (a.periodSort !== b.periodSort) return b.periodSort - a.periodSort
      if (a.count !== b.count) return b.count - a.count
      return a.groupLabel.localeCompare(b.groupLabel, 'ru-RU')
    })
  }, [reportFilteredLetters, reportGroupBy, reportGranularity])

  const reportSummary = useMemo(() => {
    const orgs = new Set<string>()
    const types = new Set<string>()
    const periods = new Set<string>()
    const groups = new Set<string>()
    reportFilteredLetters.forEach((letter) => {
      orgs.add(letter.org)
      types.add(letter.type)
    })
    reportAggregates.forEach((row) => {
      periods.add(row.periodKey)
      groups.add(row.groupKey)
    })
    return {
      total: reportFilteredLetters.length,
      orgCount: orgs.size,
      typeCount: types.size,
      groupCount: groups.size,
      periodCount: periods.size,
    }
  }, [reportFilteredLetters, reportAggregates])

  const reportPeriodGroups = useMemo<ReportPeriodGroup[]>(() => {
    const groups = new Map<string, ReportPeriodGroup>()
    reportAggregates.forEach((row) => {
      const existing = groups.get(row.periodKey)
      if (existing) {
        existing.totalCount += row.count
        existing.maxCount = Math.max(existing.maxCount, row.count)
        existing.rows.push(row)
      } else {
        groups.set(row.periodKey, {
          periodKey: row.periodKey,
          periodLabel: row.periodLabel,
          periodSort: row.periodSort,
          totalCount: row.count,
          maxCount: row.count,
          rows: [row],
        })
      }
    })
    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        rows: [...group.rows].sort((a, b) => {
          if (a.count !== b.count) return b.count - a.count
          return a.groupLabel.localeCompare(b.groupLabel, 'ru-RU')
        }),
      }))
      .sort((a, b) => b.periodSort - a.periodSort)
  }, [reportAggregates])

  const reportHeatmap = useMemo(() => {
    if (reportAggregates.length === 0) {
      return { periods: [], groups: [], matrix: new Map<string, Map<string, number>>(), max: 0 }
    }
    const periodMap = new Map<string, { label: string; sort: number }>()
    const groupTotals = new Map<string, { label: string; total: number }>()
    const matrix = new Map<string, Map<string, number>>()
    let max = 0

    reportAggregates.forEach((row) => {
      periodMap.set(row.periodKey, { label: row.periodLabel, sort: row.periodSort })
      groupTotals.set(row.groupKey, {
        label: row.groupLabel,
        total: (groupTotals.get(row.groupKey)?.total || 0) + row.count,
      })
      const rowMap = matrix.get(row.groupKey) || new Map<string, number>()
      rowMap.set(row.periodKey, (rowMap.get(row.periodKey) || 0) + row.count)
      matrix.set(row.groupKey, rowMap)
      max = Math.max(max, row.count)
    })

    const periods = Array.from(periodMap.entries())
      .map(([key, value]) => ({ key, label: value.label, sort: value.sort }))
      .sort((a, b) => b.sort - a.sort)

    const groups = Array.from(groupTotals.entries())
      .map(([key, value]) => ({ key, label: value.label, total: value.total }))
      .sort((a, b) => b.total - a.total)

    return { periods, groups, matrix, max }
  }, [reportAggregates])

  const reportHasFilters =
    reportStatusFilter !== 'all' ||
    reportOwnerFilter ||
    reportOrgFilter ||
    reportTypeFilter ||
    reportSearch

  const reportExportHeaders = useMemo(() => {
    const headers: string[] = []
    if (reportExportColumns.period) headers.push('Период')
    if (reportExportColumns.org) headers.push('Учреждение')
    if (reportExportColumns.type) headers.push('Тип письма')
    if (reportExportColumns.status) headers.push('Статус')
    if (reportExportColumns.owner) headers.push('Ответственный')
    if (reportExportColumns.count) headers.push('Количество')
    return headers
  }, [reportExportColumns])

  const reportExportRows = useMemo(() => {
    return reportAggregates.map((row) => {
      const values: string[] = []
      if (reportExportColumns.period) values.push(row.periodLabel)
      if (reportExportColumns.org) values.push(row.org || reportOrgFilter || '')
      if (reportExportColumns.type) values.push(row.type || reportTypeFilter || '')
      if (reportExportColumns.status) values.push(reportStatusLabel)
      if (reportExportColumns.owner) values.push(reportOwnerLabel)
      if (reportExportColumns.count) values.push(String(row.count))
      return values
    })
  }, [
    reportAggregates,
    reportExportColumns,
    reportOrgFilter,
    reportTypeFilter,
    reportOwnerLabel,
    reportStatusLabel,
  ])

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
  const orgTypePreviewLimit = 6
  const reportHeatmapLimit = 10
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
            <ScrollIndicator
              className="no-scrollbar flex items-center gap-2 sm:flex-wrap"
              showArrows={true}
            >
              <span className="whitespace-nowrap text-xs uppercase tracking-wide text-gray-400">
                Период
              </span>
              {periodOptions.map((months) => (
                <button
                  key={months}
                  onClick={() => setPeriodMonths(months)}
                  className={`app-chip inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition ${
                    periodMonths === months ? 'app-chip-active' : ''
                  }`}
                >
                  <Calendar className="h-4 w-4" />
                  {months} мес
                </button>
              ))}
              <button
                onClick={handleResetView}
                className="btn-ghost inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition"
              >
                <RefreshCw className="h-4 w-4" />
                Сбросить
              </button>
              <button
                onClick={handleSaveView}
                className="btn-secondary inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition"
              >
                <Save className="h-4 w-4" />
                Сохранить вид
              </button>
            </ScrollIndicator>
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
                <ResponsiveChart minWidth={180} maxWidth={220} aspectRatio={1}>
                  {(size) => (
                    <DonutChart
                      data={donutData}
                      size={size.width}
                      strokeWidth={size.width > 200 ? 24 : 20}
                      onSegmentClick={handleStatusClick}
                    />
                  )}
                </ResponsiveChart>
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
                          {owner.name || owner.id}
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
                            <div className="font-medium">{owner.name || owner.id}</div>
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
                          <div className="text-sm font-medium text-white">
                            {owner.name || owner.id}
                          </div>
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

        {/* Institutions & Types by Period */}
        <div className="panel panel-solid mb-8 rounded-2xl p-6">
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Учреждения и типы писем по периодам
              </h3>
              <p className="text-sm text-gray-400">
                Письма, сгруппированные по учреждениям и типам писем в разрезе периода.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportOrgTypeCSV}
                disabled={reportExportRows.length === 0 || reportExportHeaders.length === 0}
                className="btn-secondary inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 transition disabled:opacity-50 sm:w-auto"
              >
                <Download className="h-4 w-4" />
                CSV
              </button>
              <button
                onClick={handleExportOrgTypeXLSX}
                disabled={reportExportRows.length === 0 || reportExportHeaders.length === 0}
                className="btn-secondary inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 transition disabled:opacity-50 sm:w-auto"
              >
                <FileSpreadsheet className="h-4 w-4" />
                XLSX
              </button>
              <button
                onClick={handleExportOrgTypePDF}
                disabled={reportExportRows.length === 0 || reportExportHeaders.length === 0}
                className="btn-secondary inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 transition disabled:opacity-50 sm:w-auto"
              >
                <Printer className="h-4 w-4" />
                PDF
              </button>
            </div>
          </div>

          <div className="panel panel-soft mb-6 rounded-xl p-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr,1fr,1fr]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  value={reportSearch}
                  onChange={(event) => setReportSearch(event.target.value)}
                  placeholder="Поиск по учреждениям или типу"
                  className="h-10 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <select
                  value={reportStatusFilter}
                  onChange={(event) =>
                    setReportStatusFilter(event.target.value as LetterStatus | 'all')
                  }
                  className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50"
                >
                  <option value="all">Все статусы</option>
                  {REPORT_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-400" />
                <select
                  value={reportOwnerFilter}
                  onChange={(event) => setReportOwnerFilter(event.target.value)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50"
                >
                  <option value="">Все исполнители</option>
                  <option value="unassigned">Без исполнителя</option>
                  {reportOwnerOptions
                    .filter((owner) => owner.id)
                    .map((owner) => (
                      <option key={owner.id || 'unknown'} value={owner.id || ''}>
                        {owner.name || owner.id}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr,1fr]">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-400" />
                <select
                  value={reportOrgFilter}
                  onChange={(event) => setReportOrgFilter(event.target.value)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50"
                >
                  <option value="">Все учреждения</option>
                  {reportOrgOptions.map((org) => (
                    <option key={org} value={org}>
                      {org}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-gray-400" />
                <select
                  value={reportTypeFilter}
                  onChange={(event) => setReportTypeFilter(event.target.value)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50"
                >
                  <option value="">Все типы</option>
                  {reportTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-gray-400">Группировка</span>
              <button
                onClick={() => setReportGroupBy('orgType')}
                className={`app-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                  reportGroupBy === 'orgType' ? 'app-chip-active' : ''
                }`}
              >
                Учреждение + тип
              </button>
              <button
                onClick={() => setReportGroupBy('org')}
                className={`app-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                  reportGroupBy === 'org' ? 'app-chip-active' : ''
                }`}
              >
                Учреждение
              </button>
              <button
                onClick={() => setReportGroupBy('type')}
                className={`app-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                  reportGroupBy === 'type' ? 'app-chip-active' : ''
                }`}
              >
                Тип
              </button>
              <span className="ml-2 text-xs uppercase tracking-wide text-gray-400">Период</span>
              <button
                onClick={() => setReportGranularity('month')}
                className={`app-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                  reportGranularity === 'month' ? 'app-chip-active' : ''
                }`}
              >
                Месяц
              </button>
              <button
                onClick={() => setReportGranularity('quarter')}
                className={`app-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                  reportGranularity === 'quarter' ? 'app-chip-active' : ''
                }`}
              >
                Квартал
              </button>
              <button
                onClick={() => setReportGranularity('week')}
                className={`app-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                  reportGranularity === 'week' ? 'app-chip-active' : ''
                }`}
              >
                Неделя
              </button>
              <span className="ml-2 text-xs uppercase tracking-wide text-gray-400">Вид</span>
              <button
                onClick={() => setReportView('cards')}
                className={`app-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                  reportView === 'cards' ? 'app-chip-active' : ''
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                Карточки
              </button>
              <button
                onClick={() => setReportView('table')}
                className={`app-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                  reportView === 'table' ? 'app-chip-active' : ''
                }`}
              >
                <Table className="h-4 w-4" />
                Таблица
              </button>
              <button
                onClick={() => setReportView('heatmap')}
                className={`app-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                  reportView === 'heatmap' ? 'app-chip-active' : ''
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                Теплокарта
              </button>
              {reportHasFilters && (
                <button
                  onClick={handleReportReset}
                  className="btn-ghost inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition"
                >
                  <X className="h-4 w-4" />
                  Сбросить фильтры
                </button>
              )}
            </div>

            {reportHasFilters && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                {reportStatusFilter !== 'all' && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                    Статус: {reportStatusLabel}
                  </span>
                )}
                {reportOwnerFilter && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                    Исполнитель: {reportOwnerLabel}
                  </span>
                )}
                {reportOrgFilter && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                    Учреждение: {reportOrgFilter}
                  </span>
                )}
                {reportTypeFilter && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                    Тип: {reportTypeFilter}
                  </span>
                )}
                {reportSearch && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                    Поиск: {reportSearch}
                  </span>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-400">
              <span className="uppercase tracking-wide">Экспорт</span>
              {(
                [
                  { key: 'period', label: 'Период' },
                  { key: 'org', label: 'Учреждение' },
                  { key: 'type', label: 'Тип письма' },
                  { key: 'status', label: 'Статус' },
                  { key: 'owner', label: 'Исполнитель' },
                  { key: 'count', label: 'Количество' },
                ] as const
              ).map((column) => (
                <label
                  key={column.key}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1"
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-emerald-500"
                    checked={reportExportColumns[column.key]}
                    onChange={(event) =>
                      setReportExportColumns((prev) => ({
                        ...prev,
                        [column.key]: event.target.checked,
                      }))
                    }
                  />
                  {column.label}
                </label>
              ))}
            </div>
          </div>

          {reportAggregates.length > 0 ? (
            <>
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <div className="panel panel-soft rounded-xl p-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <FileText className="h-4 w-4 text-emerald-400" />
                    Всего писем
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {reportSummary.total}
                  </div>
                </div>
                <div className="panel panel-soft rounded-xl p-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Filter className="h-4 w-4 text-sky-400" />
                    Группы
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {reportSummary.groupCount}
                  </div>
                </div>
                <div className="panel panel-soft rounded-xl p-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Building2 className="h-4 w-4 text-amber-400" />
                    Учреждения
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {reportSummary.orgCount}
                  </div>
                </div>
                <div className="panel panel-soft rounded-xl p-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Layers className="h-4 w-4 text-purple-400" />
                    Типы
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {reportSummary.typeCount}
                  </div>
                </div>
                <div className="panel panel-soft rounded-xl p-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Calendar className="h-4 w-4 text-emerald-400" />
                    Периоды
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {reportSummary.periodCount}
                  </div>
                </div>
              </div>

              {reportView === 'cards' && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {reportPeriodGroups.map((group) => {
                    const isExpanded = !!expandedReportPeriods[group.periodKey]
                    const rowsToShow = isExpanded
                      ? group.rows
                      : group.rows.slice(0, orgTypePreviewLimit)
                    const hasMore = group.rows.length > orgTypePreviewLimit
                    return (
                      <div key={group.periodKey} className="panel panel-soft rounded-xl p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-gray-500">
                              Период
                            </div>
                            <div className="text-base font-semibold text-white">
                              {group.periodLabel}
                            </div>
                          </div>
                          <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-300">
                            {group.totalCount} писем
                          </span>
                        </div>

                        <div className="mt-4 space-y-3">
                          {rowsToShow.map((row) => {
                            const percent =
                              group.maxCount > 0 ? (row.count / group.maxCount) * 100 : 0
                            const secondary =
                              reportGroupBy === 'orgType' ? row.type : row.secondaryLabel
                            return (
                              <button
                                key={`${group.periodKey}-${row.groupKey}`}
                                onClick={() => handleReportDrilldown(row)}
                                className="group flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-white/5"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-sm text-white">
                                      {row.groupLabel}
                                    </span>
                                    {secondary && (
                                      <span className="truncate text-xs text-gray-500">
                                        {secondary}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
                                    <div
                                      className="h-full rounded-full bg-emerald-500"
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                </div>
                                <div className="w-10 text-right text-sm font-semibold text-white">
                                  {row.count}
                                </div>
                                <ExternalLink className="h-4 w-4 text-gray-600 transition group-hover:text-emerald-400" />
                              </button>
                            )
                          })}
                        </div>

                        {hasMore && (
                          <button
                            onClick={() => toggleReportPeriod(group.periodKey)}
                            className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-400 transition hover:text-emerald-300"
                          >
                            {isExpanded
                              ? 'Скрыть'
                              : `Показать еще ${group.rows.length - orgTypePreviewLimit}`}
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {reportView === 'table' && (
                <div className="panel panel-soft overflow-hidden rounded-xl">
                  <div className="max-h-[520px] overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-gray-900/80 text-xs uppercase tracking-wide text-gray-400 backdrop-blur">
                        <tr>
                          <th className="px-3 py-3 text-left">Период</th>
                          <th className="px-3 py-3 text-left">
                            {reportGroupBy === 'type' ? 'Тип' : 'Учреждение'}
                          </th>
                          <th className="px-3 py-3 text-left">
                            {reportGroupBy === 'orgType'
                              ? 'Тип письма'
                              : reportGroupBy === 'org'
                                ? 'Топ тип'
                                : 'Топ учреждение'}
                          </th>
                          <th className="px-3 py-3 text-right">Количество</th>
                          <th className="px-3 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {reportPeriodGroups.map((group) => (
                          <Fragment key={group.periodKey}>
                            {group.rows.map((row) => {
                              const secondary =
                                reportGroupBy === 'orgType' ? row.type : row.secondaryLabel
                              return (
                                <tr
                                  key={`${group.periodKey}-${row.groupKey}`}
                                  className="cursor-pointer transition hover:bg-white/5"
                                  onClick={() => handleReportDrilldown(row)}
                                >
                                  <td className="px-3 py-2 text-gray-400">{group.periodLabel}</td>
                                  <td className="px-3 py-2 text-white">{row.groupLabel}</td>
                                  <td className="px-3 py-2 text-gray-400">{secondary || 'Нет'}</td>
                                  <td className="px-3 py-2 text-right font-semibold text-white">
                                    {row.count}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <ExternalLink className="h-4 w-4 text-gray-600" />
                                  </td>
                                </tr>
                              )
                            })}
                            <tr className="bg-white/5 text-gray-200">
                              <td className="px-3 py-2 text-xs uppercase" colSpan={3}>
                                Итого за период
                              </td>
                              <td className="px-3 py-2 text-right font-semibold">
                                {group.totalCount}
                              </td>
                              <td className="px-3 py-2"></td>
                            </tr>
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {reportView === 'heatmap' && (
                <div className="panel panel-soft rounded-xl p-4">
                  {reportHeatmap.groups.length === 0 ? (
                    <p className="py-6 text-sm text-gray-500">Нет данных для отображения.</p>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <div
                          className="grid min-w-[640px] gap-2"
                          style={{
                            gridTemplateColumns: `minmax(160px, 1.2fr) repeat(${reportHeatmap.periods.length}, minmax(72px, 1fr))`,
                          }}
                        >
                          <div className="text-xs uppercase tracking-wide text-gray-500">
                            {reportGroupBy === 'type'
                              ? 'Тип'
                              : reportGroupBy === 'org'
                                ? 'Учреждение'
                                : 'Группа'}
                          </div>
                          {reportHeatmap.periods.map((period) => (
                            <div
                              key={period.key}
                              className="text-xs uppercase tracking-wide text-gray-500"
                            >
                              {period.label}
                            </div>
                          ))}

                          {reportHeatmap.groups.slice(0, reportHeatmapLimit).map((group) => (
                            <Fragment key={group.key}>
                              <div className="truncate pr-2 text-sm text-gray-200">
                                {group.label}
                              </div>
                              {reportHeatmap.periods.map((period) => {
                                const count =
                                  reportHeatmap.matrix.get(group.key)?.get(period.key) || 0
                                const intensity =
                                  reportHeatmap.max > 0 ? count / reportHeatmap.max : 0
                                const background =
                                  count === 0
                                    ? 'rgba(255,255,255,0.04)'
                                    : `rgba(16,185,129,${0.2 + intensity * 0.8})`
                                return (
                                  <div
                                    key={`${group.key}-${period.key}`}
                                    title={`${group.label} — ${period.label}: ${count}`}
                                    className="flex h-8 items-center justify-center rounded-md text-xs font-medium text-white"
                                    style={{ backgroundColor: background }}
                                  >
                                    {count > 0 ? count : ''}
                                  </div>
                                )
                              })}
                            </Fragment>
                          ))}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-gray-500">
                        <span>
                          Топ {Math.min(reportHeatmapLimit, reportHeatmap.groups.length)} групп по
                          объему.
                        </span>
                        <span>Интенсивность по количеству писем.</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="py-6 text-sm text-gray-500">Нет данных за выбранный период.</p>
          )}
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



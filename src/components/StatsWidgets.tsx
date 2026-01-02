'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  FileText,
  TrendingUp,
  Users,
  Calendar,
  Loader2,
} from 'lucide-react'

interface StatsResponse {
  summary: {
    total: number
    overdue: number
    urgent: number
    done: number
    inProgress: number
    notReviewed: number
    todayDeadlines: number
    weekDeadlines: number
  }
}

export function StatsWidgets() {
  const [stats, setStats] = useState<StatsResponse['summary'] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats')
        if (res.ok) {
          const data: StatsResponse = await res.json()
          setStats(data.summary)
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    // Refresh every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="flex h-24 items-center justify-center rounded-xl border border-gray-700 bg-gray-800/50"
          >
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ))}
      </div>
    )
  }

  if (!stats) return null

  const widgets = [
    {
      label: 'Просрочено',
      value: stats.overdue,
      icon: AlertTriangle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      link: '/letters?filter=overdue',
    },
    {
      label: 'Срочные (3 дня)',
      value: stats.urgent,
      icon: Clock,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      link: '/letters?filter=urgent',
    },
    {
      label: 'В работе',
      value: stats.inProgress,
      icon: TrendingUp,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      link: '/letters?filter=active',
    },
    {
      label: 'Завершено',
      value: stats.done,
      icon: CheckCircle,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      link: '/letters?filter=done',
    },
  ]

  return (
    <div className="space-y-4">
      {/* Main stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {widgets.map((widget) => (
          <Link
            key={widget.label}
            href={widget.link}
            className={`group rounded-xl border ${widget.border} ${widget.bg} p-4 transition hover:scale-[1.02] hover:shadow-lg`}
          >
            <div className="flex items-center justify-between">
              <widget.icon className={`h-5 w-5 ${widget.color}`} />
              <span className={`text-2xl font-bold ${widget.color}`}>{widget.value}</span>
            </div>
            <p className="mt-2 text-sm text-gray-400 group-hover:text-gray-300">{widget.label}</p>
          </Link>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
          <FileText className="h-5 w-5 text-gray-400" />
          <div>
            <p className="text-lg font-semibold text-white">{stats.total}</p>
            <p className="text-xs text-gray-500">Всего писем</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
          <Calendar className="h-5 w-5 text-orange-400" />
          <div>
            <p className="text-lg font-semibold text-white">{stats.todayDeadlines}</p>
            <p className="text-xs text-gray-500">Дедлайн сегодня</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
          <Users className="h-5 w-5 text-purple-400" />
          <div>
            <p className="text-lg font-semibold text-white">{stats.notReviewed}</p>
            <p className="text-xs text-gray-500">Не рассмотрено</p>
          </div>
        </div>
      </div>
    </div>
  )
}

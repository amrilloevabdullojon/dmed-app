'use client'

import { useEffect, useState } from 'react'
import { Inbox, Clock, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react'

interface RequestStats {
  total: number
  new: number
  inReview: number
  done: number
  urgent: number
  avgResponseTime: number | null // в часах
}

export function RequestStats() {
  const [stats, setStats] = useState<RequestStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch('/api/requests/stats')
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Failed to load stats:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="panel panel-glass rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-20 mb-2" />
            <div className="h-8 bg-gray-700 rounded w-12" />
          </div>
        ))}
      </div>
    )
  }

  if (!stats) return null

  const statCards = [
    {
      label: 'Всего заявок',
      value: stats.total,
      icon: Inbox,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      ringColor: 'ring-blue-400/30',
    },
    {
      label: 'Новые',
      value: stats.new,
      icon: TrendingUp,
      color: 'text-sky-400',
      bgColor: 'bg-sky-500/10',
      ringColor: 'ring-sky-400/30',
      highlight: stats.new > 0,
    },
    {
      label: 'В работе',
      value: stats.inReview,
      icon: Clock,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      ringColor: 'ring-amber-400/30',
    },
    {
      label: 'Завершено',
      value: stats.done,
      icon: CheckCircle,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      ringColor: 'ring-emerald-400/30',
    },
    {
      label: 'Срочные',
      value: stats.urgent,
      icon: AlertTriangle,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      ringColor: 'ring-red-400/30',
      highlight: stats.urgent > 0,
      pulse: stats.urgent > 0,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6 stagger-animation">
      {statCards.map((stat, index) => {
        const Icon = stat.icon
        return (
          <div
            key={stat.label}
            className={`panel panel-glass rounded-xl p-4 hover-lift transition-all ${
              stat.highlight ? 'ring-1 ' + stat.ringColor : ''
            } ${stat.pulse ? 'animate-pulse-slow' : ''}`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-400">{stat.label}</span>
              <div className={`${stat.bgColor} ${stat.color} p-2 rounded-lg`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{stat.value}</span>
              {stat.label === 'Всего заявок' && stats.avgResponseTime !== null && (
                <span className="text-xs text-gray-500">
                  ~{Math.round(stats.avgResponseTime)}ч
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

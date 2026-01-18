'use client'

import { Clock } from 'lucide-react'

interface RequestSLABadgeProps {
  createdAt: string
  status: 'NEW' | 'IN_REVIEW' | 'DONE' | 'SPAM' | 'CANCELLED'
  compact?: boolean
}

export function RequestSLABadge({ createdAt, status, compact = false }: RequestSLABadgeProps) {
  // Не показываем для завершённых/отменённых/спам
  if (status === 'DONE' || status === 'SPAM' || status === 'CANCELLED') {
    return null
  }

  const created = new Date(createdAt).getTime()
  const now = Date.now()
  const hoursElapsed = (now - created) / (1000 * 60 * 60)

  let label: string
  let colorClass: string
  let bgClass: string

  if (hoursElapsed < 24) {
    label = `${Math.floor(hoursElapsed)}ч`
    colorClass = 'text-emerald-300'
    bgClass = 'bg-emerald-500/20'
  } else if (hoursElapsed < 48) {
    label = `${Math.floor(hoursElapsed)}ч`
    colorClass = 'text-amber-300'
    bgClass = 'bg-amber-500/20'
  } else {
    const days = Math.floor(hoursElapsed / 24)
    label = `${days}д`
    colorClass = 'text-red-300'
    bgClass = 'bg-red-500/20'
  }

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${bgClass} ${colorClass}`}>
        <Clock className="w-3 h-3" />
        {label}
      </span>
    )
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium ${bgClass} ${colorClass}`}>
      <Clock className="w-4 h-4" />
      <span>{label} с создания</span>
    </div>
  )
}

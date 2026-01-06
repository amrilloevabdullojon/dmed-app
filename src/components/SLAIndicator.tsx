'use client'

import { useMemo } from 'react'
import { Clock, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { getWorkingDaysUntilDeadline, parseDateValue, pluralizeDays } from '@/lib/utils'

interface SLAIndicatorProps {
  createdAt: string
  deadlineDate: string
  status: string
  closedAt?: string | null
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function SLAIndicator({
  createdAt,
  deadlineDate,
  status,
  closedAt,
  showLabel = true,
  size = 'md',
}: SLAIndicatorProps) {
  const { progress, statusInfo } = useMemo(() => {
    const created = parseDateValue(createdAt)
    const deadline = parseDateValue(deadlineDate)
    const now = new Date()
    const closed = closedAt ? parseDateValue(closedAt) : null

    if (!created || !deadline) {
      return {
        progress: 0,
        daysLeft: 0,
        totalDays: 0,
        isCompleted: false,
        isOverdue: false,
        statusInfo: {
          color: 'text-slate-400',
          bgColor: 'bg-slate-500',
          icon: Clock,
          label: '\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445',
        },
      }
    }

    const totalDaysRaw = getWorkingDaysUntilDeadline(deadline, created)
    const totalDays = Math.max(1, Math.abs(totalDaysRaw))

    const isCompleted = status === 'DONE' || status === 'READY'
    const endDate = closed || now
    const elapsedDaysRaw = getWorkingDaysUntilDeadline(endDate, created)
    const elapsedDays = Math.min(totalDays, Math.max(0, Math.abs(elapsedDaysRaw)))

    const daysLeft = getWorkingDaysUntilDeadline(deadline, now)
    const isOverdue = !isCompleted && daysLeft < 0

    let progress = (elapsedDays / totalDays) * 100
    if (isCompleted && closed) {
      progress = Math.min(100, progress)
    } else if (isOverdue) {
      progress = 100
    }
    progress = Math.min(100, Math.max(0, progress))

    let statusInfo: { color: string; bgColor: string; icon: typeof Clock; label: string }

    if (isCompleted) {
      if (closed && closed <= deadline) {
        statusInfo = {
          color: 'text-emerald-400',
          bgColor: 'bg-emerald-500',
          icon: CheckCircle,
          label: '\u0417\u0430\u043a\u0440\u044b\u0442\u043e \u0432 \u0441\u0440\u043e\u043a',
        }
      } else {
        statusInfo = {
          color: 'text-amber-400',
          bgColor: 'bg-amber-500',
          icon: CheckCircle,
          label:
            '\u0417\u0430\u043a\u0440\u044b\u0442\u043e \u0441 \u043e\u043f\u043e\u0437\u0434\u0430\u043d\u0438\u0435\u043c',
        }
      }
    } else if (isOverdue) {
      const absDays = Math.abs(daysLeft)
      statusInfo = {
        color: 'text-red-400',
        bgColor: 'bg-red-500',
        icon: XCircle,
        label: `\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043e \u043d\u0430 ${absDays} \u0440\u0430\u0431. ${pluralizeDays(absDays)}`,
      }
    } else if (daysLeft <= 2) {
      statusInfo = {
        color: 'text-amber-400',
        bgColor: 'bg-amber-500',
        icon: AlertTriangle,
        label:
          daysLeft === 0
            ? '\u0414\u0435\u0434\u043b\u0430\u0439\u043d \u0441\u0435\u0433\u043e\u0434\u043d\u044f'
            : `\u0414\u043e \u0434\u0435\u0434\u043b\u0430\u0439\u043d\u0430 ${daysLeft} \u0440\u0430\u0431. ${pluralizeDays(daysLeft)}`,
      }
    } else {
      statusInfo = {
        color: 'text-blue-400',
        bgColor: 'bg-blue-500',
        icon: Clock,
        label: `\u0414\u043e \u0434\u0435\u0434\u043b\u0430\u0439\u043d\u0430 ${daysLeft} \u0440\u0430\u0431. ${pluralizeDays(daysLeft)}`,
      }
    }

    return { progress, statusInfo }
  }, [createdAt, deadlineDate, status, closedAt])

  const sizeClasses = {
    sm: { bar: 'h-1.5', icon: 'h-3 w-3', text: 'text-xs' },
    md: { bar: 'h-2', icon: 'h-4 w-4', text: 'text-sm' },
    lg: { bar: 'h-3', icon: 'h-5 w-5', text: 'text-base' },
  }

  const Icon = statusInfo.icon

  return (
    <div className="w-full">
      {showLabel && (
        <div className="mb-2 flex items-center justify-between">
          <div className={`flex items-center gap-2 ${statusInfo.color}`}>
            <Icon className={sizeClasses[size].icon} />
            <span className={`font-medium ${sizeClasses[size].text}`}>{statusInfo.label}</span>
          </div>
          <span className={`text-gray-400 ${sizeClasses[size].text}`}>{Math.round(progress)}%</span>
        </div>
      )}

      <div className={`overflow-hidden rounded-full bg-gray-700 ${sizeClasses[size].bar}`}>
        <div
          className={`${sizeClasses[size].bar} rounded-full transition-all duration-500 ${statusInfo.bgColor}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {showLabel && (
        <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
          <span>
            {'\u0421\u043e\u0437\u0434\u0430\u043d\u043e:'}{' '}
            {new Date(createdAt).toLocaleDateString('ru-RU')}
          </span>
          <span>
            {'\u0414\u0435\u0434\u043b\u0430\u0439\u043d:'}{' '}
            {new Date(deadlineDate).toLocaleDateString('ru-RU')}
          </span>
        </div>
      )}
    </div>
  )
}

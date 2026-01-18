'use client'

import type { SlaStatus } from '@/types/prisma'
import {
  getSlaStatusColor,
  getSlaStatusLabel,
  formatTimeRemaining,
} from '@/lib/request-sla'
import { Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

interface SlaIndicatorProps {
  slaDeadline: string | null
  slaStatus: SlaStatus
  status: string
  size?: 'sm' | 'md' | 'lg'
}

export function SlaIndicator({
  slaDeadline,
  slaStatus,
  status,
  size = 'md',
}: SlaIndicatorProps) {
  if (!slaDeadline) return null

  const deadline = new Date(slaDeadline)
  const timeRemaining = formatTimeRemaining(deadline)
  const color = getSlaStatusColor(slaStatus)
  const label = getSlaStatusLabel(slaStatus)

  const getIcon = () => {
    switch (slaStatus) {
      case 'ON_TIME':
        return <CheckCircle className={getIconSize()} />
      case 'AT_RISK':
        return <AlertTriangle className={getIconSize()} />
      case 'BREACHED':
        return <XCircle className={getIconSize()} />
      default:
        return <Clock className={getIconSize()} />
    }
  }

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'w-3 h-3'
      case 'md':
        return 'w-4 h-4'
      case 'lg':
        return 'w-5 h-5'
      default:
        return 'w-4 h-4'
    }
  }

  const getTextSize = () => {
    switch (size) {
      case 'sm':
        return 'text-xs'
      case 'md':
        return 'text-sm'
      case 'lg':
        return 'text-base'
      default:
        return 'text-sm'
    }
  }

  const getPadding = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-1'
      case 'md':
        return 'px-3 py-1.5'
      case 'lg':
        return 'px-4 py-2'
      default:
        return 'px-3 py-1.5'
    }
  }

  // Если заявка завершена, показываем только статус
  if (status === 'DONE') {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-lg ${getPadding()} ${getTextSize()} font-medium`}
        style={{
          backgroundColor: `${color}22`,
          color: color,
        }}
      >
        {getIcon()}
        <span>{label}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        className={`inline-flex items-center gap-2 rounded-lg ${getPadding()} ${getTextSize()} font-medium`}
        style={{
          backgroundColor: `${color}22`,
          color: color,
        }}
      >
        {getIcon()}
        <span>{label}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        {slaStatus === 'BREACHED' ? timeRemaining : `Осталось: ${timeRemaining}`}
      </div>
    </div>
  )
}



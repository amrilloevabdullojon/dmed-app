'use client'

import type { LetterStatus } from '@prisma/client'
import { STATUS_LABELS } from '@/lib/utils'
import { Circle, CircleDot, Clock, HelpCircle, CheckCircle, CheckCircle2 } from 'lucide-react'

interface StatusBadgeProps {
  status: LetterStatus
  size?: 'sm' | 'md' | 'lg'
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-sm px-2.5 py-1 gap-2',
    lg: 'text-sm px-3 py-1.5 gap-2.5',
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  }

  const statusStyles: Record<
    LetterStatus,
    { bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    NOT_REVIEWED: {
      bg: 'bg-slate-500/10',
      text: 'text-slate-200',
      border: 'border-slate-400/30',
      icon: Circle,
    },
    ACCEPTED: {
      bg: 'bg-sky-500/10',
      text: 'text-sky-200',
      border: 'border-sky-400/30',
      icon: CircleDot,
    },
    IN_PROGRESS: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-200',
      border: 'border-amber-400/30',
      icon: Clock,
    },
    CLARIFICATION: {
      bg: 'bg-cyan-500/10',
      text: 'text-cyan-200',
      border: 'border-cyan-400/30',
      icon: HelpCircle,
    },
    READY: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-200',
      border: 'border-emerald-400/30',
      icon: CheckCircle,
    },
    DONE: {
      bg: 'bg-teal-500/10',
      text: 'text-teal-200',
      border: 'border-teal-400/30',
      icon: CheckCircle2,
    },
  }

  const styles = statusStyles[status]
  const IconComponent = styles.icon

  return (
    <span
      className={`inline-flex flex-shrink-0 items-center whitespace-nowrap rounded-full border font-medium leading-none ${sizeClasses[size]} ${styles.bg} ${styles.text} ${styles.border} shadow-sm`}
    >
      <IconComponent className={iconSizes[size]} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  )
}

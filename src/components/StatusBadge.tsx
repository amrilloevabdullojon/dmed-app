'use client'

import type { LetterStatus } from '@prisma/client'
import { STATUS_LABELS } from '@/lib/utils'

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

  const dotSizes = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-2.5 w-2.5',
  }

  const statusStyles: Record<
    LetterStatus,
    { bg: string; text: string; border: string; dot: string; pulse?: string }
  > = {
    NOT_REVIEWED: {
      bg: 'bg-slate-500/10',
      text: 'text-slate-200',
      border: 'border-slate-400/30',
      dot: 'bg-slate-300',
      pulse: 'status-dot-new',
    },
    ACCEPTED: {
      bg: 'bg-sky-500/10',
      text: 'text-sky-200',
      border: 'border-sky-400/30',
      dot: 'bg-sky-300',
    },
    IN_PROGRESS: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-200',
      border: 'border-amber-400/30',
      dot: 'bg-amber-300',
    },
    CLARIFICATION: {
      bg: 'bg-cyan-500/10',
      text: 'text-cyan-200',
      border: 'border-cyan-400/30',
      dot: 'bg-cyan-300',
    },
    READY: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-200',
      border: 'border-emerald-400/30',
      dot: 'bg-emerald-300',
    },
    DONE: {
      bg: 'bg-teal-500/10',
      text: 'text-teal-200',
      border: 'border-teal-400/30',
      dot: 'bg-teal-300',
    },
  }

  const styles = statusStyles[status]

  return (
    <span
      className={`inline-flex flex-shrink-0 items-center whitespace-nowrap rounded-full border font-medium leading-none ${sizeClasses[size]} ${styles.bg} ${styles.text} ${styles.border} shadow-sm`}
    >
      <span
        className={`${dotSizes[size]} rounded-full ${styles.dot} ${styles.pulse ?? ''}`}
        aria-hidden="true"
      />
      {STATUS_LABELS[status]}
    </span>
  )
}

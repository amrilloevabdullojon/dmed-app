'use client'

import type { LetterStatus } from '@prisma/client'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/utils'

interface StatusBadgeProps {
  status: LetterStatus
  size?: 'sm' | 'md' | 'lg'
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]} ${STATUS_COLORS[status]} shadow-sm backdrop-blur-sm`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

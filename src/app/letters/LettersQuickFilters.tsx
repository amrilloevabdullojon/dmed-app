'use client'

import { memo } from 'react'
import { ScrollIndicator } from '@/components/mobile/ScrollIndicator'
import {
  List,
  AlertTriangle,
  Clock,
  CheckCircle,
  Loader2,
  Star,
  UserCheck,
  UserMinus,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type QuickFilterItem = {
  value: string
  label: string
  icon: LucideIcon
  color: string
  activeColor: string
  bgColor: string
}

export const QUICK_FILTERS: QuickFilterItem[] = [
  {
    value: '',
    label: 'Все письма',
    icon: List,
    color: 'text-slate-400',
    activeColor: 'text-white',
    bgColor: 'bg-slate-600/50',
  },
  {
    value: 'mine',
    label: 'Мои письма',
    icon: UserCheck,
    color: 'text-blue-400',
    activeColor: 'text-white',
    bgColor: 'bg-blue-500/20',
  },
  {
    value: 'unassigned',
    label: 'Без исполнителя',
    icon: UserMinus,
    color: 'text-slate-400',
    activeColor: 'text-white',
    bgColor: 'bg-slate-600/50',
  },
  {
    value: 'favorites',
    label: 'Избранные',
    icon: Star,
    color: 'text-amber-400',
    activeColor: 'text-white',
    bgColor: 'bg-amber-500/20',
  },
  {
    value: 'overdue',
    label: 'Просроченные',
    icon: AlertTriangle,
    color: 'text-red-400',
    activeColor: 'text-white',
    bgColor: 'bg-red-500/20',
  },
  {
    value: 'urgent',
    label: 'Срочно (3 дня)',
    icon: Clock,
    color: 'text-yellow-400',
    activeColor: 'text-white',
    bgColor: 'bg-yellow-500/20',
  },
  {
    value: 'active',
    label: 'В работе',
    icon: Loader2,
    color: 'text-teal-400',
    activeColor: 'text-white',
    bgColor: 'bg-teal-500/20',
  },
  {
    value: 'done',
    label: 'Завершённые',
    icon: CheckCircle,
    color: 'text-emerald-400',
    activeColor: 'text-white',
    bgColor: 'bg-emerald-500/20',
  },
]

interface LettersQuickFiltersProps {
  value: string
  onChange: (value: string) => void
}

export const LettersQuickFilters = memo(function LettersQuickFilters({
  value,
  onChange,
}: LettersQuickFiltersProps) {
  return (
    <div className="mb-4 rounded-2xl bg-gradient-to-r from-slate-800/60 to-slate-800/40 p-3">
      <ScrollIndicator className="no-scrollbar flex gap-2 sm:flex-wrap" showArrows={true}>
        {QUICK_FILTERS.map((filter) => {
          const Icon = filter.icon
          const isActive = value === filter.value
          return (
            <button
              key={filter.value}
              onClick={() => onChange(filter.value)}
              className={`group relative inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200
                ${
                  isActive
                    ? `${filter.bgColor} ${filter.activeColor} shadow-lg ring-1 ring-white/20`
                    : 'bg-slate-700/30 text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }
              `}
              aria-pressed={isActive}
              aria-label={filter.label}
            >
              <span
                className={`flex items-center justify-center rounded-lg p-1 transition-colors
                ${isActive ? 'bg-white/20' : filter.bgColor}
              `}
              >
                <Icon
                  className={`h-4 w-4 transition-colors ${isActive ? filter.activeColor : filter.color}`}
                />
              </span>
              <span>{filter.label}</span>
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-current opacity-50" />
              )}
            </button>
          )
        })}
      </ScrollIndicator>
    </div>
  )
})

'use client'

import { X } from 'lucide-react'

interface ActiveFilter {
  key: string
  label: string
  value: string
  displayValue: string
}

interface ActiveFiltersProps {
  filters: ActiveFilter[]
  onRemove: (key: string) => void
  onClearAll: () => void
}

export function ActiveFilters({ filters, onRemove, onClearAll }: ActiveFiltersProps) {
  if (filters.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="text-xs text-gray-400 font-medium">Активные фильтры:</span>
      {filters.map((filter) => (
        <button
          key={filter.key}
          onClick={() => onRemove(filter.key)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-500/20 text-teal-300 text-xs font-medium hover:bg-teal-500/30 transition-colors group"
        >
          <span className="font-medium">{filter.label}:</span>
          <span>{filter.displayValue}</span>
          <X className="w-3 h-3 group-hover:text-teal-200 transition-colors" />
        </button>
      ))}
      {filters.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-xs text-gray-400 hover:text-white transition-colors underline underline-offset-2"
        >
          Очистить все
        </button>
      )}
    </div>
  )
}

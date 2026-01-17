'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Search,
  X,
  Filter,
  Calendar,
  User,
  Building2,
  FileText,
  ChevronDown,
  RotateCcw,
} from 'lucide-react'
import { hapticLight, hapticMedium } from '@/lib/haptic'
import { useUserPreferences } from '@/hooks/useUserPreferences'

export interface SearchFilters {
  query?: string
  status?: string[]
  priority?: string[]
  owner?: string[]
  organization?: string[]
  dateFrom?: string
  dateTo?: string
  hasFiles?: boolean
  tags?: string[]
  [key: string]: any
}

interface AdvancedSearchProps {
  onSearch: (filters: SearchFilters) => void
  onClear?: () => void
  filters?: SearchFilters
  placeholder?: string
  showFilters?: boolean
  filterOptions?: {
    statuses?: Array<{ value: string; label: string; color?: string }>
    priorities?: Array<{ value: string; label: string; color?: string }>
    owners?: Array<{ value: string; label: string }>
    organizations?: Array<{ value: string; label: string }>
    tags?: Array<{ value: string; label: string }>
  }
  className?: string
  debounceMs?: number
}

export function AdvancedSearch({
  onSearch,
  onClear,
  filters: initialFilters = {},
  placeholder = 'Поиск...',
  showFilters: initialShowFilters = false,
  filterOptions = {},
  className = '',
  debounceMs = 300,
}: AdvancedSearchProps) {
  const { preferences } = useUserPreferences()
  const animationsEnabled = preferences?.animations ?? true

  const [filters, setFilters] = useState<SearchFilters>(initialFilters)
  const [showFilters, setShowFilters] = useState(initialShowFilters)
  const [activeFilterCount, setActiveFilterCount] = useState(0)
  const debounceTimerRef = useRef<NodeJS.Timeout>()

  // Calculate active filter count
  useEffect(() => {
    let count = 0
    if (filters.query && filters.query.trim()) count++
    if (filters.status && filters.status.length > 0) count++
    if (filters.priority && filters.priority.length > 0) count++
    if (filters.owner && filters.owner.length > 0) count++
    if (filters.organization && filters.organization.length > 0) count++
    if (filters.dateFrom || filters.dateTo) count++
    if (filters.hasFiles !== undefined) count++
    if (filters.tags && filters.tags.length > 0) count++
    setActiveFilterCount(count)
  }, [filters])

  const debouncedSearch = useCallback(
    (newFilters: SearchFilters) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        onSearch(newFilters)
      }, debounceMs)
    },
    [onSearch, debounceMs]
  )

  const handleQueryChange = (query: string) => {
    const newFilters = { ...filters, query }
    setFilters(newFilters)
    debouncedSearch(newFilters)
  }

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onSearch(newFilters)
  }

  const toggleArrayFilter = (key: string, value: string) => {
    const currentArray = (filters[key] as string[]) || []
    const newArray = currentArray.includes(value)
      ? currentArray.filter((v) => v !== value)
      : [...currentArray, value]

    const newFilters = { ...filters, [key]: newArray.length > 0 ? newArray : undefined }
    setFilters(newFilters)
    onSearch(newFilters)
  }

  const clearAllFilters = () => {
    hapticMedium()
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    setFilters({})
    onSearch({})
    onClear?.()
  }

  const toggleFilters = () => {
    hapticLight()
    setShowFilters((prev) => !prev)
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filters.query || ''}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={placeholder}
            className="h-10 w-full rounded-lg border border-gray-700/50 bg-gray-800/50 pl-10 pr-10 text-sm text-white placeholder:text-gray-500 focus:border-teal-400/50 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
          />
          {filters.query && (
            <button
              onClick={() => handleQueryChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 transition hover:bg-gray-700/50 hover:text-white"
              aria-label="Очистить поиск"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <button
          onClick={toggleFilters}
          className={`relative flex items-center gap-2 rounded-lg border px-4 text-sm font-medium transition ${
            showFilters
              ? 'border-teal-500/50 bg-teal-500/15 text-teal-300'
              : 'border-gray-700/50 bg-gray-800/50 text-gray-300 hover:border-gray-600/70 hover:text-white'
          }`}
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Фильтры</span>
          {activeFilterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500/20 text-xs text-teal-300">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-2 rounded-lg border border-gray-700/50 bg-gray-800/50 px-4 text-sm font-medium text-gray-300 transition hover:border-gray-600/70 hover:text-white"
            aria-label="Сбросить фильтры"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Сбросить</span>
          </button>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div
          className={`space-y-4 rounded-lg border border-gray-700/50 bg-gray-800/30 p-4 ${
            animationsEnabled ? 'animate-slideDown' : ''
          }`}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Status Filter */}
            {filterOptions.statuses && filterOptions.statuses.length > 0 && (
              <div>
                <label className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-400">
                  <FileText className="h-3.5 w-3.5" />
                  Статус
                </label>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.statuses.map((status) => {
                    const isActive = filters.status?.includes(status.value)
                    return (
                      <button
                        key={status.value}
                        onClick={() => {
                          hapticLight()
                          toggleArrayFilter('status', status.value)
                        }}
                        className={`rounded-full border px-3 py-1 text-xs transition ${
                          isActive
                            ? 'border-teal-500/50 bg-teal-500/15 text-teal-300'
                            : 'border-gray-700/50 text-gray-400 hover:border-gray-600/70 hover:text-gray-200'
                        }`}
                      >
                        {status.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Priority Filter */}
            {filterOptions.priorities && filterOptions.priorities.length > 0 && (
              <div>
                <label className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-400">
                  <ChevronDown className="h-3.5 w-3.5" />
                  Приоритет
                </label>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.priorities.map((priority) => {
                    const isActive = filters.priority?.includes(priority.value)
                    return (
                      <button
                        key={priority.value}
                        onClick={() => {
                          hapticLight()
                          toggleArrayFilter('priority', priority.value)
                        }}
                        className={`rounded-full border px-3 py-1 text-xs transition ${
                          isActive
                            ? 'border-teal-500/50 bg-teal-500/15 text-teal-300'
                            : 'border-gray-700/50 text-gray-400 hover:border-gray-600/70 hover:text-gray-200'
                        }`}
                      >
                        {priority.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Owner Filter */}
            {filterOptions.owners && filterOptions.owners.length > 0 && (
              <div>
                <label className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-400">
                  <User className="h-3.5 w-3.5" />
                  Исполнитель
                </label>
                <select
                  value={filters.owner?.[0] || ''}
                  onChange={(e) => {
                    hapticLight()
                    handleFilterChange('owner', e.target.value ? [e.target.value] : undefined)
                  }}
                  className="h-9 w-full rounded-lg border border-gray-700/50 bg-gray-800/50 px-3 text-sm text-white focus:border-teal-400/50 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
                >
                  <option value="">Все исполнители</option>
                  {filterOptions.owners.map((owner) => (
                    <option key={owner.value} value={owner.value}>
                      {owner.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Organization Filter */}
            {filterOptions.organizations && filterOptions.organizations.length > 0 && (
              <div>
                <label className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-400">
                  <Building2 className="h-3.5 w-3.5" />
                  Учреждение
                </label>
                <select
                  value={filters.organization?.[0] || ''}
                  onChange={(e) => {
                    hapticLight()
                    handleFilterChange(
                      'organization',
                      e.target.value ? [e.target.value] : undefined
                    )
                  }}
                  className="h-9 w-full rounded-lg border border-gray-700/50 bg-gray-800/50 px-3 text-sm text-white focus:border-teal-400/50 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
                >
                  <option value="">Все учреждения</option>
                  {filterOptions.organizations.map((org) => (
                    <option key={org.value} value={org.value}>
                      {org.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Range */}
            <div className="sm:col-span-2">
              <label className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-400">
                <Calendar className="h-3.5 w-3.5" />
                Период
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => {
                    hapticLight()
                    handleFilterChange('dateFrom', e.target.value || undefined)
                  }}
                  className="h-9 flex-1 rounded-lg border border-gray-700/50 bg-gray-800/50 px-3 text-sm text-white focus:border-teal-400/50 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
                  placeholder="От"
                />
                <span className="flex items-center text-gray-500">—</span>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => {
                    hapticLight()
                    handleFilterChange('dateTo', e.target.value || undefined)
                  }}
                  className="h-9 flex-1 rounded-lg border border-gray-700/50 bg-gray-800/50 px-3 text-sm text-white focus:border-teal-400/50 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
                  placeholder="До"
                />
              </div>
            </div>

            {/* Has Files Checkbox */}
            <div className="flex items-center">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={filters.hasFiles || false}
                  onChange={(e) => {
                    hapticLight()
                    handleFilterChange('hasFiles', e.target.checked || undefined)
                  }}
                  className="h-4 w-4 rounded border-gray-700 bg-gray-800 text-teal-500 focus:ring-2 focus:ring-teal-400/20"
                />
                С прикреплёнными файлами
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

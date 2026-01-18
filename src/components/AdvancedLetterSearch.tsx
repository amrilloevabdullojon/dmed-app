'use client'

import { useState, useEffect } from 'react'
import {
  Search,
  X,
  Filter,
  Calendar,
  User,
  Building,
  Tag,
  FileText,
  ChevronDown,
  Download,
  Loader2,
} from 'lucide-react'
import type { LetterStatus } from '@/types/prisma'
import { STATUS_LABELS } from '@/lib/utils'

type SearchFilters = {
  query: string
  status: LetterStatus[]
  ownerId: string
  org: string
  type: string
  tags: string[]
  dateFrom: string
  dateTo: string
  deadlineFrom: string
  deadlineTo: string
  priorityMin: number
  priorityMax: number
  overdue: boolean
  dueToday: boolean
  dueThisWeek: boolean
  hasAnswer: boolean | null
  hasJiraLink: boolean | null
  favorite: boolean
  watching: boolean
}

interface AdvancedLetterSearchProps {
  onSearch: (filters: SearchFilters) => void
  onClear: () => void
  initialFilters?: Partial<SearchFilters>
}

export function AdvancedLetterSearch({
  onSearch,
  onClear,
  initialFilters = {},
}: AdvancedLetterSearchProps) {
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    status: [],
    ownerId: '',
    org: '',
    type: '',
    tags: [],
    dateFrom: '',
    dateTo: '',
    deadlineFrom: '',
    deadlineTo: '',
    priorityMin: 0,
    priorityMax: 100,
    overdue: false,
    dueToday: false,
    dueThisWeek: false,
    hasAnswer: null,
    hasJiraLink: null,
    favorite: false,
    watching: false,
    ...initialFilters,
  })

  const [suggestions, setSuggestions] = useState<{
    organizations: Array<{ name: string; count: number }>
    types: Array<{ name: string; count: number }>
  }>({
    organizations: [],
    types: [],
  })

  // Загружаем подсказки
  useEffect(() => {
    loadSuggestions()
  }, [])

  const loadSuggestions = async () => {
    try {
      const res = await fetch('/api/letters/search/suggestions')
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data)
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error)
    }
  }

  const handleSearch = () => {
    onSearch(filters)
  }

  const handleClear = () => {
    setFilters({
      query: '',
      status: [],
      ownerId: '',
      org: '',
      type: '',
      tags: [],
      dateFrom: '',
      dateTo: '',
      deadlineFrom: '',
      deadlineTo: '',
      priorityMin: 0,
      priorityMax: 100,
      overdue: false,
      dueToday: false,
      dueThisWeek: false,
      hasAnswer: null,
      hasJiraLink: null,
      favorite: false,
      watching: false,
    })
    onClear()
  }

  const hasActiveFilters =
    filters.query ||
    filters.status.length > 0 ||
    filters.org ||
    filters.type ||
    filters.tags.length > 0 ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.deadlineFrom ||
    filters.deadlineTo ||
    filters.overdue ||
    filters.dueToday ||
    filters.dueThisWeek ||
    filters.hasAnswer !== null ||
    filters.hasJiraLink !== null ||
    filters.favorite ||
    filters.watching

  const activeFilterCount = [
    filters.status.length > 0,
    filters.org,
    filters.type,
    filters.tags.length > 0,
    filters.dateFrom || filters.dateTo,
    filters.deadlineFrom || filters.deadlineTo,
    filters.overdue,
    filters.dueToday,
    filters.dueThisWeek,
    filters.hasAnswer !== null,
    filters.hasJiraLink !== null,
    filters.favorite,
    filters.watching,
  ].filter(Boolean).length

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      {/* Main Search Bar */}
      <div className="p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={filters.query}
              onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Поиск по номеру, организации, содержанию..."
              className="w-full pl-10 pr-10 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            {filters.query && (
              <button
                onClick={() => setFilters({ ...filters, query: '' })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition ${
              showFilters || hasActiveFilters
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Filter className="w-5 h-5" />
            Фильтры
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-white text-blue-600 text-xs font-bold rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button
            onClick={handleSearch}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
          >
            Искать
          </button>

          {hasActiveFilters && (
            <button
              onClick={handleClear}
              className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition"
            >
              Сбросить
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="p-4 pt-0 space-y-4">
          <div className="h-px bg-gray-700" />

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Статус</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_LABELS).map(([status, label]) => (
                <button
                  key={status}
                  onClick={() => {
                    const newStatus = filters.status.includes(status as LetterStatus)
                      ? filters.status.filter((s) => s !== status)
                      : [...filters.status, status as LetterStatus]
                    setFilters({ ...filters, status: newStatus })
                  }}
                  className={`px-3 py-1.5 text-sm rounded transition ${
                    filters.status.includes(status as LetterStatus)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Organization and Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Building className="inline w-4 h-4 mr-1" />
                Организация
              </label>
              <input
                type="text"
                value={filters.org}
                onChange={(e) => setFilters({ ...filters, org: e.target.value })}
                list="organizations"
                placeholder="Введите название"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <datalist id="organizations">
                {suggestions.organizations.map((org) => (
                  <option key={org.name} value={org.name}>
                    {org.name} ({org.count})
                  </option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <FileText className="inline w-4 h-4 mr-1" />
                Тип запроса
              </label>
              <input
                type="text"
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                list="types"
                placeholder="Введите тип"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <datalist id="types">
                {suggestions.types.map((type) => (
                  <option key={type.name} value={type.name}>
                    {type.name} ({type.count})
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          {/* Date Ranges */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                Дата письма
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                />
                <span className="text-gray-400 self-center">—</span>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                Дедлайн
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={filters.deadlineFrom}
                  onChange={(e) => setFilters({ ...filters, deadlineFrom: e.target.value })}
                  className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                />
                <span className="text-gray-400 self-center">—</span>
                <input
                  type="date"
                  value={filters.deadlineTo}
                  onChange={(e) => setFilters({ ...filters, deadlineTo: e.target.value })}
                  className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Quick Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Быстрые фильтры
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilters({ ...filters, overdue: !filters.overdue })}
                className={`px-3 py-1.5 text-sm rounded transition ${
                  filters.overdue
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                🚨 Просроченные
              </button>
              <button
                onClick={() => setFilters({ ...filters, dueToday: !filters.dueToday })}
                className={`px-3 py-1.5 text-sm rounded transition ${
                  filters.dueToday
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                ⏰ Сегодня
              </button>
              <button
                onClick={() => setFilters({ ...filters, dueThisWeek: !filters.dueThisWeek })}
                className={`px-3 py-1.5 text-sm rounded transition ${
                  filters.dueThisWeek
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                📅 На этой неделе
              </button>
              <button
                onClick={() =>
                  setFilters({ ...filters, hasAnswer: filters.hasAnswer === true ? null : true })
                }
                className={`px-3 py-1.5 text-sm rounded transition ${
                  filters.hasAnswer === true
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                ✅ С ответом
              </button>
              <button
                onClick={() =>
                  setFilters({
                    ...filters,
                    hasAnswer: filters.hasAnswer === false ? null : false,
                  })
                }
                className={`px-3 py-1.5 text-sm rounded transition ${
                  filters.hasAnswer === false
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                ⏳ Без ответа
              </button>
              <button
                onClick={() => setFilters({ ...filters, favorite: !filters.favorite })}
                className={`px-3 py-1.5 text-sm rounded transition ${
                  filters.favorite
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                ⭐ Избранные
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



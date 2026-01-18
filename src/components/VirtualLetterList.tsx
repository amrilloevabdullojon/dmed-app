'use client'

import { useRef, useMemo, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { LetterCard } from './LetterCard'
import { StatusBadge } from './StatusBadge'
import type { LetterStatus } from '@/types/prisma'
import { ArrowDown, ArrowUp, ArrowUpDown, CheckSquare, Eye, Square } from 'lucide-react'
import { formatDate, getWorkingDaysUntilDeadline, isDoneStatus, pluralizeDays } from '@/lib/utils'

interface Letter {
  id: string
  number: string
  org: string
  date: Date | string
  deadlineDate: Date | string
  status: LetterStatus
  type?: string | null
  content?: string | null
  priority: number
  isFavorite?: boolean
  owner?: {
    name?: string | null
    email?: string | null
  } | null
  _count?: {
    comments: number
    watchers: number
  }
}

type SortField = 'created' | 'deadline' | 'date' | 'number' | 'org' | 'status' | 'priority'

interface VirtualLetterListProps {
  letters: Letter[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleFavorite?: (id: string) => void
}

export function VirtualLetterList({
  letters,
  selectedIds,
  onToggleSelect,
  onToggleFavorite,
}: VirtualLetterListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  // Calculate column count based on width (memoized to prevent recalculation on every render)
  const columnCount = useMemo(() => {
    if (typeof window === 'undefined') return 3
    if (window.innerWidth < 768) return 1
    if (window.innerWidth < 1024) return 2
    return 3
  }, [])

  const rowCount = useMemo(
    () => Math.ceil(letters.length / columnCount),
    [letters.length, columnCount]
  )

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 320, // Approximate card height
    overscan: 3,
  })

  return (
    <div
      ref={parentRef}
      className="virtual-scroll h-[calc(100vh-320px)] overflow-auto pb-24 pr-1 sm:h-[calc(100vh-300px)] sm:pb-0 sm:pr-2"
    >
      <div className="virtual-rows" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount
          const rowLetters = letters.slice(startIndex, startIndex + columnCount)

          return (
            <div
              key={virtualRow.key}
              className="virtual-row"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="stagger-animation grid grid-cols-1 gap-4 px-0 sm:gap-5 sm:px-2 md:grid-cols-2 lg:grid-cols-3">
                {rowLetters.map((letter) => (
                  <div key={letter.id} className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleSelect(letter.id)
                      }}
                      className={`absolute left-3 top-3 z-10 rounded p-2 ${
                        selectedIds.has(letter.id)
                          ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30'
                          : 'bg-white/10 text-slate-300 opacity-100 md:opacity-0 md:group-hover:opacity-100'
                      }`}
                      aria-label={`??????? ?????? ${letter.number}`}
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    <LetterCard letter={letter} onToggleFavorite={onToggleFavorite} />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Virtualized table
interface VirtualLetterTableProps {
  letters: Letter[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onSort: (field: SortField) => void
  sortField: SortField
  sortDirection: 'asc' | 'desc'
  focusedIndex: number
  onRowClick: (id: string) => void
  onPreview: (id: string) => void
}

export function VirtualLetterTable({
  letters,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onSort,
  sortField,
  sortDirection,
  focusedIndex,
  onRowClick,
  onPreview,
}: VirtualLetterTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: letters.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 10,
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 text-slate-400/70" />
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-4 w-4 text-teal-300" />
    ) : (
      <ArrowDown className="h-4 w-4 text-teal-300" />
    )
  }

  const getDeadlineInfo = useCallback((letter: Letter) => {
    const daysLeft = getWorkingDaysUntilDeadline(letter.deadlineDate)
    const isDone = isDoneStatus(letter.status)

    if (isDone) {
      return { text: '\u0413\u043e\u0442\u043e\u0432\u043e', className: 'text-teal-300' }
    }
    if (daysLeft < 0) {
      const absDays = Math.abs(daysLeft)
      return {
        text: `\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043e \u043d\u0430 ${absDays} \u0440\u0430\u0431. ${pluralizeDays(absDays)}`,
        className: 'text-red-400',
      }
    }
    if (daysLeft <= 2) {
      return {
        text: `\u041e\u0441\u0442\u0430\u043b\u043e\u0441\u044c ${daysLeft} \u0440\u0430\u0431. ${pluralizeDays(daysLeft)}`,
        className: 'text-yellow-400',
      }
    }
    return {
      text: `\u041e\u0441\u0442\u0430\u043b\u043e\u0441\u044c ${daysLeft} \u0440\u0430\u0431. ${pluralizeDays(daysLeft)}`,
      className: 'text-slate-300/70',
    }
  }, [])

  return (
    <div className="panel panel-glass overflow-hidden rounded-2xl">
      <div className="grid grid-cols-[40px_140px_minmax(240px,1fr)_120px_180px_140px_140px_160px] gap-2 border-b border-white/10 bg-white/5 px-4 py-3 pr-12 text-sm text-slate-300/80">
        <div className="flex items-center">
          <button
            onClick={onToggleSelectAll}
            className={`rounded p-1 ${
              selectedIds.size === letters.length && letters.length > 0
                ? 'text-teal-300'
                : 'text-slate-400 hover:text-white'
            }`}
            aria-label="\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0432\u0441\u0435 \u043f\u0438\u0441\u044c\u043c\u0430"
          >
            {selectedIds.size === letters.length && letters.length > 0 ? (
              <CheckSquare className="h-5 w-5" />
            ) : (
              <Square className="h-5 w-5" />
            )}
          </button>
        </div>
        <button
          onClick={() => onSort('number')}
          className="flex items-center text-left hover:text-white"
        >
          {'\u041d\u043e\u043c\u0435\u0440'} <SortIcon field="number" />
        </button>
        <button
          onClick={() => onSort('org')}
          className="flex items-center text-left hover:text-white"
        >
          {'\u041e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u044f'}{' '}
          <SortIcon field="org" />
        </button>
        <button
          onClick={() => onSort('date')}
          className="flex items-center text-left hover:text-white"
        >
          {'\u0414\u0430\u0442\u0430'} <SortIcon field="date" />
        </button>
        <button
          onClick={() => onSort('deadline')}
          className="flex items-center text-left hover:text-white"
        >
          {'\u0421\u0440\u043e\u043a'} <SortIcon field="deadline" />
        </button>
        <button
          onClick={() => onSort('status')}
          className="flex items-center text-left hover:text-white"
        >
          {'\u0421\u0442\u0430\u0442\u0443\u0441'} <SortIcon field="status" />
        </button>
        <div className="text-left text-sm font-medium text-slate-300/70">
          {'\u0422\u0438\u043f'}
        </div>
        <div className="text-left text-sm font-medium text-slate-300/70">
          {'\u0418\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c'}
        </div>
      </div>

      <div ref={parentRef} className="virtual-scroll h-[calc(100vh-350px)] overflow-auto">
        <div className="virtual-rows" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const letter = letters[virtualRow.index]
            const deadlineInfo = getDeadlineInfo(letter)
            const isSelected = selectedIds.has(letter.id)
            const isFocused = virtualRow.index === focusedIndex

            return (
              <div
                key={virtualRow.key}
                className={`virtual-row app-row group relative grid cursor-pointer grid-cols-[40px_140px_minmax(240px,1fr)_120px_180px_140px_140px_160px] gap-2 border-b border-white/5 px-4 py-3 pr-12 text-sm ${
                  isSelected ? 'app-row-selected' : ''
                } ${isFocused ? 'ring-2 ring-inset ring-teal-400/40' : ''}`}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => onRowClick(letter.id)}
              >
                <div className="flex items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleSelect(letter.id)
                    }}
                    className={`rounded p-1 ${
                      isSelected ? 'text-teal-300' : 'text-slate-400 hover:text-white'
                    }`}
                    aria-label={`??????? ?????? ${letter.number}`}
                  >
                    {isSelected ? (
                      <CheckSquare className="h-5 w-5" />
                    ) : (
                      <Square className="h-5 w-5" />
                    )}
                  </button>
                </div>
                <div className="truncate font-mono text-teal-300">#{letter.number}</div>
                <div className="truncate text-white">{letter.org}</div>
                <div className="text-sm text-slate-300/70">{formatDate(letter.date)}</div>
                <div>
                  <div className="text-sm">
                    <div className="text-slate-300/70">{formatDate(letter.deadlineDate)}</div>
                    <div className={`text-xs ${deadlineInfo.className}`}>{deadlineInfo.text}</div>
                  </div>
                </div>
                <div>
                  <StatusBadge status={letter.status} size="sm" />
                </div>
                <div className="min-w-0">
                  {letter.type && (
                    <span
                      className="data-pill inline-flex max-w-[140px] truncate rounded-full px-2 py-1 text-xs"
                      title={letter.type}
                    >
                      {letter.type}
                    </span>
                  )}
                </div>
                <div className="truncate text-sm text-slate-300/70">
                  {letter.owner?.name || letter.owner?.email?.split('@')[0] || '-'}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onPreview(letter.id)
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg bg-white/5 p-2 text-slate-400 opacity-100 transition hover:text-white md:opacity-0 md:group-hover:opacity-100"
                  title="\u0411\u044b\u0441\u0442\u0440\u044b\u0439 \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440"
                  aria-label="\u0411\u044b\u0441\u0442\u0440\u044b\u0439 \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}



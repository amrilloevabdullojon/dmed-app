'use client'

import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { LetterCard } from './LetterCard'
import { StatusBadge } from './StatusBadge'
import type { LetterStatus } from '@prisma/client'
import { ArrowDown, ArrowUp, ArrowUpDown, CheckSquare, Eye, Square } from 'lucide-react'
import { formatDate, getDaysUntilDeadline, isDoneStatus, pluralizeDays } from '@/lib/utils'

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

  // Calculate column count based on width
  const getColumnCount = () => {
    if (typeof window === 'undefined') return 3
    if (window.innerWidth < 768) return 1
    if (window.innerWidth < 1024) return 2
    return 3
  }

  const columnCount = getColumnCount()
  const rowCount = Math.ceil(letters.length / columnCount)

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 320, // Approximate card height
    overscan: 3,
  })

  return (
    <div
      ref={parentRef}
      className="h-[calc(100vh-320px)] sm:h-[calc(100vh-300px)] overflow-auto pr-1 sm:pr-2 pb-24 sm:pb-0 virtual-scroll"
    >
      <div
        className="virtual-rows"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 px-0 sm:px-2 stagger-animation">
                {rowLetters.map((letter) => (
                  <div key={letter.id} className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleSelect(letter.id)
                      }}
                      className={`absolute top-3 left-3 z-10 p-2 rounded ${
                        selectedIds.has(letter.id)
                          ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30'
                          : 'bg-white/10 text-slate-300 opacity-100 md:opacity-0 md:group-hover:opacity-100'
                      }`}
                      aria-label={`Выбрать письмо ${letter.number}`}
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    <LetterCard
                      letter={letter}
                      onToggleFavorite={onToggleFavorite}
                    />
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
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 text-slate-400/70" />
    return sortDirection === 'asc'
      ? <ArrowUp className="w-4 h-4 text-teal-300" />
      : <ArrowDown className="w-4 h-4 text-teal-300" />
  }

  const getDeadlineInfo = (letter: Letter) => {
    const daysLeft = getDaysUntilDeadline(letter.deadlineDate)
    const isDone = isDoneStatus(letter.status)

    if (isDone) {
      return { text: '\u0413\u043e\u0442\u043e\u0432\u043e', className: 'text-teal-300' }
    }
    if (daysLeft < 0) {
      return {
        text: `\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043e \u043d\u0430 ${Math.abs(daysLeft)} ${pluralizeDays(daysLeft)}`,
        className: 'text-red-400',
      }
    }
    if (daysLeft <= 2) {
      return {
        text: `\u041e\u0441\u0442\u0430\u043b\u043e\u0441\u044c ${daysLeft} ${pluralizeDays(daysLeft)}`,
        className: 'text-yellow-400',
      }
    }
    return {
      text: `\u041e\u0441\u0442\u0430\u043b\u043e\u0441\u044c ${daysLeft} ${pluralizeDays(daysLeft)}`,
      className: 'text-slate-300/70',
    }
  }

  return (
    <div className="panel panel-glass rounded-2xl overflow-hidden">
      <div className="grid grid-cols-[40px_140px_minmax(240px,1fr)_120px_180px_140px_140px_160px_48px] gap-2 px-4 py-3 bg-white/5 text-sm text-slate-300/80 border-b border-white/10">
        <div className="flex items-center">
          <button
            onClick={onToggleSelectAll}
            className={`p-1 rounded ${
              selectedIds.size === letters.length && letters.length > 0
                ? 'text-teal-300'
                : 'text-slate-400 hover:text-white'
            }`}
            aria-label="\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0432\u0441\u0435 \u043f\u0438\u0441\u044c\u043c\u0430"
          >
            {selectedIds.size === letters.length && letters.length > 0 ? (
              <CheckSquare className="w-5 h-5" />
            ) : (
              <Square className="w-5 h-5" />
            )}
          </button>
        </div>
        <button
          onClick={() => onSort('number')}
          className="text-left hover:text-white flex items-center"
        >
          {'\u041d\u043e\u043c\u0435\u0440'} <SortIcon field="number" />
        </button>
        <button
          onClick={() => onSort('org')}
          className="text-left hover:text-white flex items-center"
        >
          {'\u041e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u044f'} <SortIcon field="org" />
        </button>
        <button
          onClick={() => onSort('date')}
          className="text-left hover:text-white flex items-center"
        >
          {'\u0414\u0430\u0442\u0430'} <SortIcon field="date" />
        </button>
        <button
          onClick={() => onSort('deadline')}
          className="text-left hover:text-white flex items-center"
        >
          {'\u0421\u0440\u043e\u043a'} <SortIcon field="deadline" />
        </button>
        <button
          onClick={() => onSort('status')}
          className="text-left hover:text-white flex items-center"
        >
          {'\u0421\u0442\u0430\u0442\u0443\u0441'} <SortIcon field="status" />
        </button>
        <div className="text-left text-sm font-medium text-slate-300/70">
          {'\u0422\u0438\u043f'}
        </div>
        <div className="text-left text-sm font-medium text-slate-300/70">
          {'\u0418\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c'}
        </div>
        <div />
      </div>

      <div ref={parentRef} className="h-[calc(100vh-350px)] overflow-auto virtual-scroll">
        <div className="virtual-rows" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const letter = letters[virtualRow.index]
            const deadlineInfo = getDeadlineInfo(letter)
            const isSelected = selectedIds.has(letter.id)
            const isFocused = virtualRow.index === focusedIndex

            return (
              <div
                key={virtualRow.key}
                className={`virtual-row grid grid-cols-[40px_140px_minmax(240px,1fr)_120px_180px_140px_140px_160px_48px] gap-2 px-4 py-3 border-b border-white/5 text-sm cursor-pointer app-row ${
                  isSelected ? 'app-row-selected' : ''
                } ${isFocused ? 'ring-2 ring-teal-400/40 ring-inset' : ''}`}
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
                    className={`p-1 rounded ${
                      isSelected ? 'text-teal-300' : 'text-slate-400 hover:text-white'
                    }`}
                    aria-label={`Выбрать письмо ${letter.number}`}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <div className="text-teal-300 font-mono truncate">
                  #{letter.number}
                </div>
                <div className="text-white truncate">
                  {letter.org}
                </div>
                <div className="text-slate-300/70 text-sm">
                  {formatDate(letter.date)}
                </div>
                <div>
                  <div className="text-sm">
                    <div className="text-slate-300/70">{formatDate(letter.deadlineDate)}</div>
                    <div className={`text-xs ${deadlineInfo.className}`}>
                      {deadlineInfo.text}
                    </div>
                  </div>
                </div>
                <div>
                  <StatusBadge status={letter.status} size="sm" />
                </div>
                <div>
                  {letter.type && (
                    <span className="text-xs px-2 py-1 rounded-full data-pill">
                      {letter.type}
                    </span>
                  )}
                </div>
                <div className="text-slate-300/70 text-sm truncate">
                  {letter.owner?.name || letter.owner?.email?.split('@')[0] || '-'}
                </div>
                <div className="flex items-center justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onPreview(letter.id)
                    }}
                    className="p-1 text-slate-400 hover:text-white transition"
                    title="\u0411\u044b\u0441\u0442\u0440\u044b\u0439 \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440"
                    aria-label="\u0411\u044b\u0441\u0442\u0440\u044b\u0439 \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

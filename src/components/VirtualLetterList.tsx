'use client'

import { useRef, useMemo, useCallback, memo, useState, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { LetterCard } from './LetterCard'
import { StatusBadge } from './StatusBadge'
import type { LetterStatus } from '@/types/prisma'
import { ArrowDown, ArrowUp, ArrowUpDown, CheckSquare, Eye, Square } from 'lucide-react'
import { formatDate, getWorkingDaysUntilDeadline, isDoneStatus, pluralizeDays } from '@/lib/utils'
import { usePrefetch } from '@/lib/react-query'

// Hook for responsive column count with ResizeObserver
function useResponsiveColumns(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [columnCount, setColumnCount] = useState(() => {
    if (typeof window === 'undefined') return 3
    if (window.innerWidth < 768) return 1
    if (window.innerWidth < 1024) return 2
    return 3
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateColumns = () => {
      const width = container.offsetWidth
      if (width < 640) {
        setColumnCount(1)
      } else if (width < 1024) {
        setColumnCount(2)
      } else {
        setColumnCount(3)
      }
    }

    // Initial calculation
    updateColumns()

    // Use ResizeObserver for efficient resize detection
    const resizeObserver = new ResizeObserver(() => {
      updateColumns()
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [containerRef])

  return columnCount
}

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

// Memoized card wrapper to prevent unnecessary re-renders
interface CardWrapperProps {
  letter: Letter
  isSelected: boolean
  onToggleSelect: (id: string) => void
  onToggleFavorite?: (id: string) => void
  onPrefetch?: (id: string) => void
}

const CardWrapper = memo(function CardWrapper({
  letter,
  isSelected,
  onToggleSelect,
  onToggleFavorite,
  onPrefetch,
}: CardWrapperProps) {
  return (
    <div className="relative" onMouseEnter={() => onPrefetch?.(letter.id)}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleSelect(letter.id)
        }}
        className={`absolute left-3 top-3 z-10 rounded p-2 ${
          isSelected
            ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30'
            : 'bg-white/10 text-slate-300 opacity-100 md:opacity-0 md:group-hover:opacity-100'
        }`}
        aria-label={`Выбрать письмо ${letter.number}`}
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
  )
})

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
  const { prefetchLetter } = usePrefetch()

  // Use ResizeObserver for responsive column count
  const columnCount = useResponsiveColumns(parentRef)

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
                  <CardWrapper
                    key={letter.id}
                    letter={letter}
                    isSelected={selectedIds.has(letter.id)}
                    onToggleSelect={onToggleSelect}
                    onToggleFavorite={onToggleFavorite}
                    onPrefetch={prefetchLetter}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Get row background based on deadline status
function getRowBgClass(letter: Letter): string {
  const daysLeft = Math.ceil(
    (new Date(letter.deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  const isDone = letter.status === 'DONE' || letter.status === 'READY'

  if (isDone) return 'hover:bg-emerald-500/5'
  if (daysLeft < 0) return 'bg-red-500/5 hover:bg-red-500/10'
  if (daysLeft <= 3) return 'bg-yellow-500/5 hover:bg-yellow-500/10'
  return 'hover:bg-white/5'
}

// Memoized table row
interface TableRowProps {
  letter: Letter
  isSelected: boolean
  isFocused: boolean
  deadlineInfo: { text: string; className: string; isOverdue: boolean; isUrgent: boolean }
  onToggleSelect: (id: string) => void
  onRowClick: (id: string) => void
  onPreview: (id: string) => void
  onPrefetch?: (id: string) => void
  style: React.CSSProperties
}

const TableRow = memo(function TableRow({
  letter,
  isSelected,
  isFocused,
  deadlineInfo,
  onToggleSelect,
  onRowClick,
  onPreview,
  onPrefetch,
  style,
}: TableRowProps) {
  const rowBgClass = getRowBgClass(letter)

  return (
    <div
      className={`virtual-row group relative grid cursor-pointer grid-cols-[40px_140px_minmax(240px,1fr)_120px_180px_140px_140px_160px] gap-2 border-b border-white/5 px-4 py-3 pr-12 text-sm transition-colors duration-150 ${rowBgClass} ${
        isSelected ? 'bg-teal-500/10 ring-1 ring-inset ring-teal-500/30' : ''
      } ${isFocused ? 'bg-teal-500/5 ring-2 ring-inset ring-teal-400/50' : ''}`}
      style={style}
      onClick={() => onRowClick(letter.id)}
      onMouseEnter={() => onPrefetch?.(letter.id)}
    >
      {/* Left border indicator for overdue/urgent */}
      {(deadlineInfo.isOverdue || deadlineInfo.isUrgent) && (
        <div
          className={`absolute bottom-0 left-0 top-0 w-1 ${deadlineInfo.isOverdue ? 'bg-red-500' : 'bg-yellow-500'}`}
        />
      )}

      <div className="flex items-center">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleSelect(letter.id)
          }}
          className={`rounded-lg p-1.5 transition-all ${
            isSelected
              ? 'bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/30'
              : 'text-slate-400 hover:bg-white/10 hover:text-white'
          }`}
          aria-label={`Выбрать письмо ${letter.number}`}
        >
          {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
        </button>
      </div>
      <div className="flex items-center">
        <span className="truncate rounded-lg bg-teal-500/10 px-2 py-1 font-mono text-sm font-semibold text-teal-300 ring-1 ring-teal-500/20">
          #{letter.number}
        </span>
      </div>
      <div className="flex items-center">
        <span className="truncate font-medium text-white transition-colors group-hover:text-teal-200">
          {letter.org}
        </span>
      </div>
      <div className="flex items-center text-sm text-slate-400">{formatDate(letter.date)}</div>
      <div className="flex flex-col justify-center">
        <div className="text-sm text-slate-300">{formatDate(letter.deadlineDate)}</div>
        <div className={`text-xs font-medium ${deadlineInfo.className}`}>{deadlineInfo.text}</div>
      </div>
      <div className="flex items-center">
        <StatusBadge status={letter.status} size="sm" />
      </div>
      <div className="flex min-w-0 items-center">
        {letter.type && (
          <span
            className="inline-flex max-w-[140px] truncate rounded-lg bg-slate-700/50 px-2 py-1 text-xs font-medium text-slate-300 ring-1 ring-slate-600/50"
            title={letter.type}
          >
            {letter.type}
          </span>
        )}
      </div>
      <div className="flex items-center truncate text-sm text-slate-400">
        {letter.owner ? (
          <span className="inline-flex items-center gap-1.5 truncate">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 text-[10px] font-semibold text-blue-300">
              {(letter.owner.name || letter.owner.email || '?')[0].toUpperCase()}
            </span>
            <span className="truncate">
              {letter.owner.name || letter.owner.email?.split('@')[0]}
            </span>
          </span>
        ) : (
          <span className="text-slate-500">—</span>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onPreview(letter.id)
        }}
        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg bg-slate-700/50 p-2 text-slate-400 opacity-100 transition-all hover:bg-teal-500/20 hover:text-teal-300 md:opacity-0 md:group-hover:opacity-100"
        title="Быстрый просмотр"
        aria-label="Быстрый просмотр"
      >
        <Eye className="h-4 w-4" />
      </button>
    </div>
  )
})

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
  const { prefetchLetter } = usePrefetch()

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
      return { text: 'Готово', className: 'text-emerald-400', isOverdue: false, isUrgent: false }
    }
    if (daysLeft < 0) {
      const absDays = Math.abs(daysLeft)
      return {
        text: `Просрочено на ${absDays} раб. ${pluralizeDays(absDays)}`,
        className: 'text-red-400',
        isOverdue: true,
        isUrgent: false,
      }
    }
    if (daysLeft <= 2) {
      return {
        text: `Осталось ${daysLeft} раб. ${pluralizeDays(daysLeft)}`,
        className: 'text-yellow-400',
        isOverdue: false,
        isUrgent: true,
      }
    }
    return {
      text: `Осталось ${daysLeft} раб. ${pluralizeDays(daysLeft)}`,
      className: 'text-slate-400',
      isOverdue: false,
      isUrgent: false,
    }
  }, [])

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/30">
      {/* Sticky header with blur effect */}
      <div className="sticky top-0 z-10 grid grid-cols-[40px_140px_minmax(240px,1fr)_120px_180px_140px_140px_160px] gap-2 border-b border-slate-700/50 bg-slate-800/95 px-4 py-3 pr-12 text-sm font-medium backdrop-blur-sm">
        <div className="flex items-center">
          <button
            onClick={onToggleSelectAll}
            className={`rounded-lg p-1.5 transition-all ${
              selectedIds.size === letters.length && letters.length > 0
                ? 'bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/30'
                : 'text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
            aria-label="Выбрать все письма"
          >
            {selectedIds.size === letters.length && letters.length > 0 ? (
              <CheckSquare className="h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </button>
        </div>
        <button
          onClick={() => onSort('number')}
          className="flex items-center gap-1.5 text-left text-slate-300 transition-colors hover:text-white"
        >
          Номер <SortIcon field="number" />
        </button>
        <button
          onClick={() => onSort('org')}
          className="flex items-center gap-1.5 text-left text-slate-300 transition-colors hover:text-white"
        >
          Организация <SortIcon field="org" />
        </button>
        <button
          onClick={() => onSort('date')}
          className="flex items-center gap-1.5 text-left text-slate-300 transition-colors hover:text-white"
        >
          Дата <SortIcon field="date" />
        </button>
        <button
          onClick={() => onSort('deadline')}
          className="flex items-center gap-1.5 text-left text-slate-300 transition-colors hover:text-white"
        >
          Срок <SortIcon field="deadline" />
        </button>
        <button
          onClick={() => onSort('status')}
          className="flex items-center gap-1.5 text-left text-slate-300 transition-colors hover:text-white"
        >
          Статус <SortIcon field="status" />
        </button>
        <div className="flex items-center text-slate-400">Тип</div>
        <div className="flex items-center text-slate-400">Исполнитель</div>
      </div>

      <div ref={parentRef} className="virtual-scroll h-[calc(100vh-350px)] overflow-auto">
        <div className="virtual-rows" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const letter = letters[virtualRow.index]
            const deadlineInfo = getDeadlineInfo(letter)

            return (
              <TableRow
                key={virtualRow.key}
                letter={letter}
                isSelected={selectedIds.has(letter.id)}
                isFocused={virtualRow.index === focusedIndex}
                deadlineInfo={deadlineInfo}
                onToggleSelect={onToggleSelect}
                onRowClick={onRowClick}
                onPreview={onPreview}
                onPrefetch={prefetchLetter}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { LetterCard } from './LetterCard'
import type { LetterStatus } from '@prisma/client'

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

  // Расчёт количества колонок в зависимости от ширины
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
    estimateSize: () => 320, // Примерная высота карточки
    overscan: 3,
  })

  return (
    <div
      ref={parentRef}
      className="h-[calc(100vh-300px)] overflow-auto pr-2 virtual-scroll"
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 px-2 stagger-animation">
                {rowLetters.map((letter) => (
                  <div key={letter.id} className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleSelect(letter.id)
                      }}
                      className={`absolute top-3 left-3 z-10 p-1 rounded ${
                        selectedIds.has(letter.id)
                          ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30'
                          : 'bg-white/10 text-slate-300 opacity-0 group-hover:opacity-100'
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

// Виртуализованная таблица
interface VirtualLetterTableProps {
  letters: Letter[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSort: (field: string) => void
  sortField: string
  sortDirection: 'asc' | 'desc'
}

export function VirtualLetterTable({
  letters,
  selectedIds,
  onToggleSelect,
  onSort,
  sortField,
  sortDirection,
}: VirtualLetterTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: letters.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 10,
  })

  const SortIcon = ({ field }: { field: string }) => (
    sortField === field ? (
      sortDirection === 'asc' ? (
        <span className="ml-1">↑</span>
      ) : (
        <span className="ml-1">↓</span>
      )
    ) : null
  )

  return (
    <div className="panel panel-glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-white/5 text-sm text-slate-300/80 border-b border-white/10">
        <div className="col-span-1">
          <input
            type="checkbox"
            className="rounded border-gray-600"
            onChange={() => {}}
            aria-label="Выбрать все письма"
          />
        </div>
        <button
          onClick={() => onSort('number')}
          className="col-span-2 text-left hover:text-white flex items-center"
        >
          Номер <SortIcon field="number" />
        </button>
        <button
          onClick={() => onSort('org')}
          className="col-span-3 text-left hover:text-white flex items-center"
        >
          Организация <SortIcon field="org" />
        </button>
        <button
          onClick={() => onSort('status')}
          className="col-span-2 text-left hover:text-white flex items-center"
        >
          Статус <SortIcon field="status" />
        </button>
        <button
          onClick={() => onSort('deadline')}
          className="col-span-2 text-left hover:text-white flex items-center"
        >
          Дедлайн <SortIcon field="deadline" />
        </button>
        <button
          onClick={() => onSort('priority')}
          className="col-span-2 text-left hover:text-white flex items-center"
        >
          Приоритет <SortIcon field="priority" />
        </button>
      </div>

      {/* Virtual Rows */}
      <div
        ref={parentRef}
        className="h-[calc(100vh-350px)] overflow-auto virtual-scroll"
      >
        <div
          className="virtual-rows"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const letter = letters[virtualRow.index]
            const isSelected = selectedIds.has(letter.id)

            return (
              <div
                key={virtualRow.key}
                className={`virtual-row grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/5 text-sm cursor-pointer app-row ${
                  isSelected ? 'app-row-selected' : ''
                }`}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => window.location.href = `/letters/${letter.id}`}
              >
                <div className="col-span-1 flex items-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation()
                      onToggleSelect(letter.id)
                    }}
                    className="rounded border-gray-600"
                    aria-label={`Выбрать письмо ${letter.number}`}
                  />
                </div>
                <div className="col-span-2 text-teal-300 font-mono truncate">
                  {letter.number}
                </div>
                <div className="col-span-3 text-slate-200 truncate">
                  {letter.org}
                </div>
                <div className="col-span-2">
                  <span className="text-xs px-2 py-1 rounded-full data-pill">
                    {letter.status}
                  </span>
                </div>
                <div className="col-span-2 text-slate-300/70">
                  {new Date(letter.deadlineDate).toLocaleDateString('ru-RU')}
                </div>
                <div className="col-span-2 text-slate-300/70">
                  {letter.priority}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

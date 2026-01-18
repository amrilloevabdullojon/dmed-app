'use client'

import React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { StatusBadge } from './StatusBadge'
import Link from 'next/link'
import { formatDate, getWorkingDaysUntilDeadline } from '@/lib/utils'
import type { LetterStatus } from '@/types/prisma'
import { Skeleton } from './ui/Skeleton'

interface Letter {
  id: string
  number: string
  org: string
  date: string
  deadlineDate: string
  status: LetterStatus
  type: string | null
  priority: number
  owner: {
    name: string | null
    email: string | null
  } | null
}

interface VirtualizedLetterListProps {
  letters: Letter[]
  loading?: boolean
  estimatedItemHeight?: number
}

/**
 * Виртуализированный список писем для оптимизации производительности
 * Рендерит только видимые элементы
 *
 * @example
 * ```tsx
 * <VirtualizedLetterList
 *   letters={letters}
 *   loading={isLoading}
 * />
 * ```
 */
export function VirtualizedLetterList({
  letters,
  loading = false,
  estimatedItemHeight = 80,
}: VirtualizedLetterListProps) {
  const parentRef = React.useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: letters.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedItemHeight,
    overscan: 5, // Рендерим 5 дополнительных элементов сверху и снизу
  })

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <LetterItemSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (letters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <p>Письма не найдены</p>
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className="h-[600px] overflow-auto rounded-lg border border-gray-700/50"
      style={{
        contain: 'strict',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const letter = letters[virtualItem.index]
          const daysLeft = getWorkingDaysUntilDeadline(new Date(letter.deadlineDate))
          const isOverdue = daysLeft < 0
          const isUrgent = daysLeft >= 0 && daysLeft <= 3

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <Link
                href={`/letters/${letter.id}`}
                className="block border-b border-gray-700/50 p-4 transition hover:bg-gray-800/30"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Номер и организация */}
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-emerald-400">
                        {letter.number}
                      </span>
                      <span className="truncate text-sm text-gray-400">{letter.org}</span>
                    </div>

                    {/* Тип */}
                    {letter.type && (
                      <p className="mb-2 text-sm text-gray-300">{letter.type}</p>
                    )}

                    {/* Метаданные */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span>Дата: {formatDate(new Date(letter.date))}</span>
                      <span>•</span>
                      <span
                        className={
                          isOverdue
                            ? 'text-red-400'
                            : isUrgent
                              ? 'text-amber-400'
                              : ''
                        }
                      >
                        Дедлайн: {formatDate(new Date(letter.deadlineDate))}
                        {isOverdue && ` (просрочено на ${Math.abs(daysLeft)} дн.)`}
                        {isUrgent && !isOverdue && ` (осталось ${daysLeft} дн.)`}
                      </span>
                      {letter.owner && (
                        <>
                          <span>•</span>
                          <span>{letter.owner.name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Статус */}
                  <div className="flex-shrink-0">
                    <StatusBadge status={letter.status} />
                  </div>
                </div>
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Skeleton для элемента списка
 */
function LetterItemSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-gray-700/50 p-4">
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-4 w-full max-w-[300px]" />
        <Skeleton className="h-3 w-64" />
      </div>
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  )
}



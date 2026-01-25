'use client'

import { useCallback, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { LetterStatus } from '@/types/prisma'
import { STATUS_LABELS, formatDate, getWorkingDaysUntilDeadline, pluralizeDays } from '@/lib/utils'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  GripVertical,
  MessageSquare,
  Star,
  User,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { useLocalStorage } from '@/hooks/useLocalStorage'

interface Letter {
  id: string
  number: string
  org: string
  date: string
  deadlineDate: string
  status: LetterStatus
  type: string | null
  content: string | null
  priority: number
  owner: {
    id: string
    name: string | null
    email: string | null
  } | null
  _count: {
    comments: number
    watchers: number
  }
}

interface LetterKanbanProps {
  letters: Letter[]
  onStatusChange?: (letterId: string, newStatus: LetterStatus) => Promise<void>
}

const KANBAN_STATUSES: LetterStatus[] = [
  'NOT_REVIEWED',
  'ACCEPTED',
  'IN_PROGRESS',
  'CLARIFICATION',
  'READY',
  'DONE',
]

// WIP лимиты по умолчанию для каждого статуса
const DEFAULT_WIP_LIMITS: Record<LetterStatus, number> = {
  NOT_REVIEWED: 0, // 0 = без лимита
  ACCEPTED: 10,
  IN_PROGRESS: 5,
  CLARIFICATION: 5,
  READY: 10,
  DONE: 0, // 0 = без лимита
}

const STATUS_COLORS: Record<
  LetterStatus,
  { bg: string; border: string; text: string; glow: string }
> = {
  NOT_REVIEWED: {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    text: 'text-gray-400',
    glow: 'shadow-gray-500/20',
  },
  ACCEPTED: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    glow: 'shadow-blue-500/20',
  },
  IN_PROGRESS: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/20',
  },
  CLARIFICATION: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    glow: 'shadow-purple-500/20',
  },
  READY: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/20',
  },
  DONE: {
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/30',
    text: 'text-teal-400',
    glow: 'shadow-teal-500/20',
  },
}

function KanbanCard({
  letter,
  onDragStart,
  isDragging,
}: {
  letter: Letter
  onDragStart: () => void
  isDragging: boolean
}) {
  const router = useRouter()
  const [showActions, setShowActions] = useState(false)
  const daysLeft = getWorkingDaysUntilDeadline(letter.deadlineDate)
  const isOverdue = letter.status !== 'DONE' && daysLeft < 0
  const isUrgent = letter.status !== 'DONE' && daysLeft <= 2 && daysLeft >= 0

  // Определяем стиль карточки в зависимости от приоритета и дедлайна
  const getCardStyle = () => {
    if (isOverdue) {
      return 'border-red-500/40 bg-gradient-to-br from-red-500/10 to-red-900/5 shadow-lg shadow-red-500/10'
    }
    if (isUrgent) {
      return 'border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-amber-900/5 shadow-lg shadow-amber-500/10'
    }
    if (letter.priority > 0) {
      return 'border-amber-400/30 bg-gradient-to-br from-amber-500/5 to-transparent shadow-md shadow-amber-500/5'
    }
    return 'border-white/10 bg-gray-800/80'
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      className={`group relative cursor-pointer rounded-lg border p-3 transition-all duration-200 ${getCardStyle()} ${
        isDragging
          ? 'rotate-2 scale-105 opacity-50 shadow-2xl'
          : 'hover:border-white/20 hover:shadow-lg'
      }`}
    >
      {/* Быстрые действия при наведении */}
      <div
        className={`absolute -right-2 -top-2 z-10 flex gap-1 transition-all duration-200 ${
          showActions ? 'scale-100 opacity-100' : 'pointer-events-none scale-75 opacity-0'
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/letters/${letter.id}`)
          }}
          className="rounded-full bg-emerald-500 p-1.5 text-white shadow-lg transition-colors hover:bg-emerald-600"
          title="Открыть"
        >
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 cursor-grab text-gray-600 opacity-0 transition group-hover:opacity-100" />
          <span className="font-mono text-sm text-emerald-400">#{letter.number}</span>
        </div>
        {letter.priority > 0 && (
          <div className="relative">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <div className="absolute inset-0 animate-ping">
              <Star className="h-4 w-4 fill-amber-400/30 text-amber-400/30" />
            </div>
          </div>
        )}
      </div>

      <h4
        className="mb-2 line-clamp-2 cursor-pointer text-sm font-medium text-white transition-colors hover:text-emerald-400"
        onClick={() => router.push(`/letters/${letter.id}`)}
      >
        {letter.org}
      </h4>

      {letter.content && (
        <p className="mb-3 line-clamp-2 text-xs text-gray-400">{letter.content}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(isOverdue || isUrgent) && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
              isOverdue
                ? 'animate-pulse bg-red-500/20 text-red-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            {isOverdue
              ? `${Math.abs(daysLeft)} раб. ${pluralizeDays(Math.abs(daysLeft))} просрочено`
              : `${daysLeft} раб. ${pluralizeDays(daysLeft)} осталось`}
          </span>
        )}

        {letter.owner && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-700/50 px-2 py-0.5 text-gray-300">
            <User className="h-3 w-3" />
            {letter.owner.name?.split(' ')[0] || 'Назначен'}
          </span>
        )}

        {letter._count.comments > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-blue-400">
            <MessageSquare className="h-3 w-3" />
            {letter._count.comments}
          </span>
        )}

        <span className="ml-auto flex items-center gap-1 text-gray-600">
          <Clock className="h-3 w-3" />
          {formatDate(letter.date)}
        </span>
      </div>
    </div>
  )
}

function KanbanColumn({
  status,
  letters,
  onDrop,
  draggedLetterId,
  onDragStart,
  isCollapsed,
  onToggleCollapse,
  wipLimit,
  overdueCount,
}: {
  status: LetterStatus
  letters: Letter[]
  onDrop: (status: LetterStatus) => void
  draggedLetterId: string | null
  onDragStart: (letterId: string) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  wipLimit: number
  overdueCount: number
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const colors = STATUS_COLORS[status]
  const isOverWipLimit = wipLimit > 0 && letters.length > wipLimit

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      onDrop(status)
    },
    [onDrop, status]
  )

  // Свёрнутая колонка
  if (isCollapsed) {
    return (
      <div
        className={`flex w-12 flex-none cursor-pointer flex-col items-center rounded-xl border transition-colors ${colors.border} ${colors.bg}`}
        onClick={onToggleCollapse}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="py-3">
          <ChevronRight className={`h-4 w-4 ${colors.text}`} />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <span
            className={`-rotate-90 whitespace-nowrap text-xs font-semibold ${colors.text}`}
            style={{ writingMode: 'vertical-rl' }}
          >
            {STATUS_LABELS[status]}
          </span>
        </div>
        <div
          className={`mb-3 rounded-full px-2 py-1 text-xs font-bold ${colors.bg} ${colors.text}`}
        >
          {letters.length}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex w-72 min-w-[280px] flex-none flex-col rounded-xl border transition-all duration-200 ${
        isDragOver
          ? 'border-emerald-500/50 bg-emerald-500/5 shadow-lg shadow-emerald-500/10'
          : isOverWipLimit
            ? 'border-red-500/50 bg-red-500/5'
            : `${colors.border} bg-white/5`
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header - sticky */}
      <div
        className={`sticky top-0 z-10 rounded-t-xl border-b backdrop-blur-sm ${colors.border} ${colors.bg}`}
      >
        <div className="px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleCollapse}
                className="rounded p-0.5 transition-colors hover:bg-white/10"
                title="Свернуть колонку"
              >
                <ChevronLeft className={`h-4 w-4 ${colors.text}`} />
              </button>
              <h3 className={`text-sm font-semibold ${colors.text}`}>{STATUS_LABELS[status]}</h3>
            </div>
            <div className="flex items-center gap-2">
              {overdueCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  {overdueCount}
                </span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  isOverWipLimit ? 'bg-red-500/30 text-red-400' : `${colors.bg} ${colors.text}`
                }`}
              >
                {letters.length}
                {wipLimit > 0 && ` / ${wipLimit}`}
              </span>
            </div>
          </div>
          {isOverWipLimit && (
            <div className="mt-1 flex items-center gap-1 text-xs text-red-400">
              <AlertTriangle className="h-3 w-3" />
              <span>Превышен WIP-лимит!</span>
            </div>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: '65vh' }}>
        {letters.length === 0 ? (
          <div
            className={`rounded-lg border-2 border-dashed py-8 text-center text-sm ${
              isDragOver
                ? 'border-emerald-500/50 text-emerald-400'
                : 'border-gray-700 text-gray-500'
            }`}
          >
            {isDragOver ? 'Отпустите здесь' : 'Нет писем'}
          </div>
        ) : (
          letters.map((letter) => (
            <KanbanCard
              key={letter.id}
              letter={letter}
              onDragStart={() => onDragStart(letter.id)}
              isDragging={draggedLetterId === letter.id}
            />
          ))
        )}
      </div>
    </div>
  )
}

// Компонент прогресс-бара
function ProgressBar({ lettersByStatus }: { lettersByStatus: Record<LetterStatus, Letter[]> }) {
  const total = KANBAN_STATUSES.reduce((sum, status) => sum + lettersByStatus[status].length, 0)
  if (total === 0) return null

  return (
    <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-gray-400">Общий прогресс</span>
        <span className="font-medium text-white">
          {lettersByStatus.DONE.length} из {total} завершено (
          {Math.round((lettersByStatus.DONE.length / total) * 100)}%)
        </span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-gray-800">
        {KANBAN_STATUSES.map((status) => {
          const count = lettersByStatus[status].length
          if (count === 0) return null
          const percentage = (count / total) * 100
          const colors = STATUS_COLORS[status]
          return (
            <div
              key={status}
              className={`${colors.bg} border-r border-gray-900/50 transition-all duration-500 last:border-r-0`}
              style={{ width: `${percentage}%` }}
              title={`${STATUS_LABELS[status]}: ${count}`}
            />
          )
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {KANBAN_STATUSES.map((status) => {
          const count = lettersByStatus[status].length
          if (count === 0) return null
          const colors = STATUS_COLORS[status]
          return (
            <div key={status} className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${colors.bg} ${colors.border} border`} />
              <span className="text-gray-400">
                {STATUS_LABELS[status]}: <span className={colors.text}>{count}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function LetterKanban({ letters, onStatusChange }: LetterKanbanProps) {
  const [draggedLetterId, setDraggedLetterId] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [collapsedColumns, setCollapsedColumns] = useLocalStorage<LetterStatus[]>(
    'kanban-collapsed-columns',
    []
  )

  const lettersByStatus = useMemo(() => {
    return KANBAN_STATUSES.reduce(
      (acc, status) => {
        acc[status] = letters.filter((l) => l.status === status)
        return acc
      },
      {} as Record<LetterStatus, Letter[]>
    )
  }, [letters])

  // Подсчёт просроченных писем по статусам
  const overdueByStatus = useMemo(() => {
    return KANBAN_STATUSES.reduce(
      (acc, status) => {
        if (status === 'DONE') {
          acc[status] = 0
        } else {
          acc[status] = lettersByStatus[status].filter(
            (l) => getWorkingDaysUntilDeadline(l.deadlineDate) < 0
          ).length
        }
        return acc
      },
      {} as Record<LetterStatus, number>
    )
  }, [lettersByStatus])

  const handleDrop = useCallback(
    async (newStatus: LetterStatus) => {
      if (!draggedLetterId || !onStatusChange || updating) return

      const letter = letters.find((l) => l.id === draggedLetterId)
      if (!letter || letter.status === newStatus) {
        setDraggedLetterId(null)
        return
      }

      setUpdating(true)
      try {
        await onStatusChange(draggedLetterId, newStatus)
      } finally {
        setUpdating(false)
        setDraggedLetterId(null)
      }
    },
    [draggedLetterId, letters, onStatusChange, updating]
  )

  const handleDragStart = useCallback((letterId: string) => {
    setDraggedLetterId(letterId)
  }, [])

  const toggleColumnCollapse = useCallback(
    (status: LetterStatus) => {
      setCollapsedColumns((prev) => {
        if (prev.includes(status)) {
          return prev.filter((s) => s !== status)
        }
        return [...prev, status]
      })
    },
    [setCollapsedColumns]
  )

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <ProgressBar lettersByStatus={lettersByStatus} />

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
          {KANBAN_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              letters={lettersByStatus[status]}
              onDrop={handleDrop}
              draggedLetterId={draggedLetterId}
              onDragStart={handleDragStart}
              isCollapsed={collapsedColumns.includes(status)}
              onToggleCollapse={() => toggleColumnCollapse(status)}
              wipLimit={DEFAULT_WIP_LIMITS[status]}
              overdueCount={overdueByStatus[status]}
            />
          ))}
        </div>
      </div>

      {/* Updating indicator */}
      {updating && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 shadow-lg">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span className="text-sm text-white">Обновление...</span>
        </div>
      )}
    </div>
  )
}

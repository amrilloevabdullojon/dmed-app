'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LetterStatus } from '@prisma/client'
import { STATUS_LABELS, formatDate, getWorkingDaysUntilDeadline, pluralizeDays } from '@/lib/utils'
import { AlertTriangle, GripVertical, MessageSquare, Star, User } from 'lucide-react'

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
  jiraLink: string | null
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

const STATUS_COLORS: Record<LetterStatus, { bg: string; border: string; text: string }> = {
  NOT_REVIEWED: { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400' },
  ACCEPTED: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
  IN_PROGRESS: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
  CLARIFICATION: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
  },
  READY: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  DONE: { bg: 'bg-teal-500/10', border: 'border-teal-500/30', text: 'text-teal-400' },
}

function KanbanCard({ letter, onDragStart }: { letter: Letter; onDragStart: () => void }) {
  const router = useRouter()
  const daysLeft = getWorkingDaysUntilDeadline(letter.deadlineDate)
  const isOverdue = letter.status !== 'DONE' && daysLeft < 0
  const isUrgent = letter.status !== 'DONE' && daysLeft <= 2 && daysLeft >= 0

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={() => router.push(`/letters/${letter.id}`)}
      className="group cursor-pointer rounded-lg border border-white/10 bg-gray-800/80 p-3 transition hover:border-white/20 hover:bg-gray-800"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-gray-600 opacity-0 transition group-hover:opacity-100" />
          <span className="font-mono text-sm text-emerald-400">#{letter.number}</span>
        </div>
        {letter.priority > 0 && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
      </div>

      <h4 className="mb-2 line-clamp-2 text-sm font-medium text-white">{letter.org}</h4>

      {letter.content && (
        <p className="mb-3 line-clamp-2 text-xs text-gray-400">{letter.content}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(isOverdue || isUrgent) && (
          <span
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
              isOverdue ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            {isOverdue
              ? `${Math.abs(daysLeft)} раб. ${pluralizeDays(Math.abs(daysLeft))}`
              : `${daysLeft} раб. ${pluralizeDays(daysLeft)}`}
          </span>
        )}

        {letter.owner && (
          <span className="inline-flex items-center gap-1 text-gray-500">
            <User className="h-3 w-3" />
            {letter.owner.name?.split(' ')[0] || 'Назначен'}
          </span>
        )}

        {letter._count.comments > 0 && (
          <span className="inline-flex items-center gap-1 text-gray-500">
            <MessageSquare className="h-3 w-3" />
            {letter._count.comments}
          </span>
        )}

        <span className="ml-auto text-gray-600">{formatDate(letter.date)}</span>
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
}: {
  status: LetterStatus
  letters: Letter[]
  onDrop: (status: LetterStatus) => void
  draggedLetterId: string | null
  onDragStart: (letterId: string) => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const colors = STATUS_COLORS[status]

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

  return (
    <div
      className={`flex w-64 min-w-[240px] flex-none flex-col rounded-xl border transition-colors ${
        isDragOver ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 bg-white/5'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className={`rounded-t-xl border-b ${colors.border} ${colors.bg} px-3 py-2`}>
        <div className="flex items-center justify-between">
          <h3 className={`text-sm font-semibold ${colors.text}`}>{STATUS_LABELS[status]}</h3>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
          >
            {letters.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: '70vh' }}>
        {letters.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">Нет писем</div>
        ) : (
          letters.map((letter) => (
            <KanbanCard
              key={letter.id}
              letter={letter}
              onDragStart={() => onDragStart(letter.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

export function LetterKanban({ letters, onStatusChange }: LetterKanbanProps) {
  const [draggedLetterId, setDraggedLetterId] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  const lettersByStatus = KANBAN_STATUSES.reduce(
    (acc, status) => {
      acc[status] = letters.filter((l) => l.status === status)
      return acc
    },
    {} as Record<LetterStatus, Letter[]>
  )

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

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
        {KANBAN_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            letters={lettersByStatus[status]}
            onDrop={handleDrop}
            draggedLetterId={draggedLetterId}
            onDragStart={handleDragStart}
          />
        ))}
      </div>
    </div>
  )
}

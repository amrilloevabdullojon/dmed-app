'use client'

import type { LetterStatus } from '@prisma/client'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  formatDate,
  getWorkingDaysUntilDeadline,
  pluralizeDays,
  getPriorityLabel,
  isDoneStatus,
} from '@/lib/utils'
import {
  Calendar,
  User,
  MessageSquare,
  Eye,
  AlertTriangle,
  Star,
  Clock,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'

interface LetterCardProps {
  letter: {
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
  onToggleFavorite?: (id: string) => void
}

// Получить процент оставшегося времени до дедлайна
function getDeadlineProgress(deadlineDate: Date | string, createdDate: Date | string): number {
  const now = new Date()
  const deadline = new Date(deadlineDate)
  const created = new Date(createdDate)

  const total = deadline.getTime() - created.getTime()
  const elapsed = now.getTime() - created.getTime()

  if (total <= 0) return 100
  const progress = Math.min(100, Math.max(0, (elapsed / total) * 100))
  return progress
}

// Цвет для приоритета
function getPriorityColor(priority: number): string {
  if (priority >= 5) return 'from-red-500 to-red-600'
  if (priority >= 4) return 'from-orange-500 to-orange-600'
  if (priority >= 3) return 'from-yellow-500 to-yellow-600'
  if (priority >= 2) return 'from-blue-500 to-blue-600'
  return 'from-gray-500 to-gray-600'
}

export function LetterCard({ letter, onToggleFavorite }: LetterCardProps) {
  const daysLeft = getWorkingDaysUntilDeadline(letter.deadlineDate)
  const isDone = isDoneStatus(letter.status)
  const isOverdue = !isDone && daysLeft < 0
  const isUrgent = !isDone && daysLeft <= 2 && daysLeft >= 0
  const priorityInfo = getPriorityLabel(letter.priority)
  const progress = isDone ? 100 : getDeadlineProgress(letter.deadlineDate, letter.date)
  const progressStep = Math.min(100, Math.max(0, Math.round(progress / 5) * 5))

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onToggleFavorite?.(letter.id)
  }

  return (
    <Link
      href={`/letters/${letter.id}`}
      className="panel panel-glass animate-cardIn group relative block overflow-hidden rounded-2xl transition-all
                 duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-teal-500/20"
    >
      {/* Priority indicator bar */}
      <div
        className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${getPriorityColor(letter.priority)}`}
      />

      {/* Favorite button */}
      {onToggleFavorite && (
        <button
          onClick={handleFavoriteClick}
          className={`absolute right-3 top-3 z-10 rounded-full p-2 transition-all duration-200
                     ${
                       letter.isFavorite
                         ? 'bg-amber-500/20 text-amber-300'
                         : 'bg-white/10 text-slate-300 opacity-100 md:opacity-0 md:group-hover:opacity-100'
                     }
                     hover:scale-110 hover:bg-amber-500/30`}
          aria-label={
            letter.isFavorite
              ? '\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0438\u0437 \u0438\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0433\u043e'
              : '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0432 \u0438\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0435'
          }
        >
          <Star className={`h-4 w-4 ${letter.isFavorite ? 'fill-current' : ''}`} />
        </button>
      )}

      <div className="p-5">
        {/* Header */}
        <div className="mb-4 flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span
                className="rounded-full bg-teal-400/10 px-2 py-0.5
                             font-mono text-sm font-semibold text-teal-300"
              >
                #{letter.number}
              </span>
              {letter.type && (
                <span className="data-pill rounded-full px-2 py-0.5 text-xs">{letter.type}</span>
              )}
            </div>
            <h3
              className="line-clamp-2 text-lg font-medium leading-tight text-white
                          transition-colors group-hover:text-teal-200"
            >
              {letter.org}
            </h3>
          </div>
        </div>

        {/* Status badge */}
        <div className="mb-4">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium
                       shadow-sm ${STATUS_COLORS[letter.status]}`}
          >
            {STATUS_LABELS[letter.status]}
          </span>
        </div>

        {/* Content preview */}
        {letter.content && (
          <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-slate-300/80">
            {letter.content}
          </p>
        )}

        {/* Meta info */}
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-300/70">
          <span className="meta-pill flex items-center gap-1.5 rounded px-2 py-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(letter.date)}
          </span>

          {letter.owner && (
            <span className="meta-pill flex items-center gap-1.5 rounded px-2 py-1">
              <User className="h-3.5 w-3.5" />
              {letter.owner.name || letter.owner.email?.split('@')[0]}
            </span>
          )}

          {letter._count && letter._count.comments > 0 && (
            <span className="flex items-center gap-1 text-slate-300/70">
              <MessageSquare className="h-3.5 w-3.5" />
              {letter._count.comments}
            </span>
          )}

          {letter._count && letter._count.watchers > 0 && (
            <span className="flex items-center gap-1 text-slate-300/70">
              <Eye className="h-3.5 w-3.5" />
              {letter._count.watchers}
            </span>
          )}
        </div>

        {/* Deadline section */}
        <div className="border-t border-white/10 pt-4">
          {/* Progress bar */}
          {!isDone && (
            <div className="mb-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 progress-${progressStep} ${
                    isOverdue
                      ? 'bg-gradient-to-r from-red-500 to-red-400'
                      : isUrgent
                        ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                        : 'bg-gradient-to-r from-teal-500 to-emerald-400'
                  }`}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div
              className={`flex items-center gap-1.5 text-sm font-medium ${
                isDone
                  ? 'text-teal-300'
                  : isOverdue
                    ? 'text-red-400'
                    : isUrgent
                      ? 'text-yellow-400'
                      : 'text-slate-300/70'
              }`}
            >
              {isDone ? (
                <>
                  <Clock className="h-4 w-4" />
                  {'\u0413\u043e\u0442\u043e\u0432\u043e'}
                </>
              ) : isOverdue ? (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  {'\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043e \u043d\u0430'}{' '}
                  {Math.abs(daysLeft)} раб. {pluralizeDays(daysLeft)}
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4" />
                  {'\u0414\u043e \u0441\u0440\u043e\u043a\u0430:'} {daysLeft} раб.{' '}
                  {pluralizeDays(daysLeft)}
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`rounded px-2 py-1 text-xs font-semibold ${priorityInfo.color} bg-opacity-20`}
              >
                {priorityInfo.label}
              </span>
              <ArrowRight
                className="h-4 w-4 text-slate-400 opacity-0 transition-all
                                    group-hover:translate-x-1 group-hover:opacity-100"
              />
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

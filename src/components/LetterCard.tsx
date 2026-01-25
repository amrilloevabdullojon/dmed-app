'use client'

import { memo } from 'react'
import type { LetterStatus } from '@/types/prisma'
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
  Sparkles,
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

// Glow цвет в зависимости от статуса дедлайна
function getGlowColor(isOverdue: boolean, isUrgent: boolean, isDone: boolean): string {
  if (isDone) return 'hover:shadow-emerald-500/20'
  if (isOverdue) return 'hover:shadow-red-500/30'
  if (isUrgent) return 'hover:shadow-yellow-500/25'
  return 'hover:shadow-teal-500/20'
}

export const LetterCard = memo(function LetterCard({ letter, onToggleFavorite }: LetterCardProps) {
  const daysLeft = getWorkingDaysUntilDeadline(letter.deadlineDate)
  const isDone = isDoneStatus(letter.status)
  const isOverdue = !isDone && daysLeft < 0
  const isUrgent = !isDone && daysLeft <= 2 && daysLeft >= 0
  const priorityInfo = getPriorityLabel(letter.priority)
  const progress = isDone ? 100 : getDeadlineProgress(letter.deadlineDate, letter.date)
  const progressStep = Math.min(100, Math.max(0, Math.round(progress / 5) * 5))
  const glowColor = getGlowColor(isOverdue, isUrgent, isDone)

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onToggleFavorite?.(letter.id)
  }

  return (
    <Link
      href={`/letters/${letter.id}`}
      className={`group relative block overflow-hidden rounded-2xl border transition-all duration-300
                 hover:-translate-y-1 hover:shadow-2xl ${glowColor}
                 ${
                   isOverdue
                     ? 'border-red-500/30 bg-gradient-to-br from-slate-800/90 via-slate-800/80 to-red-950/30'
                     : isUrgent
                       ? 'border-yellow-500/20 bg-gradient-to-br from-slate-800/90 via-slate-800/80 to-yellow-950/20'
                       : isDone
                         ? 'border-emerald-500/20 bg-gradient-to-br from-slate-800/90 via-slate-800/80 to-emerald-950/20'
                         : 'border-slate-700/50 bg-gradient-to-br from-slate-800/90 to-slate-800/70'
                 }`}
    >
      {/* Priority indicator bar with glow */}
      <div
        className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${getPriorityColor(letter.priority)}`}
      />
      {letter.priority >= 4 && (
        <div
          className={`absolute left-0 right-0 top-0 h-8 bg-gradient-to-b ${
            letter.priority >= 5 ? 'from-red-500/10' : 'from-orange-500/10'
          } to-transparent`}
        />
      )}

      {/* Urgent/Overdue indicator */}
      {(isOverdue || isUrgent) && (
        <div className="absolute right-12 top-3 z-10">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold
            ${
              isOverdue
                ? 'animate-pulse bg-red-500/20 text-red-300'
                : 'bg-yellow-500/20 text-yellow-300'
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            {isOverdue ? 'Просрочено' : 'Срочно'}
          </span>
        </div>
      )}

      {/* Favorite button */}
      {onToggleFavorite && (
        <button
          onClick={handleFavoriteClick}
          className={`absolute right-3 top-3 z-10 rounded-full p-2 transition-all duration-200
                     ${
                       letter.isFavorite
                         ? 'bg-amber-500/20 text-amber-300 shadow-lg shadow-amber-500/20'
                         : 'bg-white/10 text-slate-300 opacity-100 md:opacity-0 md:group-hover:opacity-100'
                     }
                     hover:scale-110 hover:bg-amber-500/30`}
          aria-label={letter.isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
        >
          <Star
            className={`h-4 w-4 transition-transform ${letter.isFavorite ? 'scale-110 fill-current' : 'group-hover:scale-110'}`}
          />
        </button>
      )}

      <div className="p-5">
        {/* Header */}
        <div className="mb-4 flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-teal-500/20 to-emerald-500/20 px-2.5 py-1
                             font-mono text-sm font-semibold text-teal-300 ring-1 ring-teal-500/30"
              >
                <span className="text-teal-400/60">#</span>
                {letter.number}
              </span>
              {letter.type && (
                <span className="rounded-lg bg-slate-700/50 px-2 py-1 text-xs font-medium text-slate-300 ring-1 ring-slate-600/50">
                  {letter.type}
                </span>
              )}
            </div>
            <h3
              className="line-clamp-2 text-lg font-semibold leading-tight text-white
                          transition-colors group-hover:text-teal-200"
            >
              {letter.org}
            </h3>
          </div>
        </div>

        {/* Status badge */}
        <div className="mb-4">
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold
                       shadow-sm ring-1 ring-white/10 ${STATUS_COLORS[letter.status]}`}
          >
            {isDone && <Sparkles className="h-3 w-3" />}
            {STATUS_LABELS[letter.status]}
          </span>
        </div>

        {/* Content preview */}
        {letter.content && (
          <p className="mb-4 line-clamp-2 rounded-lg bg-slate-700/20 p-2.5 text-sm leading-relaxed text-slate-300/80">
            {letter.content}
          </p>
        )}

        {/* Meta info */}
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700/40 px-2.5 py-1.5 text-slate-300">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            {formatDate(letter.date)}
          </span>

          {letter.owner && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-2.5 py-1.5 text-blue-300 ring-1 ring-blue-500/20">
              <User className="h-3.5 w-3.5" />
              {letter.owner.name || letter.owner.email?.split('@')[0]}
            </span>
          )}

          {letter._count && letter._count.comments > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-700/40 px-2 py-1.5 text-slate-300">
              <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
              {letter._count.comments}
            </span>
          )}

          {letter._count && letter._count.watchers > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-700/40 px-2 py-1.5 text-slate-300">
              <Eye className="h-3.5 w-3.5 text-slate-400" />
              {letter._count.watchers}
            </span>
          )}
        </div>

        {/* Deadline section */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-3">
          {/* Progress bar */}
          {!isDone && (
            <div className="mb-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Прогресс
                </span>
                <span className="text-[10px] font-semibold text-slate-400">{progressStep}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-700/50">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out progress-${progressStep} ${
                    isOverdue
                      ? 'bg-gradient-to-r from-red-600 via-red-500 to-red-400 shadow-sm shadow-red-500/50'
                      : isUrgent
                        ? 'bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-400 shadow-sm shadow-yellow-500/50'
                        : 'bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-400 shadow-sm shadow-teal-500/30'
                  }`}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium ${
                isDone
                  ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20'
                  : isOverdue
                    ? 'bg-red-500/10 text-red-300 ring-1 ring-red-500/20'
                    : isUrgent
                      ? 'bg-yellow-500/10 text-yellow-300 ring-1 ring-yellow-500/20'
                      : 'bg-slate-700/50 text-slate-300'
              }`}
            >
              {isDone ? (
                <>
                  <Sparkles className="h-4 w-4" />
                  Готово
                </>
              ) : isOverdue ? (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  Просрочено на {Math.abs(daysLeft)} раб. {pluralizeDays(daysLeft)}
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4" />
                  До срока: {daysLeft} раб. {pluralizeDays(daysLeft)}
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`rounded-lg px-2 py-1 text-xs font-semibold ring-1 ring-white/10 ${priorityInfo.color} bg-opacity-20`}
              >
                {priorityInfo.label}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700/50 transition-all group-hover:bg-teal-500/20">
                <ArrowRight
                  className="h-4 w-4 text-slate-400 transition-all
                                      group-hover:translate-x-0.5 group-hover:text-teal-400"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
})

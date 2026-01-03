'use client'

import { useEffect } from 'react'
import { StatusBadge } from './StatusBadge'
import {
  X,
  Loader2,
  Calendar,
  Clock,
  User,
  ExternalLink,
  Copy,
  Star,
  Printer,
  ArrowRight,
} from 'lucide-react'
import { formatDate, getDaysUntilDeadline, pluralizeDays, isDoneStatus, STATUS_LABELS } from '@/lib/utils'
import type { LetterStatus } from '@prisma/client'
import Link from 'next/link'
import { useLetter } from '@/hooks/useLetters'

interface LetterPreviewProps {
  letterId: string | null
  onClose: () => void
}

interface Letter {
  id: string
  number: string
  org: string
  date: string
  deadlineDate: string
  status: LetterStatus
  type: string | null
  content: string | null
  comment: string | null
  contacts: string | null
  jiraLink: string | null
  zordoc: string | null
  answer: string | null
  owner: {
    name: string | null
    email: string | null
  } | null
}

export function LetterPreview({ letterId, onClose }: LetterPreviewProps) {
  const { data, isLoading } = useLetter(letterId)
  const letter = letterId ? (data as Letter | null) : null

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  if (!letterId) return null

  const daysLeft = letter ? getDaysUntilDeadline(letter.deadlineDate) : 0
  const isDone = letter ? isDoneStatus(letter.status) : false
  const isOverdue = !isDone && daysLeft < 0

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-gray-800 border-l border-gray-700 shadow-2xl z-50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">{'\u0411\u044b\u0441\u0442\u0440\u044b\u0439 \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440'}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : letter ? (
            <div className="space-y-6">
              {/* Title */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-lg text-emerald-400">
                    #{letter.number}
                  </span>
                  <StatusBadge status={letter.status} size="sm" />
                </div>
                <h3 className="text-xl font-bold text-white">{letter.org}</h3>
              </div>

              {/* Deadline */}
              <div className={`p-3 rounded-lg ${
                isDone
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : isOverdue
                    ? 'bg-red-500/20 text-red-400'
                    : daysLeft <= 2
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-gray-700 text-gray-300'
              }`}>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{isDone
                      ? '\u0413\u043e\u0442\u043e\u0432\u043e'
                      : isOverdue
                        ? `\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043e \u043d\u0430 ${Math.abs(daysLeft)} ${pluralizeDays(daysLeft)}`
                        : `\u0414\u043e \u0441\u0440\u043e\u043a\u0430: ${daysLeft} ${pluralizeDays(daysLeft)}`}</span>
                </div>
              </div>

              {/* Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <div>
                    <div className="text-xs">{'\u0414\u0430\u0442\u0430 \u043f\u0438\u0441\u044c\u043c\u0430'}</div>
                    <div className="text-white">{formatDate(letter.date)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <Clock className="w-4 h-4" />
                  <div>
                    <div className="text-xs">{'\u0421\u0440\u043e\u043a'}</div>
                    <div className={isOverdue ? 'text-red-400' : 'text-white'}>
                      {formatDate(letter.deadlineDate)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Owner */}
              {letter.owner && (
                <div className="flex items-center gap-2 text-gray-400">
                  <User className="w-4 h-4" />
                  <span>{'\u0418\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c:'}</span>
                  <span className="text-white">
                    {letter.owner.name || letter.owner.email}
                  </span>
                </div>
              )}

              {/* Type */}
              {letter.type && (
                <div>
                  <span className="text-xs px-2 py-1 bg-gray-700 rounded text-gray-400">
                    {letter.type}
                  </span>
                </div>
              )}

              {/* Content */}
              {letter.content && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">{'\u0421\u043e\u0434\u0435\u0440\u0436\u0430\u043d\u0438\u0435'}</h4>
                  <p className="text-white whitespace-pre-wrap text-sm">{letter.content}</p>
                </div>
              )}

              {/* Answer */}
              {letter.answer && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Ответ</h4>
                  <p className="text-white whitespace-pre-wrap text-sm">{letter.answer}</p>
                </div>
              )}

              {/* Jira */}
              {letter.jiraLink && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Jira</h4>
                  <a
                    href={letter.jiraLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {letter.jiraLink}
                  </a>
                </div>
              )}

              {/* Comment */}
              {letter.comment && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Комментарий</h4>
                  <p className="text-gray-300 whitespace-pre-wrap text-sm">{letter.comment}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">{'\u041f\u0438\u0441\u044c\u043c\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e'}</div>
          )}
        </div>

        {/* Footer */}
        {letter && (
          <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between">
            <div className="text-xs text-gray-500">{'\u041d\u0430\u0436\u043c\u0438\u0442\u0435 Esc \u0434\u043b\u044f \u0437\u0430\u043a\u0440\u044b\u0442\u0438\u044f'}</div>
            <Link
              href={`/letters/${letter.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition text-sm"
            >
              {'\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u0438\u0441\u044c\u043c\u043e'}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </>
  )
}

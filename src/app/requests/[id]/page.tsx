'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { Header } from '@/components/Header'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { useToast } from '@/components/Toast'
import { formatDate } from '@/lib/utils'
import { TemplateSelector } from '@/components/requests/TemplateSelector'
import { TagSelector } from '@/components/requests/TagSelector'
import { SlaIndicator } from '@/components/requests/SlaIndicator'
import {
  ArrowLeft,
  Loader2,
  Paperclip,
  UserPlus,
  UserX,
  ExternalLink,
  MessageSquare,
  History,
  Send,
  AlertTriangle,
  Flag,
  Tag,
} from 'lucide-react'

type RequestStatus = 'NEW' | 'IN_REVIEW' | 'DONE' | 'SPAM' | 'CANCELLED'
type RequestPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
type RequestCategory = 'CONSULTATION' | 'TECHNICAL' | 'DOCUMENTATION' | 'COMPLAINT' | 'SUGGESTION' | 'OTHER'
type SlaStatus = 'ON_TIME' | 'AT_RISK' | 'BREACHED'

interface RequestFile {
  id: string
  name: string
  url: string
  size: number | null
  mimeType: string | null
}

interface RequestComment {
  id: string
  text: string
  createdAt: string
  author: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  }
}

interface RequestDetail {
  id: string
  organization: string
  contactName: string
  contactEmail: string
  contactPhone: string
  contactTelegram: string
  description: string
  status: RequestStatus
  priority: RequestPriority
  category: RequestCategory
  createdAt: string
  source?: string | null
  slaDeadline?: string | null
  slaStatus?: SlaStatus
  assignedTo: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  } | null
  files: RequestFile[]
  comments: RequestComment[]
  tags: Array<{ id: string; name: string; color: string }>
  _count: { history: number }
}

interface HistoryEntry {
  id: string
  field: string
  oldValue: string | null
  newValue: string | null
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string | null
  }
}

const STATUS_LABELS: Record<RequestStatus, string> = {
  NEW: 'Новая',
  IN_REVIEW: 'В работе',
  DONE: 'Завершена',
  SPAM: 'Спам',
  CANCELLED: 'Отменена',
}

const STATUS_STYLES: Record<RequestStatus, string> = {
  NEW: 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/30',
  IN_REVIEW: 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40',
  DONE: 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40',
  SPAM: 'bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/40',
  CANCELLED: 'bg-gray-500/20 text-gray-300 ring-1 ring-gray-400/40',
}

const PRIORITY_LABELS: Record<RequestPriority, string> = {
  LOW: 'Низкий',
  NORMAL: 'Обычный',
  HIGH: 'Высокий',
  URGENT: 'Срочный',
}

const PRIORITY_STYLES: Record<RequestPriority, string> = {
  LOW: 'bg-gray-500/20 text-gray-300',
  NORMAL: 'bg-blue-500/20 text-blue-300',
  HIGH: 'bg-orange-500/20 text-orange-300',
  URGENT: 'bg-red-500/20 text-red-300',
}

const CATEGORY_LABELS: Record<RequestCategory, string> = {
  CONSULTATION: 'Консультация',
  TECHNICAL: 'Техническая поддержка',
  DOCUMENTATION: 'Документация',
  COMPLAINT: 'Жалоба',
  SUGGESTION: 'Предложение',
  OTHER: 'Другое',
}

const FIELD_LABELS: Record<string, string> = {
  status: 'Статус',
  priority: 'Приоритет',
  category: 'Категория',
  assignedTo: 'Ответственный',
  deletedAt: 'Удалено',
}

const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ru-RU')
}

export default function RequestDetailPage() {
  const { data: session, status } = useSession()
  useAuthRedirect(status)
  const { error: toastError, success: toastSuccess } = useToast()
  const params = useParams()
  const requestId = params?.id as string

  const [request, setRequest] = useState<RequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const fetchedRef = useRef(false)

  const loadRequest = useCallback(async () => {
    if (!requestId) return
    setLoading(true)
    try {
      const response = await fetch(`/api/requests/${requestId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load request')
      }

      setRequest(data.request)
    } catch (error) {
      console.error('Failed to load request:', error)
      toastError('Не удалось загрузить заявку.')
    } finally {
      setLoading(false)
    }
  }, [requestId, toastError])

  useEffect(() => {
    if (!session || !requestId || fetchedRef.current) return
    fetchedRef.current = true
    loadRequest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, requestId])

  const updateRequest = async (payload: {
    status?: RequestStatus
    priority?: RequestPriority
    category?: RequestCategory
    assignedToId?: string | null
  }) => {
    if (!requestId) return
    setUpdating(true)
    try {
      const response = await fetch(`/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update request')
      }

      setRequest(data.request)
      toastSuccess('Обновлено')
    } catch (error) {
      console.error('Failed to update request:', error)
      toastError('Не удалось обновить заявку.')
    } finally {
      setUpdating(false)
    }
  }

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim() || !requestId) return

    setSubmittingComment(true)
    try {
      const response = await fetch(`/api/requests/${requestId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commentText.trim() }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add comment')
      }

      setRequest((prev) =>
        prev ? { ...prev, comments: [...prev.comments, data.comment] } : prev
      )
      setCommentText('')
      toastSuccess('Комментарий добавлен')
    } catch (error) {
      console.error('Failed to add comment:', error)
      toastError('Не удалось добавить комментарий.')
    } finally {
      setSubmittingComment(false)
    }
  }

  const loadHistory = useCallback(async () => {
    if (!requestId) return
    setHistoryLoading(true)
    try {
      const response = await fetch(`/api/requests/${requestId}/history`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load history')
      }

      setHistory(data.history)
    } catch (error) {
      console.error('Failed to load history:', error)
      toastError('Не удалось загрузить историю.')
    } finally {
      setHistoryLoading(false)
    }
  }, [requestId, toastError])

  const toggleHistory = () => {
    if (!historyOpen && history.length === 0) {
      loadHistory()
    }
    setHistoryOpen(!historyOpen)
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen app-shell flex items-center justify-center bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!session) return null

  if (!request) {
    return (
      <div className="min-h-screen app-shell bg-gray-900">
        <Header />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="panel panel-glass rounded-2xl p-6 text-slate-300">
            {'Заявка не найдена.'}
          </div>
        </main>
      </div>
    )
  }

  const assignedLabel = request.assignedTo?.name || request.assignedTo?.email || '—'
  const assignedToMe = request.assignedTo?.id === session.user.id

  return (
    <div className="min-h-screen app-shell bg-gray-900">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/requests"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          {'К списку заявок'}
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white">
              {request.organization}
            </h1>
            <p className="text-sm text-slate-300 mt-2">
              {`Создано ${formatDateTime(request.createdAt)}`}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${PRIORITY_STYLES[request.priority]}`}>
                <Flag className="w-3 h-3" />
                {PRIORITY_LABELS[request.priority]}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-purple-500/20 text-purple-300">
                <Tag className="w-3 h-3" />
                {CATEGORY_LABELS[request.category]}
              </span>
              {request.slaDeadline && request.slaStatus && (
                <SlaIndicator
                  slaDeadline={request.slaDeadline}
                  slaStatus={request.slaStatus}
                  status={request.status}
                  size="sm"
                />
              )}
            </div>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[request.status]}`}
          >
            {STATUS_LABELS[request.status]}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="panel panel-glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                {'Описание'}
              </h2>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">
                {request.description}
              </p>
            </div>

            <div className="panel panel-glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                {'Вложения'}
              </h2>
              {request.files.length === 0 ? (
                <p className="text-sm text-slate-400">
                  {'Вложений нет.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {request.files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-800/60 border border-gray-700 rounded-lg"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{file.name}</p>
                        <p className="text-xs text-slate-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-emerald-300 hover:text-emerald-200 transition"
                      >
                        <ExternalLink className="w-4 h-4" />
                        {'Открыть'}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Комментарии */}
            <div className="panel panel-glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  {'Комментарии'}
                  {request.comments.length > 0 && (
                    <span className="text-sm text-slate-400">({request.comments.length})</span>
                  )}
                </h2>
              </div>

              {request.comments.length === 0 ? (
                <p className="text-sm text-slate-400 mb-4">
                  {'Комментариев пока нет.'}
                </p>
              ) : (
                <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                  {request.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="bg-gray-800/60 border border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-start gap-3">
                        {comment.author.image ? (
                          <Image
                            src={comment.author.image}
                            alt=""
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-full"
                            unoptimized
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300 text-sm font-medium">
                            {(comment.author.name || comment.author.email || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white">
                              {comment.author.name || comment.author.email}
                            </span>
                            <span className="text-xs text-slate-400">
                              {formatDateTime(comment.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-300 whitespace-pre-wrap">
                            {comment.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={submitComment} className="space-y-3">
                <div className="flex gap-2">
                  <TemplateSelector
                    category={request.category}
                    onSelect={(content) => setCommentText(content)}
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Написать комментарий..."
                    disabled={submittingComment}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={submittingComment || !commentText.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingComment ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* История изменений */}
            {request._count.history > 0 && (
              <div className="panel panel-glass rounded-2xl p-6">
                <button
                  type="button"
                  onClick={toggleHistory}
                  className="flex items-center justify-between w-full text-left"
                >
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <History className="w-5 h-5" />
                    {'История изменений'}
                    <span className="text-sm text-slate-400">({request._count.history})</span>
                  </h2>
                  <span className="text-slate-400 text-sm">
                    {historyOpen ? 'Свернуть' : 'Развернуть'}
                  </span>
                </button>

                {historyOpen && (
                  <div className="mt-4">
                    {historyLoading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                      </div>
                    ) : history.length === 0 ? (
                      <p className="text-sm text-slate-400">{'История пуста.'}</p>
                    ) : (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {history.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-start gap-3 text-sm border-l-2 border-gray-700 pl-3"
                          >
                            <div className="flex-1">
                              <p className="text-slate-300">
                                <span className="text-white font-medium">
                                  {entry.user.name || entry.user.email}
                                </span>
                                {' изменил(а) '}
                                <span className="text-emerald-300">
                                  {FIELD_LABELS[entry.field] || entry.field}
                                </span>
                                {entry.oldValue && (
                                  <>
                                    {' с '}
                                    <span className="text-red-300 line-through">{entry.oldValue}</span>
                                  </>
                                )}
                                {' на '}
                                <span className="text-green-300">{entry.newValue || '—'}</span>
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                {formatDateTime(entry.createdAt)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="panel panel-glass rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-white">
                {'Управление'}
              </h2>
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  {'Теги'}
                </label>
                <TagSelector
                  requestId={request.id}
                  currentTags={request.tags}
                  onUpdate={loadRequest}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  {'Статус'}
                </label>
                <select
                  value={request.status}
                  onChange={(event) =>
                    updateRequest({ status: event.target.value as RequestStatus })
                  }
                  disabled={updating}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  {'Приоритет'}
                </label>
                <select
                  value={request.priority}
                  onChange={(event) =>
                    updateRequest({ priority: event.target.value as RequestPriority })
                  }
                  disabled={updating}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  {'Категория'}
                </label>
                <select
                  value={request.category}
                  onChange={(event) =>
                    updateRequest({ category: event.target.value as RequestCategory })
                  }
                  disabled={updating}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  {'Ответственный'}
                </label>
                <p className="text-sm text-white mb-3">{assignedLabel}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updateRequest({ assignedToId: session.user.id })}
                    disabled={updating}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4" />
                    {'Назначить на меня'}
                  </button>
                  {request.assignedTo && (
                    <button
                      type="button"
                      onClick={() => updateRequest({ assignedToId: null })}
                      disabled={updating}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-50"
                    >
                      <UserX className="w-4 h-4" />
                      {assignedToMe
                        ? 'Снять с себя'
                        : 'Снять назначение'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="panel panel-glass rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-white">
                {'Контакты'}
              </h2>
              <div className="space-y-2 text-sm text-slate-300">
                <p>{`Имя: ${request.contactName}`}</p>
                <p>{`Телефон: ${request.contactPhone}`}</p>
                <p>{`Email: ${request.contactEmail}`}</p>
                <p>{`Telegram: ${request.contactTelegram}`}</p>
              </div>
            </div>

            <div className="panel panel-glass rounded-2xl p-6 space-y-2 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                {`Файлов: ${request.files.length}`}
              </div>
              <div>{`Создано: ${formatDate(request.createdAt)}`}</div>
              {request.source && (
                <div>{`Источник: ${request.source}`}</div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

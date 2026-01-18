'use client'

import { useState } from 'react'
import {
  ClipboardCheck,
  Inbox,
  Loader2,
  Search,
  MessageCircle,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Flag,
  Tag,
  FileText,
} from 'lucide-react'

type RequestStatus = 'NEW' | 'IN_REVIEW' | 'DONE' | 'SPAM' | 'CANCELLED'
type RequestPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
type RequestCategory =
  | 'CONSULTATION'
  | 'TECHNICAL'
  | 'DOCUMENTATION'
  | 'COMPLAINT'
  | 'SUGGESTION'
  | 'OTHER'
type SlaStatus = 'ON_TIME' | 'AT_RISK' | 'BREACHED'

type TrackedRequest = {
  id: string
  organization: string
  description: string
  status: RequestStatus
  priority: RequestPriority
  category: RequestCategory
  slaDeadline: string | null
  slaStatus: SlaStatus | null
  createdAt: string
  updatedAt: string
  files: Array<{
    id: string
    name: string
    url: string
    size: number | null
    mimeType: string | null
  }>
  history: Array<{
    id: string
    oldValue: string | null
    newValue: string | null
    createdAt: string
  }>
  comments: Array<{
    id: string
    text: string
    createdAt: string
    author: {
      name: string | null
      email: string | null
    }
  }>
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

const SLA_STATUS_LABELS: Record<SlaStatus, string> = {
  ON_TIME: 'В срок',
  AT_RISK: 'Под угрозой',
  BREACHED: 'Нарушен',
}

const copy = {
  title: 'Отслеживание заявки',
  subtitle: 'Введите номер заявки и ваш контакт, чтобы просмотреть статус.',
  idLabel: 'Номер заявки',
  idPlaceholder: 'cuid из уведомления',
  contactLabel: 'Контакт',
  contactPlaceholder: 'Email, телефон или Telegram',
  submit: 'Проверить',
  notFound: 'Заявка не найдена. Проверьте номер и контакт.',
  detailsTitle: 'Детали заявки',
  description: 'Описание',
  files: 'Вложения',
  filesEmpty: 'Вложений нет.',
  history: 'История статусов',
  historyEmpty: 'Изменений статуса пока нет.',
  comments: 'Комментарии',
  commentsEmpty: 'Комментариев пока нет.',
  sla: 'SLA',
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ru-RU')
}

const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatTimeRemaining = (slaDeadline: string | null): string => {
  if (!slaDeadline) return '—'

  const now = new Date()
  const deadline = new Date(slaDeadline)
  const hours = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)

  if (hours < 0) {
    const absHours = Math.abs(hours)
    if (absHours < 24) {
      return `Просрочено на ${absHours.toFixed(1)} ч`
    } else {
      const days = Math.floor(absHours / 24)
      return `Просрочено на ${days} д`
    }
  }

  if (hours < 1) {
    const minutes = Math.round(hours * 60)
    return `${minutes} мин`
  } else if (hours < 24) {
    return `${hours.toFixed(1)} ч`
  } else {
    const days = Math.floor(hours / 24)
    const remainingHours = Math.round(hours % 24)
    return `${days} д ${remainingHours} ч`
  }
}

const getSlaIcon = (status: SlaStatus) => {
  switch (status) {
    case 'ON_TIME':
      return <CheckCircle className="h-4 w-4" />
    case 'AT_RISK':
      return <AlertTriangle className="h-4 w-4" />
    case 'BREACHED':
      return <XCircle className="h-4 w-4" />
    default:
      return <Clock className="h-4 w-4" />
  }
}

const getSlaColor = (status: SlaStatus): string => {
  switch (status) {
    case 'ON_TIME':
      return '#10B981'
    case 'AT_RISK':
      return '#F59E0B'
    case 'BREACHED':
      return '#EF4444'
    default:
      return '#6B7280'
  }
}

export default function RequestTrackingPage() {
  const [requestId, setRequestId] = useState('')
  const [contact, setContact] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TrackedRequest | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!requestId.trim() || !contact.trim()) return

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/portal/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: requestId.trim(),
          contact: contact.trim(),
        }),
      })
      const data = await response.json()

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Request not found')
      }

      setResult(data.request as TrackedRequest)
    } catch (err) {
      setError(copy.notFound)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell min-h-screen">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="panel panel-glass rounded-3xl p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="app-icon-button app-icon-cta h-10 w-10">
              <Inbox className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">{copy.title}</h1>
              <p className="text-sm text-slate-400">{copy.subtitle}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[1.2fr,1.2fr,auto]">
            <div>
              <label className="mb-1.5 block text-sm text-slate-300">{copy.idLabel}</label>
              <input
                value={requestId}
                onChange={(event) => setRequestId(event.target.value)}
                placeholder={copy.idPlaceholder}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-slate-300">{copy.contactLabel}</label>
              <input
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder={copy.contactPlaceholder}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading || !requestId.trim() || !contact.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {copy.submit}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-4 rounded-lg bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-8 space-y-6">
              {/* Header Card */}
              <div className="panel panel-glass rounded-2xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-400">ID: {result.id}</p>
                    <h2 className="text-lg font-semibold text-white">{result.organization}</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Создано: {formatDateTime(result.createdAt)} · Обновлено:{' '}
                      {formatDateTime(result.updatedAt)}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${
                          PRIORITY_STYLES[result.priority]
                        }`}
                      >
                        <Flag className="h-3 w-3" />
                        {PRIORITY_LABELS[result.priority]}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-purple-500/20 px-2 py-1 text-xs font-medium text-purple-300">
                        <Tag className="h-3 w-3" />
                        {CATEGORY_LABELS[result.category]}
                      </span>
                      {result.slaDeadline && result.slaStatus && (
                        <span
                          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium"
                          style={{
                            backgroundColor: `${getSlaColor(result.slaStatus)}22`,
                            color: getSlaColor(result.slaStatus),
                          }}
                        >
                          {getSlaIcon(result.slaStatus)}
                          {SLA_STATUS_LABELS[result.slaStatus]}
                          {result.status !== 'DONE' && (
                            <span className="text-xs opacity-75">
                              · {formatTimeRemaining(result.slaDeadline)}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                      STATUS_STYLES[result.status]
                    }`}
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    {STATUS_LABELS[result.status]}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="panel panel-glass rounded-2xl p-5">
                <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
                  <FileText className="h-4 w-4" />
                  {copy.description}
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                  {result.description}
                </p>
              </div>

              {/* Comments */}
              {result.comments.length > 0 && (
                <div className="panel panel-glass rounded-2xl p-5">
                  <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
                    <MessageCircle className="h-4 w-4" />
                    {copy.comments} ({result.comments.length})
                  </h3>
                  <div className="mt-3 space-y-3">
                    {result.comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="rounded-lg border border-white/5 bg-white/5 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-medium text-emerald-300">
                            {comment.author.name || comment.author.email || 'Оператор'}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatDateTime(comment.createdAt)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-slate-300">
                          {comment.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files */}
              <div className="panel panel-glass rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white">{copy.files}</h3>
                {result.files.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400">{copy.filesEmpty}</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {result.files.map((file) => (
                      <a
                        key={file.id}
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                      >
                        <span className="truncate">{file.name}</span>
                        <span className="text-xs text-slate-400">{formatFileSize(file.size)}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* History */}
              <div className="panel panel-glass rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white">{copy.history}</h3>
                {result.history.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400">{copy.historyEmpty}</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {result.history.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-sm text-slate-300"
                      >
                        <div className="text-xs text-slate-400">
                          {formatDateTime(entry.createdAt)}
                        </div>
                        <div className="mt-1">
                          {entry.oldValue && (
                            <span className="text-rose-300 line-through">{entry.oldValue}</span>
                          )}
                          {entry.oldValue && <span className="text-slate-400"> → </span>}
                          <span className="text-emerald-300">{entry.newValue || '-'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

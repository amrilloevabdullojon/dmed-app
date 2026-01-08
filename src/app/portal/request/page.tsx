'use client'

import { useState } from 'react'
import { ClipboardCheck, Inbox, Loader2, Search } from 'lucide-react'

type RequestStatus = 'NEW' | 'IN_REVIEW' | 'DONE' | 'SPAM' | 'CANCELLED'

type TrackedRequest = {
  id: string
  organization: string
  description: string
  status: RequestStatus
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
}

const STATUS_LABELS: Record<RequestStatus, string> = {
  NEW: '\u041d\u043e\u0432\u0430\u044f',
  IN_REVIEW: '\u0412 \u0440\u0430\u0431\u043e\u0442\u0435',
  DONE: '\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430',
  SPAM: '\u0421\u043f\u0430\u043c',
  CANCELLED: '\u041e\u0442\u043c\u0435\u043d\u0435\u043d\u0430',
}

const STATUS_STYLES: Record<RequestStatus, string> = {
  NEW: 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/30',
  IN_REVIEW: 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40',
  DONE: 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40',
  SPAM: 'bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/40',
  CANCELLED: 'bg-gray-500/20 text-gray-300 ring-1 ring-gray-400/40',
}

const copy = {
  title:
    '\u041e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u043d\u0438\u0435 \u0437\u0430\u044f\u0432\u043a\u0438',
  subtitle:
    '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043d\u043e\u043c\u0435\u0440 \u0437\u0430\u044f\u0432\u043a\u0438 \u0438 \u0432\u0430\u0448 \u043a\u043e\u043d\u0442\u0430\u043a\u0442, \u0447\u0442\u043e\u0431\u044b \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0441\u0442\u0430\u0442\u0443\u0441.',
  idLabel: '\u041d\u043e\u043c\u0435\u0440 \u0437\u0430\u044f\u0432\u043a\u0438',
  idPlaceholder:
    'cuid \u0438\u0437 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f',
  contactLabel: '\u041a\u043e\u043d\u0442\u0430\u043a\u0442',
  contactPlaceholder:
    'Email, \u0442\u0435\u043b\u0435\u0444\u043e\u043d \u0438\u043b\u0438 Telegram',
  submit: '\u041f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c',
  notFound:
    '\u0417\u0430\u044f\u0432\u043a\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u043d\u043e\u043c\u0435\u0440 \u0438 \u043a\u043e\u043d\u0442\u0430\u043a\u0442.',
  detailsTitle: '\u0414\u0435\u0442\u0430\u043b\u0438 \u0437\u0430\u044f\u0432\u043a\u0438',
  description: '\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435',
  files: '\u0412\u043b\u043e\u0436\u0435\u043d\u0438\u044f',
  filesEmpty: '\u0412\u043b\u043e\u0436\u0435\u043d\u0438\u0439 \u043d\u0435\u0442.',
  history:
    '\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0441\u0442\u0430\u0442\u0443\u0441\u043e\u0432',
  historyEmpty:
    '\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0439 \u0441\u0442\u0430\u0442\u0443\u0441\u0430 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.',
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
              <div className="panel panel-glass rounded-2xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-400">ID: {result.id}</p>
                    <h2 className="text-lg font-semibold text-white">{result.organization}</h2>
                    <p className="text-xs text-slate-400">
                      {formatDateTime(result.createdAt)} \u00b7 {formatDateTime(result.updatedAt)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[result.status]}`}
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    {STATUS_LABELS[result.status]}
                  </span>
                </div>
              </div>

              <div className="panel panel-glass rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white">{copy.description}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                  {result.description}
                </p>
              </div>

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
                          {entry.oldValue && <span className="text-slate-400"> \u2192 </span>}
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

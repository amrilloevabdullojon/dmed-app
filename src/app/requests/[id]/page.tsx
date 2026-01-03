'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Header } from '@/components/Header'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { useToast } from '@/components/Toast'
import { formatDate } from '@/lib/utils'
import {
  ArrowLeft,
  Loader2,
  Paperclip,
  UserPlus,
  UserX,
  ExternalLink,
} from 'lucide-react'

type RequestStatus = 'NEW' | 'IN_REVIEW' | 'DONE' | 'SPAM'

interface RequestFile {
  id: string
  name: string
  url: string
  size: number | null
  mimeType: string | null
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
  createdAt: string
  source?: string | null
  assignedTo: {
    id: string
    name: string | null
    email: string | null
  } | null
  files: RequestFile[]
}

const STATUS_LABELS: Record<RequestStatus, string> = {
  NEW: '\u041d\u043e\u0432\u0430\u044f',
  IN_REVIEW: '\u0412 \u0440\u0430\u0431\u043e\u0442\u0435',
  DONE: '\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430',
  SPAM: '\u0421\u043f\u0430\u043c',
}

const STATUS_STYLES: Record<RequestStatus, string> = {
  NEW: 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/30',
  IN_REVIEW: 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40',
  DONE: 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40',
  SPAM: 'bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/40',
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
  const toast = useToast()
  const params = useParams()
  const requestId = params?.id as string

  const [request, setRequest] = useState<RequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!session || !requestId) return
    let active = true

    const loadRequest = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/requests/${requestId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load request')
        }

        if (active) {
          setRequest(data.request)
        }
      } catch (error) {
        console.error('Failed to load request:', error)
        if (active) {
          toast.error('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadRequest()
    return () => {
      active = false
    }
  }, [session, requestId, toast])

  const updateRequest = async (payload: { status?: RequestStatus; assignedToId?: string | null }) => {
    if (!requestId) return
    setUpdating(true)
    try {
      const response = await fetch(`/api/requests/${requestId}` , {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update request')
      }

      setRequest(data.request)
      toast.success('\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e')
    } catch (error) {
      console.error('Failed to update request:', error)
      toast.error('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443.')
    } finally {
      setUpdating(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!session) return null

  if (!request) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="panel panel-glass rounded-2xl p-6 text-slate-300">
            {'\u0417\u0430\u044f\u0432\u043a\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430.'}
          </div>
        </main>
      </div>
    )
  }

  const assignedLabel = request.assignedTo?.name || request.assignedTo?.email || '\u2014'
  const assignedToMe = request.assignedTo?.id === session.user.id

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/requests"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          {'\u041a \u0441\u043f\u0438\u0441\u043a\u0443 \u0437\u0430\u044f\u0432\u043e\u043a'}
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white">
              {request.organization}
            </h1>
            <p className="text-sm text-slate-300 mt-2">
              {`\u0421\u043e\u0437\u0434\u0430\u043d\u043e ${formatDateTime(request.createdAt)}`}
            </p>
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
                {'\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435'}
              </h2>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">
                {request.description}
              </p>
            </div>

            <div className="panel panel-glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                {'\u0412\u043b\u043e\u0436\u0435\u043d\u0438\u044f'}
              </h2>
              {request.files.length === 0 ? (
                <p className="text-sm text-slate-400">
                  {'\u0412\u043b\u043e\u0436\u0435\u043d\u0438\u0439 \u043d\u0435\u0442.'}
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
                        {'\u041e\u0442\u043a\u0440\u044b\u0442\u044c'}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="panel panel-glass rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-white">
                {'\u0423\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435'}
              </h2>
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  {'\u0421\u0442\u0430\u0442\u0443\u0441'}
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
                  {'\u041e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439'}
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
                    {'\u041d\u0430\u0437\u043d\u0430\u0447\u0438\u0442\u044c \u043d\u0430 \u043c\u0435\u043d\u044f'}
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
                        ? '\u0421\u043d\u044f\u0442\u044c \u0441 \u0441\u0435\u0431\u044f'
                        : '\u0421\u043d\u044f\u0442\u044c \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="panel panel-glass rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-white">
                {'\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b'}
              </h2>
              <div className="space-y-2 text-sm text-slate-300">
                <p>{`\u0418\u043c\u044f: ${request.contactName}`}</p>
                <p>{`\u0422\u0435\u043b\u0435\u0444\u043e\u043d: ${request.contactPhone}`}</p>
                <p>{`Email: ${request.contactEmail}`}</p>
                <p>{`Telegram: ${request.contactTelegram}`}</p>
              </div>
            </div>

            <div className="panel panel-glass rounded-2xl p-6 space-y-2 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                {`\u0424\u0430\u0439\u043b\u043e\u0432: ${request.files.length}`}
              </div>
              <div>{`\u0421\u043e\u0437\u0434\u0430\u043d\u043e: ${formatDate(request.createdAt)}`}</div>
              {request.source && (
                <div>{`\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a: ${request.source}`}</div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

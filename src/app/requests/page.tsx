'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Header } from '@/components/Header'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { useToast } from '@/components/Toast'
import { formatDate } from '@/lib/utils'
import { PAGE_SIZE } from '@/lib/constants'
import { Loader2, RefreshCw, Search } from 'lucide-react'

type RequestStatus = 'NEW' | 'IN_REVIEW' | 'DONE' | 'SPAM'

interface RequestSummary {
  id: string
  organization: string
  contactName: string
  contactEmail: string
  contactPhone: string
  contactTelegram: string
  description: string
  status: RequestStatus
  createdAt: string
  assignedTo: {
    id: string
    name: string | null
    email: string | null
  } | null
  _count: {
    files: number
  }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
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

export default function RequestsPage() {
  const { data: session, status } = useSession()
  useAuthRedirect(status)
  const toast = useToast()

  const [requests, setRequests] = useState<RequestSummary[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit] = useState(PAGE_SIZE)
  const [statusFilter, setStatusFilter] = useState<RequestStatus | ''>('')
  const [search, setSearch] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!session) return
    let active = true

    const loadRequests = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        })
        if (statusFilter) params.set('status', statusFilter)
        if (search.trim()) params.set('search', search.trim())

        const response = await fetch(`/api/requests?${params.toString()}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load requests')
        }

        if (!active) return
        setRequests(data.requests || [])
        setPagination(data.pagination || null)
      } catch (error) {
        console.error('Failed to load requests:', error)
        if (active) {
          toast.error('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0438.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadRequests()
    return () => {
      active = false
    }
  }, [session, page, limit, statusFilter, search, refreshKey, toast])

  const handleRefresh = () => {
    setPage(1)
    setRefreshKey((prev) => prev + 1)
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-white">
              {'\u0417\u0430\u044f\u0432\u043a\u0438'}
            </h1>
            {pagination && (
              <p className="text-sm text-slate-400 mt-1">
                {`\u0412\u0441\u0435\u0433\u043e: ${pagination.total}`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {'\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c'}
          </button>
        </div>

        <div className="panel panel-soft panel-glass rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u0438, \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430\u043c, \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u044e"
              className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as RequestStatus | '')
              setPage(1)
            }}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">\u0412\u0441\u0435 \u0441\u0442\u0430\u0442\u0443\u0441\u044b</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          </div>
        ) : requests.length === 0 ? (
          <div className="panel panel-glass rounded-2xl p-8 text-center text-slate-300">
            {'\u0417\u0430\u044f\u0432\u043e\u043a \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.'}
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="panel panel-soft panel-glass rounded-2xl p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1">
                    <Link
                      href={`/requests/${request.id}`}
                      className="text-lg text-white font-semibold hover:text-emerald-300 transition"
                    >
                      {request.organization}
                    </Link>
                    <p className="text-sm text-slate-300">
                      {request.contactName}
                      {' \u2022 '}
                      {request.contactPhone}
                      {' \u2022 '}
                      {request.contactEmail}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[request.status]}`}
                  >
                    {STATUS_LABELS[request.status]}
                  </span>
                </div>

                {request.description && (
                  <p className="text-sm text-slate-300/90 mt-3">
                    {request.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-4">
                  <span>{formatDate(request.createdAt)}</span>
                  <span>{`\u0424\u0430\u0439\u043b\u043e\u0432: ${request._count?.files ?? 0}`}</span>
                  <span>
                    {`\u041e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439: ${
                      request.assignedTo?.name || request.assignedTo?.email || '\u2014'
                    }`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-6">
            <div className="text-sm text-slate-400">
              {`\u041f\u043e\u043a\u0430\u0437\u0430\u043d\u044b ${Math.min((page - 1) * limit + 1, pagination.total)}-${Math.min(
                page * limit,
                pagination.total
              )} \u0438\u0437 ${pagination.total}`}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-40"
              >
                {'\u041d\u0430\u0437\u0430\u0434'}
              </button>
              <span className="text-sm text-slate-300">
                {`${page} / ${pagination.totalPages}`}
              </span>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                disabled={page >= pagination.totalPages}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-40"
              >
                {'\u0414\u0430\u043b\u0435\u0435'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

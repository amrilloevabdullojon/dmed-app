'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Header } from '@/components/Header'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { useToast } from '@/components/Toast'
import { formatDate } from '@/lib/utils'
import { PAGE_SIZE } from '@/lib/constants'
import { Loader2, RefreshCw, Search, Flag, Tag, MessageSquare, AlertTriangle } from 'lucide-react'
import { RequestListSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

type RequestStatus = 'NEW' | 'IN_REVIEW' | 'DONE' | 'SPAM' | 'CANCELLED'
type RequestPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
type RequestCategory = 'CONSULTATION' | 'TECHNICAL' | 'DOCUMENTATION' | 'COMPLAINT' | 'SUGGESTION' | 'OTHER'

interface RequestSummary {
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
  assignedTo: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  } | null
  _count: {
    files: number
    comments: number
  }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
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
  URGENT: 'bg-red-500/20 text-red-300 animate-urgent-pulse',
}

const CATEGORY_LABELS: Record<RequestCategory, string> = {
  CONSULTATION: 'Консультация',
  TECHNICAL: 'Техническая поддержка',
  DOCUMENTATION: 'Документация',
  COMPLAINT: 'Жалоба',
  SUGGESTION: 'Предложение',
  OTHER: 'Другое',
}

export default function RequestsPage() {
  const { data: session, status } = useSession()
  useAuthRedirect(status)
  const { error: toastError } = useToast()

  const [requests, setRequests] = useState<RequestSummary[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [limit] = useState(PAGE_SIZE)
  const [statusFilter, setStatusFilter] = useState<RequestStatus | ''>('')
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority | ''>('')
  const [categoryFilter, setCategoryFilter] = useState<RequestCategory | ''>('')
  const [search, setSearch] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!session) return
    let active = true

    const loadRequests = async () => {
      setLoading(true)
      setError(null)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        })
        if (statusFilter) params.set('status', statusFilter)
        if (priorityFilter) params.set('priority', priorityFilter)
        if (categoryFilter) params.set('category', categoryFilter)
        if (search.trim()) params.set('search', search.trim())

        const response = await fetch(`/api/requests?${params.toString()}`, {
          signal: controller.signal,
        })
        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          const baseMessage = data.error || 'Failed to load requests'
          const details = data.details ? ` (${data.details})` : ''
          const requestId = data.requestId ? ` [${data.requestId}]` : ''
          throw new Error(`${baseMessage}${details}${requestId}`)
        }

        if (!active) return
        setRequests(data.requests || [])
        setPagination(data.pagination || null)
      } catch (error) {
        console.error('Failed to load requests:', error)
        if (active) {
          const message =
            error instanceof DOMException && error.name === 'AbortError'
              ? 'Запрос занимает слишком много времени. Проверьте соединение или базу данных.'
              : error instanceof Error
                ? error.message
                : 'Не удалось загрузить заявки.'
          setError(message)
          toastError(message)
        }
      } finally {
        clearTimeout(timeoutId)
        if (active) setLoading(false)
      }
    }

    loadRequests()
    return () => {
      active = false
    }
  }, [session, page, limit, statusFilter, priorityFilter, categoryFilter, search, refreshKey, toastError])

  const handleRefresh = () => {
    setPage(1)
    setRefreshKey((prev) => prev + 1)
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen app-shell flex items-center justify-center bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="min-h-screen app-shell bg-gray-900">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-white">
              {'Заявки'}
            </h1>
            {pagination && (
              <p className="text-sm text-slate-400 mt-1">
                {`Всего: ${pagination.total}`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {'Обновить'}
          </button>
        </div>

        <div className="panel panel-soft panel-glass rounded-2xl p-4 mb-6 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Поиск по организации, контактам, описанию"
                className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as RequestStatus | '')
                setPage(1)
              }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
            >
              <option value="">Все статусы</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(event) => {
                setPriorityFilter(event.target.value as RequestPriority | '')
                setPage(1)
              }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
            >
              <option value="">Все приоритеты</option>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value as RequestCategory | '')
                setPage(1)
              }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
            >
              <option value="">Все категории</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {(statusFilter || priorityFilter || categoryFilter || search) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('')
                  setPriorityFilter('')
                  setCategoryFilter('')
                  setSearch('')
                  setPage(1)
                }}
                className="px-3 py-2 text-sm text-slate-400 hover:text-white transition"
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        </div>

        {error && !loading && (
          <div className="panel panel-glass rounded-2xl p-4 mb-6 text-red-300 border border-red-500/30">
            {error}
          </div>
        )}

        {loading ? (
          <RequestListSkeleton count={5} />
        ) : requests.length === 0 ? (
          <EmptyState
            variant={(statusFilter || priorityFilter || categoryFilter || search) ? 'search' : 'requests'}
            title={(statusFilter || priorityFilter || categoryFilter || search) ? 'Ничего не найдено' : undefined}
            description={(statusFilter || priorityFilter || categoryFilter || search)
              ? 'Попробуйте изменить параметры поиска или сбросить фильтры'
              : undefined}
            action={(statusFilter || priorityFilter || categoryFilter || search) ? (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('')
                  setPriorityFilter('')
                  setCategoryFilter('')
                  setSearch('')
                  setPage(1)
                }}
                className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition text-sm"
              >
                Сбросить фильтры
              </button>
            ) : undefined}
          />
        ) : (
          <div className="space-y-4 stagger-animation">
            {requests.map((request) => (
              <Link
                key={request.id}
                href={`/requests/${request.id}`}
                className={`block panel panel-soft panel-glass rounded-2xl p-5 card-hover ${
                  request.priority === 'URGENT' ? 'urgent-card' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      {request.priority === 'URGENT' && (
                        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      )}
                      <span className="text-lg text-white font-semibold group-hover:text-emerald-300 transition">
                        {request.organization}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">
                      {request.contactName}
                      {' • '}
                      {request.contactPhone}
                      {' • '}
                      {request.contactEmail}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_STYLES[request.priority]}`}>
                        <Flag className="w-3 h-3" />
                        {PRIORITY_LABELS[request.priority]}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-300">
                        <Tag className="w-3 h-3" />
                        {CATEGORY_LABELS[request.category]}
                      </span>
                      {request.status === 'NEW' && (
                        <span className="w-2 h-2 rounded-full bg-sky-400 status-dot-new" />
                      )}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[request.status]}`}
                  >
                    {STATUS_LABELS[request.status]}
                  </span>
                </div>

                {request.description && (
                  <p className="text-sm text-slate-300/90 mt-3 line-clamp-2">
                    {request.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-4">
                  <span>{formatDate(request.createdAt)}</span>
                  <span>{`Файлов: ${request._count?.files ?? 0}`}</span>
                  {(request._count?.comments ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {request._count.comments}
                    </span>
                  )}
                  <span>
                    {`Ответственный: ${
                      request.assignedTo?.name || request.assignedTo?.email || '—'
                    }`}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-6">
            <div className="text-sm text-slate-400">
              {`Показаны ${Math.min((page - 1) * limit + 1, pagination.total)}-${Math.min(
                page * limit,
                pagination.total
              )} из ${pagination.total}`}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-40"
              >
                {'Назад'}
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
                {'Далее'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

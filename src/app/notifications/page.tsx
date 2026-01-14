'use client'

import { useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  Bell,
  Download,
  Filter,
  Mail,
  Search,
  Send,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react'
import { Header } from '@/components/Header'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { useDebouncedState } from '@/hooks/useDebounce'
import { useFetch } from '@/hooks/useFetch'

type DeliveryStatus = 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED'

interface NotificationDelivery {
  id: string
  channel: 'IN_APP' | 'EMAIL' | 'TELEGRAM' | 'SMS' | 'PUSH'
  status: DeliveryStatus
  recipient?: string | null
  sentAt?: string | null
  createdAt: string
}

interface NotificationHistoryItem {
  id: string
  type: string
  title: string
  body?: string | null
  isRead: boolean
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
  createdAt: string
  letter?: { id: string; number: string; org: string } | null
  actor?: { id: string; name: string | null; email: string | null } | null
  deliveries: NotificationDelivery[]
}

interface HistoryResponse {
  notifications: NotificationHistoryItem[]
  total: number
}

const typeLabels: Record<string, string> = {
  NEW_LETTER: 'Новые письма',
  COMMENT: 'Комментарии',
  STATUS: 'Изменение статуса',
  ASSIGNMENT: 'Назначения',
  DEADLINE_URGENT: 'Срочные дедлайны',
  DEADLINE_OVERDUE: 'Просрочки',
  SYSTEM: 'Системные',
}

const priorityLabels: Record<NotificationHistoryItem['priority'], string> = {
  LOW: 'Низкий',
  NORMAL: 'Обычный',
  HIGH: 'Высокий',
  CRITICAL: 'Критичный',
}

const deliveryStatusStyles: Record<DeliveryStatus, string> = {
  SENT: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  FAILED: 'border-red-400/40 bg-red-500/10 text-red-200',
  SKIPPED: 'border-slate-500/40 bg-slate-800/40 text-slate-300',
  QUEUED: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
}

const channelIcons = {
  IN_APP: Bell,
  EMAIL: Mail,
  TELEGRAM: Send,
  SMS: Smartphone,
  PUSH: Bell,
}

const formatDate = (value: string) => new Date(value).toLocaleString('ru-RU')

export default function NotificationsHistoryPage() {
  const { data: session, status } = useSession()
  useAuthRedirect(status)

  const [search, debouncedSearch, setSearch] = useDebouncedState('', 300)
  const [typeFilter, setTypeFilter] = useState('all')
  const [channelFilter, setChannelFilter] = useState('all')
  const [readFilter, setReadFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const limit = 25

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('q', debouncedSearch)
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (channelFilter !== 'all') params.set('channel', channelFilter)
    if (readFilter !== 'all') params.set('read', readFilter)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    params.set('limit', String(limit))
    params.set('offset', String((page - 1) * limit))
    return params.toString()
  }, [channelFilter, debouncedSearch, fromDate, limit, page, readFilter, toDate, typeFilter])

  const historyQuery = useFetch<HistoryResponse>(
    session ? `/api/notifications/history?${query}` : null,
    { skip: !session }
  )

  const total = historyQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const exportUrl = `/api/notifications/history?${query}&format=csv`

  if (status === 'loading') {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <Clock className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <p className="text-gray-400">Пожалуйста, войдите в систему</p>
      </div>
    )
  }

  return (
    <div className="app-shell min-h-screen">
      <Header />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">История уведомлений</h1>
            <p className="text-sm text-gray-400">
              Хронология уведомлений с деталями доставки по каналам.
            </p>
          </div>
          <a
            href={exportUrl}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 transition hover:border-white/20 hover:bg-white/10"
          >
            <Download className="h-4 w-4" />
            Экспорт CSV
          </a>
        </div>

        <div className="panel panel-glass rounded-2xl p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <Search className="h-4 w-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setPage(1)
                  }}
                  placeholder="Поиск по заголовку, письму или организации"
                  className="w-full bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <select
                  value={typeFilter}
                  onChange={(event) => {
                    setTypeFilter(event.target.value)
                    setPage(1)
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                >
                  <option value="all">Все типы</option>
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={channelFilter}
                  onChange={(event) => {
                    setChannelFilter(event.target.value)
                    setPage(1)
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                >
                  <option value="all">Все каналы</option>
                  <option value="IN_APP">Внутри</option>
                  <option value="EMAIL">Email</option>
                  <option value="TELEGRAM">Telegram</option>
                  <option value="SMS">SMS</option>
                  <option value="PUSH">Push</option>
                </select>
                <select
                  value={readFilter}
                  onChange={(event) => {
                    setReadFilter(event.target.value)
                    setPage(1)
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                >
                  <option value="all">Все</option>
                  <option value="unread">Непрочитанные</option>
                  <option value="read">Прочитанные</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-gray-500">
                  От
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => {
                    setFromDate(event.target.value)
                    setPage(1)
                  }}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-gray-500">
                  До
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => {
                    setToDate(event.target.value)
                    setPage(1)
                  }}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                />
              </div>
              <div className="flex items-end text-xs text-gray-400">Найдено: {total}</div>
            </div>
          </div>
        </div>

        {historyQuery.isLoading ? (
          <div className="panel panel-glass rounded-2xl p-6 text-sm text-gray-400">
            Загружаем историю уведомлений...
          </div>
        ) : historyQuery.data?.notifications.length ? (
          <div className="space-y-4">
            {historyQuery.data.notifications.map((notification) => {
              const typeLabel = typeLabels[notification.type] || notification.type
              const priorityLabel = priorityLabels[notification.priority]
              return (
                <div key={notification.id} className="panel panel-glass rounded-2xl p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-500">
                        {typeLabel}
                      </div>
                      <h3 className="text-lg font-semibold text-white">{notification.title}</h3>
                      {notification.body && (
                        <p className="mt-1 text-sm text-gray-400">{notification.body}</p>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatDate(notification.createdAt)}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                      Приоритет: {priorityLabel}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                      {notification.isRead ? 'Прочитано' : 'Непрочитано'}
                    </span>
                    {notification.letter && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                        Письмо №-{notification.letter.number}
                      </span>
                    )}
                    {notification.actor && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                        Инициатор: {notification.actor.name || notification.actor.email}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 border-t border-white/10 pt-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Доставка</div>
                    {notification.deliveries.length === 0 ? (
                      <div className="mt-2 text-xs text-gray-400">Нет данных о доставке.</div>
                    ) : (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {notification.deliveries.map((delivery) => {
                          const Icon = channelIcons[delivery.channel]
                          const statusStyle = deliveryStatusStyles[delivery.status]
                          return (
                            <div
                              key={delivery.id}
                              className="rounded-xl border border-white/10 bg-white/5 p-3"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm text-white">
                                  <Icon className="h-4 w-4 text-emerald-300" />
                                  <span>{delivery.channel}</span>
                                </div>
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] ${statusStyle}`}
                                >
                                  {delivery.status}
                                </span>
                              </div>
                              <div className="mt-2 text-xs text-gray-400">
                                {delivery.recipient
                                  ? `Куда: ${delivery.recipient}`
                                  : 'Получатель не указан'}
                              </div>
                              <div className="mt-1 text-xs text-gray-500">
                                {delivery.sentAt
                                  ? `Отправлено: ${formatDate(delivery.sentAt)}`
                                  : 'Нет отправки'}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="panel panel-glass rounded-2xl p-6 text-sm text-gray-400">
            История уведомлений пуста.
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300 transition hover:border-white/20 hover:bg-white/10 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Назад
          </button>
          <div className="text-xs text-gray-400">
            Страница {page} из {totalPages}
          </div>
          <button
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300 transition hover:border-white/20 hover:bg-white/10 disabled:opacity-50"
          >
            Вперед
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    </div>
  )
}

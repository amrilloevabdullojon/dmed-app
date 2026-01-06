'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Plus,
  Edit,
  Trash2,
  User,
  MessageSquare,
  ArrowRight,
  FileText,
  Clock,
  Loader2,
} from 'lucide-react'

interface HistoryItem {
  id: string
  field: string
  oldValue: string | null
  newValue: string | null
  createdAt: string
  user: {
    id: string
    name: string | null
    image: string | null
  }
}

interface ActivityFeedProps {
  letterId: string
  maxItems?: number
  title?: string
  showTitle?: boolean
  compact?: boolean
}

const fieldLabels: Record<string, string> = {
  created: 'Создано',
  status: 'Статус',
  owner: 'Исполнитель',
  content: 'Содержание',
  answer: 'Ответ',
  comment: 'Комментарий',
  deadlineDate: 'Дедлайн',
  priority: 'Приоритет',
  deleted: 'Удалено',
}

const statusLabels: Record<string, string> = {
  NOT_REVIEWED: 'Не рассмотрено',
  ACCEPTED: 'Принято',
  IN_PROGRESS: 'В работе',
  CLARIFICATION: 'На уточнении',
  READY: 'Готово',
  DONE: 'Завершено',
}

function getIcon(field: string) {
  switch (field) {
    case 'created':
      return Plus
    case 'status':
      return ArrowRight
    case 'owner':
      return User
    case 'comment':
      return MessageSquare
    case 'deleted':
      return Trash2
    case 'deadlineDate':
      return Clock
    default:
      return Edit
  }
}

function formatValue(field: string, value: string | null): string {
  if (!value) return '—'

  if (field === 'status') {
    return statusLabels[value] || value
  }

  if (field === 'created') {
    try {
      const data = JSON.parse(value)
      return `#${data.number} · ${data.org}`
    } catch {
      return value
    }
  }

  if (field === 'deadlineDate' || field === 'date') {
    try {
      return new Date(value).toLocaleDateString('ru-RU')
    } catch {
      return value
    }
  }

  if (value.length > 100) {
    return value.slice(0, 100) + '...'
  }

  return value
}

export function ActivityFeed({
  letterId,
  maxItems = 10,
  title = 'История изменений',
  showTitle = true,
  compact = false,
}: ActivityFeedProps) {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/letters/${letterId}/history`)
        if (res.ok) {
          const data = await res.json()
          setHistory(data.history || [])
        }
      } catch (error) {
        console.error('Failed to fetch history:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [letterId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
        История изменений пока пустая
      </div>
    )
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {showTitle && (
        <h3 className="flex items-center gap-2 text-sm font-medium text-gray-400">
          <Clock className="h-4 w-4" />
          {title}
        </h3>
      )}

      <div className={compact ? 'space-y-2' : 'space-y-2'}>
        {history.slice(0, maxItems).map((item) => {
          const Icon = getIcon(item.field)
          const label = fieldLabels[item.field] || item.field

          return (
            <div
              key={item.id}
              className={`flex gap-3 rounded-lg border border-gray-700/50 bg-gray-800/30 ${
                compact ? 'p-3' : 'p-3'
              }`}
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-700/50">
                <Icon className="h-4 w-4 text-gray-400" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {item.user.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.user.image} alt="" className="h-5 w-5 rounded-full" />
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-600 text-xs text-white">
                      {item.user.name?.[0] || '?'}
                    </div>
                  )}
                  <span className="text-sm font-medium text-white">
                    {item.user.name || 'Пользователь'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(item.createdAt), {
                      addSuffix: true,
                      locale: ru,
                    })}
                  </span>
                </div>

                <div className="mt-1 text-sm text-gray-400">
                  <span className="font-medium text-gray-300">{label}</span>
                  {item.field !== 'created' && item.oldValue && (
                    <>
                      {': '}
                      <span className="text-red-400/70 line-through">
                        {formatValue(item.field, item.oldValue)}
                      </span>
                      {' → '}
                    </>
                  )}
                  {item.field !== 'created' && (
                    <span className="text-emerald-400">
                      {formatValue(item.field, item.newValue)}
                    </span>
                  )}
                  {item.field === 'created' && (
                    <span className="text-gray-400">
                      {': '}
                      {formatValue(item.field, item.newValue)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {history.length > maxItems && (
        <p className="text-center text-xs text-gray-500">
          И ещё {history.length - maxItems} изменений
        </p>
      )}
    </div>
  )
}

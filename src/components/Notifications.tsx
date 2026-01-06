'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  Info,
  MessageSquare,
  UserPlus,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { formatDate, getDaysUntilDeadline, pluralizeDays } from '@/lib/utils'
import { hasPermission } from '@/lib/permissions'
import { useFetch, useMutation } from '@/hooks/useFetch'
import { useVirtualList } from '@/hooks/useVirtualList'
import { useToast } from '@/components/Toast'

interface NotificationLetter {
  id: string
  number: string
  org: string
  deadlineDate?: string
  owner?: {
    id: string
    name: string | null
    email: string | null
  } | null
}

interface DeadlineLetter extends NotificationLetter {
  deadlineDate: string
}

interface UserNotification {
  id: string
  type: 'COMMENT' | 'STATUS' | 'ASSIGNMENT' | 'SYSTEM'
  title: string
  body: string | null
  isRead: boolean
  createdAt: string
  letter?: NotificationLetter | null
}

type UnifiedKind = UserNotification['type'] | 'DEADLINE_OVERDUE' | 'DEADLINE_URGENT'

interface UnifiedNotification {
  id: string
  kind: UnifiedKind
  title: string
  body?: string | null
  createdAt: string
  isRead?: boolean
  letter?: NotificationLetter | null
  daysLeft?: number
}

type FilterKey = 'all' | 'unread' | 'deadlines' | 'comments' | 'statuses' | 'assignments' | 'system'

const SNOOZE_KEY = 'notification-deadline-snoozes'

const getTomorrowStartIso = () => {
  const now = new Date()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return tomorrow.toISOString()
}

const isDeadlineKind = (kind: UnifiedKind) =>
  kind === 'DEADLINE_OVERDUE' || kind === 'DEADLINE_URGENT'

const getKindLabel = (kind: UnifiedKind) => {
  switch (kind) {
    case 'COMMENT':
      return 'Комментарий'
    case 'STATUS':
      return 'Статус'
    case 'ASSIGNMENT':
      return 'Назначение'
    case 'SYSTEM':
      return 'Системное'
    case 'DEADLINE_OVERDUE':
      return 'Просрочено'
    case 'DEADLINE_URGENT':
      return 'Срочно'
    default:
      return ''
  }
}

export function Notifications() {
  const toast = useToast()
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [loadDeadlineNotifications, setLoadDeadlineNotifications] = useState(false)
  const [snoozedDeadlines, setSnoozedDeadlines] = useState<Record<string, string>>({})
  const notificationRowHeight = 148
  const notificationListHeight = 520

  const canManageLetters = hasPermission(session?.user.role, 'MANAGE_LETTERS')
  const currentUserId = session?.user.id

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(SNOOZE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, string>
        if (parsed && typeof parsed === 'object') {
          setSnoozedDeadlines(parsed)
        }
      }
    } catch {
      // Ignore
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(SNOOZE_KEY, JSON.stringify(snoozedDeadlines))
    } catch {
      // Ignore
    }
  }, [snoozedDeadlines])

  const pruneSnoozes = useCallback(() => {
    const now = Date.now()
    setSnoozedDeadlines((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([, until]) => new Date(until).getTime() > now)
      )
      return Object.keys(next).length === Object.keys(prev).length ? prev : next
    })
  }, [])

  const refetchInterval = isOpen ? 60 * 1000 : 5 * 60 * 1000

  const userNotificationsQuery = useFetch<UserNotification[]>('/api/notifications', {
    initialData: [],
    transform: (data) => (data as { notifications?: UserNotification[] }).notifications || [],
    refetchInterval,
    refetchOnFocus: true,
  })
  const overdueQuery = useFetch<{ letters?: DeadlineLetter[] }>(
    '/api/letters?filter=overdue&limit=10',
    {
      initialData: { letters: [] },
      skip: !loadDeadlineNotifications,
      refetchInterval: loadDeadlineNotifications ? refetchInterval : undefined,
    }
  )
  const urgentQuery = useFetch<{ letters?: DeadlineLetter[] }>(
    '/api/letters?filter=urgent&limit=10',
    {
      initialData: { letters: [] },
      skip: !loadDeadlineNotifications,
      refetchInterval: loadDeadlineNotifications ? refetchInterval : undefined,
    }
  )
  const updateNotifications = useMutation<{ success: boolean }, { ids?: string[]; all?: boolean }>(
    '/api/notifications',
    { method: 'PATCH' }
  )

  const userNotifications = useMemo(
    () => userNotificationsQuery.data || [],
    [userNotificationsQuery.data]
  )
  const setUserNotifications = userNotificationsQuery.mutate

  const deadlineNotifications = useMemo<UnifiedNotification[]>(() => {
    if (!loadDeadlineNotifications) return [] as UnifiedNotification[]
    const overdue: UnifiedNotification[] = (overdueQuery.data?.letters || []).map((letter) => ({
      id: `deadline-overdue-${letter.id}`,
      kind: 'DEADLINE_OVERDUE' as const,
      title: '',
      body: null,
      createdAt: letter.deadlineDate,
      letter,
      daysLeft: getDaysUntilDeadline(letter.deadlineDate),
    }))
    const urgent: UnifiedNotification[] = (urgentQuery.data?.letters || []).map((letter) => ({
      id: `deadline-urgent-${letter.id}`,
      kind: 'DEADLINE_URGENT' as const,
      title: '',
      body: null,
      createdAt: letter.deadlineDate,
      letter,
      daysLeft: getDaysUntilDeadline(letter.deadlineDate),
    }))

    const all = [...overdue, ...urgent]
    return all.filter((item) => {
      const letterId = item.letter?.id
      if (!letterId) return true
      const snoozedUntil = snoozedDeadlines[letterId]
      if (!snoozedUntil) return true
      return new Date(snoozedUntil).getTime() <= Date.now()
    })
  }, [
    loadDeadlineNotifications,
    overdueQuery.data?.letters,
    urgentQuery.data?.letters,
    snoozedDeadlines,
  ])

  const unifiedNotifications = useMemo(() => {
    const userItems: UnifiedNotification[] = userNotifications.map((notif) => ({
      id: notif.id,
      kind: notif.type,
      title: notif.title,
      body: notif.body,
      createdAt: notif.createdAt,
      isRead: notif.isRead,
      letter: notif.letter ?? null,
    }))
    const all = [...userItems, ...deadlineNotifications]

    const getPriority = (item: UnifiedNotification) => {
      if (item.kind === 'DEADLINE_OVERDUE') return 2
      if (item.kind === 'DEADLINE_URGENT') return 1
      return 0
    }

    return all.sort((a, b) => {
      const priorityDiff = getPriority(b) - getPriority(a)
      if (priorityDiff !== 0) return priorityDiff
      if (getPriority(a) > 0) {
        const aTime = a.letter?.deadlineDate
          ? new Date(a.letter.deadlineDate).getTime()
          : new Date(a.createdAt).getTime()
        const bTime = b.letter?.deadlineDate
          ? new Date(b.letter.deadlineDate).getTime()
          : new Date(b.createdAt).getTime()
        return aTime - bTime
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [deadlineNotifications, userNotifications])

  const counts = useMemo(() => {
    const base = {
      all: 0,
      unread: 0,
      deadlines: 0,
      comments: 0,
      statuses: 0,
      assignments: 0,
      system: 0,
    }

    unifiedNotifications.forEach((item) => {
      base.all += 1
      if (item.kind === 'COMMENT') base.comments += 1
      if (item.kind === 'STATUS') base.statuses += 1
      if (item.kind === 'ASSIGNMENT') base.assignments += 1
      if (item.kind === 'SYSTEM') base.system += 1
      if (isDeadlineKind(item.kind)) base.deadlines += 1
      if (!isDeadlineKind(item.kind) && item.isRead === false) base.unread += 1
    })

    return base
  }, [unifiedNotifications])

  const totalCount = counts.unread + counts.deadlines

  const filteredNotifications = useMemo(() => {
    switch (activeFilter) {
      case 'unread':
        return unifiedNotifications.filter(
          (item) => !isDeadlineKind(item.kind) && item.isRead === false
        )
      case 'deadlines':
        return unifiedNotifications.filter((item) => isDeadlineKind(item.kind))
      case 'comments':
        return unifiedNotifications.filter((item) => item.kind === 'COMMENT')
      case 'statuses':
        return unifiedNotifications.filter((item) => item.kind === 'STATUS')
      case 'assignments':
        return unifiedNotifications.filter((item) => item.kind === 'ASSIGNMENT')
      case 'system':
        return unifiedNotifications.filter((item) => item.kind === 'SYSTEM')
      default:
        return unifiedNotifications
    }
  }, [activeFilter, unifiedNotifications])

  const {
    containerRef: notificationsRef,
    virtualItems: notificationVirtualItems,
    totalSize: notificationsTotalSize,
  } = useVirtualList({
    items: filteredNotifications,
    itemHeight: notificationRowHeight,
    overscan: 4,
    getKey: (item) => item.id,
    containerHeight: notificationListHeight,
  })

  const markNotificationRead = async (id: string) => {
    const previous = userNotifications
    setUserNotifications((prev) =>
      (prev ?? []).map((n) => (n.id === id ? { ...n, isRead: true } : n))
    )

    const result = await updateNotifications.mutate({ ids: [id] })
    if (!result) {
      console.error('Failed to mark notification read')
      setUserNotifications(previous)
    }
  }

  const markAllRead = async () => {
    const previous = userNotifications
    setUserNotifications((prev) => (prev ?? []).map((n) => ({ ...n, isRead: true })))

    const result = await updateNotifications.mutate({ all: true })
    if (!result) {
      console.error('Failed to mark all notifications read')
      setUserNotifications(previous)
    }
  }

  const snoozeDeadline = useCallback((letterId: string) => {
    const until = getTomorrowStartIso()
    setSnoozedDeadlines((prev) => ({ ...prev, [letterId]: until }))
  }, [])

  const snoozeAllDeadlines = useCallback(() => {
    const until = getTomorrowStartIso()
    setSnoozedDeadlines((prev) => {
      const next = { ...prev }
      deadlineNotifications.forEach((notif) => {
        if (notif.letter?.id) {
          next[notif.letter.id] = until
        }
      })
      return next
    })
  }, [deadlineNotifications])

  const clearSnoozes = useCallback(() => {
    setSnoozedDeadlines({})
  }, [])

  const assignToMe = async (letterId: string) => {
    if (!currentUserId) return
    const res = await fetch(`/api/letters/${letterId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: 'owner', value: currentUserId }),
    })

    if (!res.ok) {
      toast.error('Не удалось назначить')
      return
    }

    toast.success('Вы назначены исполнителем')
    userNotificationsQuery.refetch()
    overdueQuery.refetch()
    urgentQuery.refetch()
  }

  const filterConfig: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: 'Все', count: counts.all },
    {
      key: 'unread',
      label: 'Непрочитанные',
      count: counts.unread,
    },
    {
      key: 'deadlines',
      label: 'Дедлайны',
      count: counts.deadlines,
    },
    {
      key: 'comments',
      label: 'Комментарии',
      count: counts.comments,
    },
    {
      key: 'statuses',
      label: 'Статусы',
      count: counts.statuses,
    },
    {
      key: 'assignments',
      label: 'Назначения',
      count: counts.assignments,
    },
    {
      key: 'system',
      label: 'Системные',
      count: counts.system,
    },
  ]

  const hasActiveSnoozes = useMemo(() => {
    const now = Date.now()
    return Object.values(snoozedDeadlines).some((until) => new Date(until).getTime() > now)
  }, [snoozedDeadlines])

  const renderNotificationTitle = (item: UnifiedNotification) => {
    if (!isDeadlineKind(item.kind)) {
      return item.title
    }
    const days = item.daysLeft ?? 0
    if (item.kind === 'DEADLINE_OVERDUE') {
      return `Просрочено на ${Math.abs(days)} ${pluralizeDays(days)}`
    }
    return `Дедлайн через ${days} ${pluralizeDays(days)}`
  }

  const renderNotificationMeta = (item: UnifiedNotification) => {
    if (isDeadlineKind(item.kind)) {
      return <span>Срок: {formatDate(item.letter?.deadlineDate || '')}</span>
    }
    return <span>{new Date(item.createdAt).toLocaleString('ru-RU')}</span>
  }

  const renderNotificationIcon = (item: UnifiedNotification) => {
    const commonClass = 'w-4 h-4'
    switch (item.kind) {
      case 'COMMENT':
        return { icon: MessageSquare, color: 'text-sky-400', bg: 'bg-sky-500/20', cls: commonClass }
      case 'STATUS':
        return {
          icon: CheckCircle2,
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/20',
          cls: commonClass,
        }
      case 'ASSIGNMENT':
        return {
          icon: UserPlus,
          color: 'text-purple-400',
          bg: 'bg-purple-500/20',
          cls: commonClass,
        }
      case 'SYSTEM':
        return { icon: Info, color: 'text-slate-300', bg: 'bg-slate-800/80', cls: commonClass }
      case 'DEADLINE_OVERDUE':
        return { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20', cls: commonClass }
      case 'DEADLINE_URGENT':
        return { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20', cls: commonClass }
      default:
        return { icon: Bell, color: 'text-slate-300', bg: 'bg-slate-800/80', cls: commonClass }
    }
  }

  useEffect(() => {
    if (!isOpen) return
    pruneSnoozes()
  }, [isOpen, pruneSnoozes])

  return (
    <div className="relative">
      <button
        onClick={() => {
          setIsOpen((prev) => {
            const next = !prev
            if (next) {
              setLoadDeadlineNotifications(true)
            }
            return next
          })
        }}
        className="relative p-2 text-slate-400 transition hover:text-white"
        aria-label="Уведомления"
      >
        <Bell className="h-5 w-5" />
        {totalCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 top-full z-50 mt-2 flex h-[72vh] max-h-[78vh] min-h-[420px] w-[30rem] flex-col overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/95 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="flex items-start justify-between border-b border-slate-700/70 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-white">Уведомления</h3>
                  {counts.unread > 0 && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                      {counts.unread}
                    </span>
                  )}
                </div>
                {counts.all > 0 && (
                  <div className="mt-1 text-xs text-slate-500">
                    Непрочитанные: {counts.unread} · Дедлайны: {counts.deadlines}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 text-right">
                {counts.unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="rounded-md px-2 py-1 text-xs text-emerald-300 transition hover:bg-emerald-500/10 hover:text-emerald-200"
                  >
                    Прочитать все
                  </button>
                )}
                {counts.deadlines > 0 && !hasActiveSnoozes && (
                  <button
                    onClick={snoozeAllDeadlines}
                    className="rounded-md px-2 py-1 text-xs text-slate-300 transition hover:bg-slate-800/80 hover:text-slate-100"
                  >
                    Скрыть дедлайны
                  </button>
                )}
                {hasActiveSnoozes && (
                  <button
                    onClick={clearSnoozes}
                    className="rounded-md px-2 py-1 text-xs text-slate-300 transition hover:bg-slate-800/80 hover:text-slate-100"
                  >
                    Показать дедлайны
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-md p-1 text-slate-400 transition hover:bg-slate-800/70 hover:text-white"
                  aria-label="Закрыть уведомления"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-800/80 bg-slate-900/70 px-4 py-2">
              {filterConfig.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                    activeFilter === filter.key
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200 shadow-sm'
                      : 'border-slate-700/60 text-slate-400 hover:border-slate-600/70 hover:text-slate-200'
                  }`}
                >
                  {filter.label}
                  {filter.count > 0 && (
                    <span
                      className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${
                        activeFilter === filter.key
                          ? 'bg-emerald-500/20 text-emerald-200'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {filter.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div
              ref={notificationsRef}
              className="flex-1 overflow-y-auto px-1"
              style={{ maxHeight: notificationListHeight }}
            >
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-10 text-slate-500">
                  <Bell className="h-6 w-6 text-slate-600" />
                  <div className="text-sm">Пока нет уведомлений</div>
                  <div className="text-xs text-slate-600">Новые события появятся здесь.</div>
                </div>
              ) : (
                <div className="relative" style={{ height: `${notificationsTotalSize}px` }}>
                  {notificationVirtualItems.map((virtualItem) => {
                    const notif = filteredNotifications[virtualItem.index]
                    const iconConfig = renderNotificationIcon(notif)
                    const Icon = iconConfig.icon
                    const isUnread = !isDeadlineKind(notif.kind) && notif.isRead === false
                    const linkTarget = notif.letter?.id ? `/letters/${notif.letter.id}` : '/letters'

                    return (
                      <Link
                        key={notif.id}
                        href={linkTarget}
                        onClick={() => {
                          if (!isDeadlineKind(notif.kind)) {
                            markNotificationRead(notif.id)
                          }
                          setIsOpen(false)
                        }}
                        className={`absolute left-3 right-3 flex items-start gap-3 rounded-xl border px-4 py-3 transition ${
                          isUnread
                            ? 'border-emerald-500/30 bg-emerald-500/10'
                            : 'border-slate-800/60 bg-slate-900/40'
                        } hover:border-slate-600/70 hover:bg-slate-800/70`}
                        style={{
                          top: `${virtualItem.start}px`,
                          height: `${virtualItem.size}px`,
                        }}
                      >
                        <div
                          className={`rounded-lg p-2 ring-1 ring-white/10 ${iconConfig.bg} ${iconConfig.color}`}
                        >
                          <Icon className={iconConfig.cls} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">
                              {renderNotificationTitle(notif)}
                            </span>
                            {isUnread && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
                          </div>
                          {notif.body && (
                            <div className="mt-1 line-clamp-2 text-xs text-slate-300">
                              {notif.body}
                            </div>
                          )}
                          {notif.letter?.org && (
                            <div className="mt-1 truncate text-xs text-slate-400">
                              {notif.letter.org}
                            </div>
                          )}
                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                            <span>{getKindLabel(notif.kind)}</span>
                            <span>•</span>
                            {renderNotificationMeta(notif)}
                            {notif.letter?.number && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-emerald-300">
                                  №{notif.letter.number}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                            {!isDeadlineKind(notif.kind) && notif.isRead === false && (
                              <button
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  markNotificationRead(notif.id)
                                }}
                                className="rounded-full bg-slate-800/80 px-2.5 py-1 text-slate-200 transition hover:bg-slate-700"
                              >
                                Отметить прочитанным
                              </button>
                            )}
                            {isDeadlineKind(notif.kind) && notif.letter?.id && (
                              <button
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  if (notif.letter?.id) {
                                    snoozeDeadline(notif.letter.id)
                                  }
                                }}
                                className="rounded-full bg-slate-800/80 px-2.5 py-1 text-slate-200 transition hover:bg-slate-700"
                              >
                                Скрыть до завтра
                              </button>
                            )}
                            {canManageLetters &&
                              currentUserId &&
                              notif.letter?.id &&
                              !notif.letter?.owner && (
                                <button
                                  onClick={(event) => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    assignToMe(notif.letter!.id)
                                  }}
                                  className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-200 transition hover:bg-emerald-500/25"
                                >
                                  Назначить себя
                                </button>
                              )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-500" />
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-800/80">
              <Link
                href="/settings"
                onClick={() => setIsOpen(false)}
                className="block px-4 py-3 text-center text-sm text-slate-400 transition hover:text-slate-200"
              >
                Настройки уведомлений
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

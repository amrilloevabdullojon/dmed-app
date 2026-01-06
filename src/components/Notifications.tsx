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
      return '\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439'
    case 'STATUS':
      return '\u0421\u0442\u0430\u0442\u0443\u0441'
    case 'ASSIGNMENT':
      return '\u041d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435'
    case 'SYSTEM':
      return '\u0421\u0438\u0441\u0442\u0435\u043c\u043d\u043e\u0435'
    case 'DEADLINE_OVERDUE':
      return '\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043e'
    case 'DEADLINE_URGENT':
      return '\u0421\u0440\u043e\u0447\u043d\u043e'
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
  const notificationRowHeight = 124

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
      toast.error(
        '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043d\u0430\u0437\u043d\u0430\u0447\u0438\u0442\u044c'
      )
      return
    }

    toast.success(
      '\u0412\u044b \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u044b \u0438\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u0435\u043c'
    )
    userNotificationsQuery.refetch()
    overdueQuery.refetch()
    urgentQuery.refetch()
  }

  const filterConfig: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: '\u0412\u0441\u0435', count: counts.all },
    {
      key: 'unread',
      label: '\u041d\u0435\u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043d\u044b\u0435',
      count: counts.unread,
    },
    {
      key: 'deadlines',
      label: '\u0414\u0435\u0434\u043b\u0430\u0439\u043d\u044b',
      count: counts.deadlines,
    },
    {
      key: 'comments',
      label: '\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0438',
      count: counts.comments,
    },
    {
      key: 'statuses',
      label: '\u0421\u0442\u0430\u0442\u0443\u0441\u044b',
      count: counts.statuses,
    },
    {
      key: 'assignments',
      label: '\u041d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u044f',
      count: counts.assignments,
    },
    {
      key: 'system',
      label: '\u0421\u0438\u0441\u0442\u0435\u043c\u043d\u044b\u0435',
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
      return `\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043e \u043d\u0430 ${Math.abs(
        days
      )} ${pluralizeDays(days)}`
    }
    return `\u0414\u0435\u0434\u043b\u0430\u0439\u043d \u0447\u0435\u0440\u0435\u0437 ${days} ${pluralizeDays(
      days
    )}`
  }

  const renderNotificationMeta = (item: UnifiedNotification) => {
    if (isDeadlineKind(item.kind)) {
      return <span>\u0421\u0440\u043e\u043a: {formatDate(item.letter?.deadlineDate || '')}</span>
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
        return { icon: Info, color: 'text-gray-300', bg: 'bg-gray-700', cls: commonClass }
      case 'DEADLINE_OVERDUE':
        return { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20', cls: commonClass }
      case 'DEADLINE_URGENT':
        return { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20', cls: commonClass }
      default:
        return { icon: Bell, color: 'text-gray-300', bg: 'bg-gray-700', cls: commonClass }
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
        className="relative p-2 text-gray-400 transition hover:text-white"
        aria-label="Notifications"
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

          <div className="absolute right-0 top-full z-50 mt-2 flex max-h-[75vh] w-[28rem] flex-col overflow-hidden rounded-lg border border-gray-700 bg-gray-800 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-white">
                  \u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f
                </h3>
                {counts.unread > 0 && (
                  <span className="text-xs text-emerald-400">{counts.unread}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {counts.unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-emerald-400 transition hover:text-emerald-300"
                  >
                    \u041f\u0440\u043e\u0447\u0438\u0442\u0430\u0442\u044c \u0432\u0441\u0435
                  </button>
                )}
                {counts.deadlines > 0 && (
                  <button
                    onClick={snoozeAllDeadlines}
                    className="text-xs text-gray-400 transition hover:text-gray-300"
                  >
                    \u0421\u043a\u0440\u044b\u0442\u044c
                    \u0434\u0435\u0434\u043b\u0430\u0439\u043d\u044b
                  </button>
                )}
                {hasActiveSnoozes && (
                  <button
                    onClick={clearSnoozes}
                    className="text-xs text-gray-400 transition hover:text-gray-300"
                  >
                    \u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c
                    \u0434\u0435\u0434\u043b\u0430\u0439\u043d\u044b
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-gray-400 transition hover:text-white"
                  aria-label="Close notifications"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto border-b border-gray-700 px-4 py-2">
              {filterConfig.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs transition ${
                    activeFilter === filter.key
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : 'border-gray-700 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {filter.label}
                  {filter.count > 0 && <span className="ml-1">({filter.count})</span>}
                </button>
              ))}
            </div>

            <div ref={notificationsRef} className="flex-1 overflow-y-auto">
              {filteredNotifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  \u041d\u0435\u0442
                  \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439
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
                        className={`absolute left-0 right-0 flex items-start gap-3 border-b border-gray-700 px-4 py-3 transition ${
                          isUnread ? 'bg-emerald-500/5' : 'bg-transparent'
                        } hover:bg-gray-700/50`}
                        style={{
                          top: `${virtualItem.start}px`,
                          height: `${virtualItem.size}px`,
                        }}
                      >
                        <div className={`rounded-lg p-2 ${iconConfig.bg} ${iconConfig.color}`}>
                          <Icon className={iconConfig.cls} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white">
                              {renderNotificationTitle(notif)}
                            </span>
                            {isUnread && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
                          </div>
                          {notif.body && (
                            <div className="mt-1 line-clamp-2 text-xs text-gray-400">
                              {notif.body}
                            </div>
                          )}
                          {notif.letter?.org && (
                            <div className="mt-1 truncate text-xs text-gray-500">
                              {notif.letter.org}
                            </div>
                          )}
                          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                            <span>{getKindLabel(notif.kind)}</span>
                            <span>•</span>
                            {renderNotificationMeta(notif)}
                            {notif.letter?.number && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-emerald-400">
                                  №{notif.letter.number}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            {!isDeadlineKind(notif.kind) && notif.isRead === false && (
                              <button
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  markNotificationRead(notif.id)
                                }}
                                className="rounded bg-gray-700 px-2 py-1 text-gray-300 transition hover:text-white"
                              >
                                \u041e\u0442\u043c\u0435\u0442\u0438\u0442\u044c
                                \u043f\u0440\u043e\u0447\u0438\u0442\u0430\u043d\u043d\u044b\u043c
                              </button>
                            )}
                            {isDeadlineKind(notif.kind) && notif.letter?.id && (
                              <button
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  snoozeDeadline(notif.letter.id)
                                }}
                                className="rounded bg-gray-700 px-2 py-1 text-gray-300 transition hover:text-white"
                              >
                                \u0421\u043a\u0440\u044b\u0442\u044c \u0434\u043e
                                \u0437\u0430\u0432\u0442\u0440\u0430
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
                                  className="rounded bg-emerald-500/20 px-2 py-1 text-emerald-300 transition hover:text-emerald-200"
                                >
                                  \u041d\u0430\u0437\u043d\u0430\u0447\u0438\u0442\u044c
                                  \u0441\u0435\u0431\u044f
                                </button>
                              )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-500" />
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-gray-700">
              <Link
                href="/settings"
                onClick={() => setIsOpen(false)}
                className="block px-4 py-3 text-center text-sm text-gray-400 transition hover:text-gray-300"
              >
                \u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438
                \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

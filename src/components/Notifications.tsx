'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Info,
  Search,
  MessageSquare,
  UserPlus,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { formatDate, getWorkingDaysUntilDeadline, pluralizeDays } from '@/lib/utils'
import { hasPermission } from '@/lib/permissions'
import { useFetch, useMutation } from '@/hooks/useFetch'
import { useNotificationSettings } from '@/hooks/useNotificationSettings'
import { useToast } from '@/components/Toast'
import { hapticLight, hapticMedium } from '@/lib/haptic'
import { isWithinQuietHours } from '@/lib/notification-settings'

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
  type: 'NEW_LETTER' | 'COMMENT' | 'STATUS' | 'ASSIGNMENT' | 'SYSTEM'
  title: string
  body: string | null
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' | null
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
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' | null
  createdAt: string
  isRead?: boolean
  letter?: NotificationLetter | null
  daysLeft?: number
}

type FilterKey = 'all' | 'unread' | 'deadlines' | 'comments' | 'statuses' | 'assignments' | 'system'

interface NotificationGroup extends UnifiedNotification {
  count: number
  ids: string[]
  unreadCount: number
}

const SNOOZE_KEY = 'notification-deadline-snoozes'
const NOTIFICATIONS_LIMIT = 100
const NOTIFICATIONS_INCREMENT = 50
const DEADLINES_LIMIT = 100

const getTomorrowStartIso = () => {
  const now = new Date()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return tomorrow.toISOString()
}

const isDeadlineKind = (kind: UnifiedKind) =>
  kind === 'DEADLINE_OVERDUE' || kind === 'DEADLINE_URGENT'

const getKindLabel = (kind: UnifiedKind) => {
  switch (kind) {
    case 'NEW_LETTER':
      return '\u041d\u043e\u0432\u044b\u0435 \u043f\u0438\u0441\u044c\u043c\u0430'
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
      return 'Скоро дедлайн'
    default:
      return ''
  }
}

const getSectionTitle = (dateValue: string) => {
  const parsed = new Date(dateValue)
  if (Number.isNaN(parsed.getTime())) return 'Недавно'

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dateStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
  const diffDays = Math.floor((todayStart.getTime() - dateStart.getTime()) / 86400000)

  if (diffDays === 0) return 'Сегодня'
  if (diffDays === 1) return 'Вчера'
  return formatDate(parsed)
}

const isCorruptedText = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return true
  const questionMarks = (trimmed.match(/\?/g) || []).length
  return questionMarks >= Math.max(3, Math.ceil(trimmed.length * 0.3))
}

const buildFallbackTitle = (item: UnifiedNotification) => {
  const number = item.letter?.number ? `№${item.letter.number}` : ''
  const suffix = number ? ` ${number}` : ''

  switch (item.kind) {
    case 'COMMENT':
      return `Новый комментарий к письму${suffix}`
    case 'STATUS':
      return `Статус письма${suffix} изменен`
    case 'ASSIGNMENT':
      return `Вам назначено письмо${suffix}`
    case 'SYSTEM':
      return 'Системное уведомление'
    default:
      return item.title || 'Уведомление'
  }
}

const decodeUnicodeEscapes = (value: string) => {
  let result = value
  for (let i = 0; i < 2; i += 1) {
    const next = result
      .replace(/\\\\u([0-9a-fA-F]{4})/g, '\\u$1')
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    if (next === result) break
    result = next
  }
  return result
}

const normalizeText = (value?: string | null) => {
  if (!value) return ''
  const decoded = decodeUnicodeEscapes(value)
  return decoded.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n')
}

export function Notifications() {
  const toast = useToast()
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [notificationsLimit, setNotificationsLimit] = useState(NOTIFICATIONS_LIMIT)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loadDeadlineNotifications, setLoadDeadlineNotifications] = useState(false)
  const [snoozedDeadlines, setSnoozedDeadlines] = useState<Record<string, string>>({})
  const { settings: notificationSettings, updateSettings } = useNotificationSettings()

  const canManageLetters = hasPermission(session?.user.role, 'MANAGE_LETTERS')
  const currentUserId = session?.user.id
  const matrixByEvent = useMemo(
    () => new Map(notificationSettings.matrix.map((item) => [item.event, item])),
    [notificationSettings.matrix]
  )

  const resolvePriority = useCallback(
    (item: UnifiedNotification) => {
      if (item.priority) return item.priority
      const matrixItem = matrixByEvent.get(item.kind)
      if (matrixItem?.priority)
        return matrixItem.priority.toUpperCase() as UnifiedNotification['priority']
      if (item.kind === 'DEADLINE_OVERDUE') return 'CRITICAL'
      if (item.kind === 'DEADLINE_URGENT') return 'HIGH'
      return 'NORMAL'
    },
    [matrixByEvent]
  )

  const isInAppEnabledForEvent = useCallback(
    (kind: UnifiedKind) => {
      const matrixItem = matrixByEvent.get(kind)
      return matrixItem ? matrixItem.channels.inApp : true
    },
    [matrixByEvent]
  )

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
  const quietHoursActive =
    notificationSettings.quietHoursEnabled &&
    isWithinQuietHours(
      new Date(),
      notificationSettings.quietHoursStart,
      notificationSettings.quietHoursEnd
    )

  const userNotificationsQuery = useFetch<UserNotification[]>(
    `/api/notifications?limit=${notificationsLimit}`,
    {
      initialData: [],
      transform: (data) => (data as { notifications?: UserNotification[] }).notifications || [],
      refetchInterval,
      refetchOnFocus: true,
    }
  )
  const overdueQuery = useFetch<{ letters?: DeadlineLetter[] }>(
    `/api/letters?filter=overdue&limit=${DEADLINES_LIMIT}`,
    {
      initialData: { letters: [] },
      skip: !loadDeadlineNotifications,
      refetchInterval: loadDeadlineNotifications ? refetchInterval : undefined,
    }
  )
  const urgentQuery = useFetch<{ letters?: DeadlineLetter[] }>(
    `/api/letters?filter=urgent&limit=${DEADLINES_LIMIT}`,
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
      priority: 'CRITICAL',
      createdAt: letter.deadlineDate,
      letter,
      daysLeft: getWorkingDaysUntilDeadline(letter.deadlineDate),
    }))
    const urgent: UnifiedNotification[] = (urgentQuery.data?.letters || []).map((letter) => ({
      id: `deadline-urgent-${letter.id}`,
      kind: 'DEADLINE_URGENT' as const,
      title: '',
      body: null,
      priority: 'HIGH',
      createdAt: letter.deadlineDate,
      letter,
      daysLeft: getWorkingDaysUntilDeadline(letter.deadlineDate),
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
      priority: notif.priority ?? undefined,
      createdAt: notif.createdAt,
      isRead: notif.isRead,
      letter: notif.letter ?? null,
    }))
    const all = [...userItems, ...deadlineNotifications]

    const getPriority = (item: UnifiedNotification) => {
      const priority = resolvePriority(item)
      if (priority === 'CRITICAL') return 3
      if (priority === 'HIGH') return 2
      if (priority === 'NORMAL') return 1
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
  }, [deadlineNotifications, resolvePriority, userNotifications])

  const isImportantNotification = useCallback(
    (item: UnifiedNotification) => {
      if (isDeadlineKind(item.kind)) return true
      const priority = resolvePriority(item)
      if (priority === 'HIGH' || priority === 'CRITICAL') return true
      return item.isRead === false
    },
    [resolvePriority]
  )

  const settingsFilteredNotifications = useMemo(() => {
    if (!notificationSettings.inAppNotifications) return []

    return unifiedNotifications.filter((item) => {
      if (!isInAppEnabledForEvent(item.kind)) return false
      if (item.kind === 'NEW_LETTER' && !notificationSettings.notifyOnNewLetter) return false
      if (item.kind === 'COMMENT' && !notificationSettings.notifyOnComment) return false
      if (item.kind === 'STATUS' && !notificationSettings.notifyOnStatusChange) return false
      if (item.kind === 'ASSIGNMENT' && !notificationSettings.notifyOnAssignment) return false
      if (item.kind === 'SYSTEM' && !notificationSettings.notifyOnSystem) return false
      if (isDeadlineKind(item.kind) && !notificationSettings.notifyOnDeadline) return false
      if (
        quietHoursActive &&
        notificationSettings.quietMode === 'important' &&
        !isImportantNotification(item)
      ) {
        return false
      }
      return true
    })
  }, [
    notificationSettings.inAppNotifications,
    notificationSettings.notifyOnNewLetter,
    notificationSettings.notifyOnComment,
    notificationSettings.notifyOnStatusChange,
    notificationSettings.notifyOnAssignment,
    notificationSettings.notifyOnSystem,
    notificationSettings.notifyOnDeadline,
    notificationSettings.quietMode,
    isImportantNotification,
    isInAppEnabledForEvent,
    quietHoursActive,
    unifiedNotifications,
  ])

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

    settingsFilteredNotifications.forEach((item) => {
      base.all += 1
      if (item.kind === 'COMMENT') base.comments += 1
      if (item.kind === 'STATUS') base.statuses += 1
      if (item.kind === 'ASSIGNMENT') base.assignments += 1
      if (item.kind === 'SYSTEM') base.system += 1
      if (isDeadlineKind(item.kind)) base.deadlines += 1
      if (!isDeadlineKind(item.kind) && item.isRead === false) base.unread += 1
    })

    return base
  }, [settingsFilteredNotifications])

  const totalCount = counts.unread + counts.deadlines
  const canLoadMore =
    !userNotificationsQuery.isLoading &&
    notificationsLimit < 200 &&
    userNotifications.length >= notificationsLimit

  const searchValue = searchQuery.trim().toLowerCase()

  const matchesSearch = useCallback(
    (item: UnifiedNotification) => {
      if (!searchValue) return true
      const title = normalizeText(item.title).toLowerCase()
      const body = normalizeText(item.body).toLowerCase()
      const org = normalizeText(item.letter?.org).toLowerCase()
      const number = item.letter?.number ? item.letter.number.toLowerCase() : ''
      const owner = item.letter?.owner?.name ? item.letter.owner.name.toLowerCase() : ''
      const haystack = [title, body, org, number, owner].filter(Boolean).join(' ')
      return haystack.includes(searchValue)
    },
    [searchValue]
  )

  const filteredNotifications = useMemo(() => {
    let list = settingsFilteredNotifications
    switch (activeFilter) {
      case 'unread':
        list = list.filter((item) => !isDeadlineKind(item.kind) && item.isRead === false)
        break
      case 'deadlines':
        list = list.filter((item) => isDeadlineKind(item.kind))
        break
      case 'comments':
        list = list.filter((item) => item.kind === 'COMMENT')
        break
      case 'statuses':
        list = list.filter((item) => item.kind === 'STATUS')
        break
      case 'assignments':
        list = list.filter((item) => item.kind === 'ASSIGNMENT')
        break
      case 'system':
        list = list.filter((item) => item.kind === 'SYSTEM')
        break
      default:
        break
    }
    if (searchValue) {
      list = list.filter((item) => matchesSearch(item))
    }
    return list
  }, [activeFilter, matchesSearch, searchValue, settingsFilteredNotifications])

  const groupedNotifications = useMemo<NotificationGroup[]>(() => {
    if (!notificationSettings.groupSimilar) {
      return filteredNotifications.map((item) => ({
        ...item,
        count: 1,
        ids: !isDeadlineKind(item.kind) ? [item.id] : [],
        unreadCount: !isDeadlineKind(item.kind) && item.isRead === false ? 1 : 0,
      }))
    }

    const groups: NotificationGroup[] = []
    const indexByKey = new Map<string, number>()

    const buildGroupKey = (item: UnifiedNotification) => {
      const letterKey = item.letter?.id ?? 'no-letter'
      if (isDeadlineKind(item.kind)) {
        return `${item.kind}-${letterKey}`
      }
      const title = normalizeText(item.title).trim().toLowerCase()
      const body = normalizeText(item.body).trim().toLowerCase()
      return `${item.kind}-${letterKey}-${title}-${body}`
    }

    filteredNotifications.forEach((item) => {
      const key = buildGroupKey(item)
      const existingIndex = indexByKey.get(key)

      if (existingIndex === undefined) {
        groups.push({
          ...item,
          count: 1,
          ids: !isDeadlineKind(item.kind) ? [item.id] : [],
          unreadCount: !isDeadlineKind(item.kind) && item.isRead === false ? 1 : 0,
        })
        indexByKey.set(key, groups.length - 1)
        return
      }

      const group = groups[existingIndex]
      group.count += 1
      if (!isDeadlineKind(item.kind)) {
        group.ids.push(item.id)
        if (item.isRead === false) {
          group.unreadCount += 1
        }
      }
    })

    return groups
  }, [filteredNotifications, notificationSettings.groupSimilar])

  const notificationSections = useMemo(() => {
    if (groupedNotifications.length === 0) return []
    const sections: { id: string; title: string; items: NotificationGroup[] }[] = []

    groupedNotifications.forEach((item) => {
      const sectionDate = isDeadlineKind(item.kind)
        ? (item.letter?.deadlineDate ?? item.createdAt)
        : item.createdAt
      const title = getSectionTitle(sectionDate)
      const last = sections[sections.length - 1]

      if (!last || last.title !== title) {
        sections.push({ id: `${title}-${sections.length}`, title, items: [item] })
      } else {
        last.items.push(item)
      }
    })

    return sections
  }, [groupedNotifications])

  const markNotificationsRead = async (ids: string[]) => {
    if (ids.length === 0) return
    const previous = userNotifications
    const idSet = new Set(ids)
    setUserNotifications((prev) =>
      (prev ?? []).map((n) => (idSet.has(n.id) ? { ...n, isRead: true } : n))
    )

    const result = await updateNotifications.mutate({ ids })
    if (!result) {
      console.error('Failed to mark notifications read')
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
      toast.error('Не удалось назначить владельца')
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

  const checkHasActiveSnoozes = () => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    return Object.values(snoozedDeadlines).some((until) => new Date(until).getTime() > now)
  }

  const renderNotificationTitle = (item: UnifiedNotification) => {
    if (!isDeadlineKind(item.kind)) {
      const normalizedTitle = normalizeText(item.title)
      if (!normalizedTitle || isCorruptedText(normalizedTitle)) {
        return buildFallbackTitle(item)
      }
      return normalizedTitle
    }
    const days = item.daysLeft ?? 0
    if (item.kind === 'DEADLINE_OVERDUE') {
      const absDays = Math.abs(days)
      return `Просрочено на ${absDays} раб. ${pluralizeDays(absDays)}`
    }
    return `До дедлайна ${days} раб. ${pluralizeDays(days)}`
  }

  const renderNotificationMeta = (item: UnifiedNotification) => {
    if (isDeadlineKind(item.kind)) {
      return <span>Дедлайн: {formatDate(item.letter?.deadlineDate || '')}</span>
    }
    return <span>{new Date(item.createdAt).toLocaleString('ru-RU')}</span>
  }

  const renderNotificationIcon = (item: UnifiedNotification) => {
    const commonClass = 'w-4 h-4'
    switch (item.kind) {
      case 'NEW_LETTER':
        return {
          icon: FileText,
          color: 'text-emerald-300',
          bg: 'bg-emerald-500/20',
          cls: commonClass,
        }
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

  useEffect(() => {
    if (isOpen && notificationSettings.notifyOnDeadline) {
      setLoadDeadlineNotifications(true)
    }
  }, [isOpen, notificationSettings.notifyOnDeadline])

  const isLoading = userNotificationsQuery.isLoading && unifiedNotifications.length === 0
  const isNotificationsDisabled = !notificationSettings.inAppNotifications
  const isSearchActive = searchValue.length > 0

  return (
    <div className="relative">
      <button
        onClick={() => {
          hapticLight()
          setIsOpen((prev) => {
            const next = !prev
            if (next) {
              if (notificationSettings.notifyOnDeadline) {
                setLoadDeadlineNotifications(true)
              }
            }
            return next
          })
        }}
        className="tap-highlight relative p-2 text-slate-400 transition hover:text-white"
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

          <div className="fixed inset-x-3 top-16 z-50 mt-0 flex h-[75vh] max-h-[85vh] min-h-[320px] w-auto flex-col overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-b from-slate-900/95 via-slate-900/95 to-slate-950/95 shadow-2xl shadow-black/40 ring-1 ring-white/5 backdrop-blur sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:h-[72vh] sm:max-h-[78vh] sm:min-h-[420px] sm:w-[30rem]">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
              <div className="absolute -left-20 bottom-20 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.35),transparent_55%)]" />
            </div>

            <div className="relative z-10 flex flex-col gap-3 border-b border-slate-700/70 bg-slate-950/50 px-4 py-3 backdrop-blur sm:flex-row sm:items-start sm:justify-between">
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
              <div className="flex w-full flex-wrap items-center justify-start gap-2 text-left sm:w-auto sm:justify-end sm:text-right">
                {counts.unread > 0 && (
                  <button
                    onClick={() => {
                      hapticMedium()
                      markAllRead()
                    }}
                    className="tap-highlight rounded-md border border-emerald-500/20 px-2 py-1 text-xs text-emerald-200 transition hover:border-emerald-400/40 hover:bg-emerald-500/15"
                  >
                    Отметить все прочитанными
                  </button>
                )}
                {counts.deadlines > 0 && !checkHasActiveSnoozes() && (
                  <button
                    onClick={() => {
                      hapticLight()
                      snoozeAllDeadlines()
                    }}
                    className="tap-highlight rounded-md border border-slate-700/60 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500/70 hover:bg-slate-800/80 hover:text-slate-100"
                  >
                    Скрыть дедлайны до завтра
                  </button>
                )}
                {checkHasActiveSnoozes() && (
                  <button
                    onClick={() => {
                      hapticLight()
                      clearSnoozes()
                    }}
                    className="tap-highlight rounded-md border border-slate-700/60 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500/70 hover:bg-slate-800/80 hover:text-slate-100"
                  >
                    Показать дедлайны
                  </button>
                )}
                <button
                  onClick={() => {
                    hapticLight()
                    setIsOpen(false)
                  }}
                  className="tap-highlight rounded-md p-1 text-slate-400 transition hover:bg-slate-800/70 hover:text-white"
                  aria-label="Закрыть уведомления"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="relative z-10 border-b border-slate-800/80 bg-slate-900/70 px-4 py-3 shadow-inner shadow-black/20">
              <div className="flex items-center gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible">
                {filterConfig.map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => {
                      hapticLight()
                      setActiveFilter(filter.key)
                    }}
                    className={`tap-highlight shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                      activeFilter === filter.key
                        ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200 shadow-sm shadow-emerald-500/20'
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
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="relative flex min-w-[220px] flex-1 items-center">
                  <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-500" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Поиск по уведомлениям"
                    className="h-9 w-full rounded-full border border-slate-800/70 bg-slate-900/80 pl-9 pr-9 text-xs text-white placeholder:text-slate-500 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        hapticLight()
                        setSearchQuery('')
                      }}
                      className="tap-highlight absolute right-2 rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
                      aria-label="Сбросить поиск"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {
                    hapticLight()
                    updateSettings({
                      groupSimilar: !notificationSettings.groupSimilar,
                    })
                  }}
                  className={`tap-highlight rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                    notificationSettings.groupSimilar
                      ? 'border-slate-500/70 bg-slate-800/80 text-slate-100'
                      : 'border-slate-700/60 text-slate-400 hover:border-slate-600/70 hover:text-slate-200'
                  }`}
                >
                  Группировать
                </button>
                <button
                  onClick={() => {
                    hapticLight()
                    updateSettings({
                      showPreviews: !notificationSettings.showPreviews,
                    })
                  }}
                  className={`tap-highlight rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                    notificationSettings.showPreviews
                      ? 'border-slate-500/70 bg-slate-800/80 text-slate-100'
                      : 'border-slate-700/60 text-slate-400 hover:border-slate-600/70 hover:text-slate-200'
                  }`}
                >
                  Превью
                </button>
                <button
                  onClick={() => {
                    hapticLight()
                    updateSettings({
                      showOrganizations: !notificationSettings.showOrganizations,
                    })
                  }}
                  className={`tap-highlight rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                    notificationSettings.showOrganizations
                      ? 'border-slate-500/70 bg-slate-800/80 text-slate-100'
                      : 'border-slate-700/60 text-slate-400 hover:border-slate-600/70 hover:text-slate-200'
                  }`}
                >
                  Учреждения
                </button>
              </div>
              {quietHoursActive && (
                <div className="mt-2 text-[11px] text-amber-200">
                  Тихие часы активны —{' '}
                  {notificationSettings.quietMode === 'important'
                    ? 'показываем только важные'
                    : 'показываем все'}
                  .
                </div>
              )}
            </div>

            <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4">
              {isLoading ? (
                <div className="flex flex-col items-center gap-2 p-10 text-slate-500">
                  <Bell className="h-6 w-6 text-slate-600" />
                  <div className="text-sm">Загружаем уведомления...</div>
                </div>
              ) : isNotificationsDisabled ? (
                <div className="flex flex-col items-center gap-2 p-10 text-slate-500">
                  <Bell className="h-6 w-6 text-slate-600" />
                  <div className="text-sm">Уведомления отключены</div>
                  <div className="text-xs text-slate-600">
                    Включите их в настройках, чтобы получать обновления.
                  </div>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-10 text-slate-500">
                  <Bell className="h-6 w-6 text-slate-600" />
                  <div className="text-sm">
                    {isSearchActive ? 'Ничего не найдено' : 'Пока нет уведомлений'}
                  </div>
                  <div className="text-xs text-slate-600">
                    {isSearchActive
                      ? 'Попробуйте изменить запрос или фильтры.'
                      : 'Новые события появятся здесь автоматически.'}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {notificationSections.map((section) => (
                    <div key={section.id} className="space-y-3">
                      <div className="sticky top-0 z-10 -mx-4 border-b border-slate-800/70 bg-slate-900/90 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-slate-500 backdrop-blur">
                        {section.title}
                      </div>
                      {section.items.map((notif) => {
                        const iconConfig = renderNotificationIcon(notif)
                        const Icon = iconConfig.icon
                        const isUnread = !isDeadlineKind(notif.kind) && notif.unreadCount > 0
                        const linkTarget = notif.letter?.id
                          ? `/letters/${notif.letter.id}`
                          : '/letters'
                        const bodyRaw = normalizeText(notif.body)
                        const body = bodyRaw && !isCorruptedText(bodyRaw) ? bodyRaw : ''
                        const orgRaw = normalizeText(notif.letter?.org)
                        const org = orgRaw && !isCorruptedText(orgRaw) ? orgRaw : ''
                        const accentTone = isDeadlineKind(notif.kind)
                          ? notif.kind === 'DEADLINE_OVERDUE'
                            ? 'bg-red-500/70'
                            : 'bg-yellow-400/70'
                          : isUnread
                            ? 'bg-emerald-400/70'
                            : 'bg-slate-700/60'
                        const cardTone = isDeadlineKind(notif.kind)
                          ? notif.kind === 'DEADLINE_OVERDUE'
                            ? 'border-red-500/35 bg-red-500/10 shadow-[0_12px_30px_-20px_rgba(248,113,113,0.4)]'
                            : 'border-yellow-500/35 bg-yellow-500/10 shadow-[0_12px_30px_-20px_rgba(250,204,21,0.35)]'
                          : isUnread
                            ? 'border-emerald-500/35 bg-emerald-500/10 shadow-[0_12px_30px_-22px_rgba(16,185,129,0.35)]'
                            : 'border-slate-800/70 bg-slate-900/50'
                        const priorityBadge = isDeadlineKind(notif.kind)
                          ? {
                              label: notif.kind === 'DEADLINE_OVERDUE' ? 'Критично' : 'Срочно',
                              className:
                                notif.kind === 'DEADLINE_OVERDUE'
                                  ? 'border-red-500/40 bg-red-500/15 text-red-200'
                                  : 'border-yellow-500/40 bg-yellow-500/15 text-yellow-200',
                            }
                          : isUnread && notif.kind === 'ASSIGNMENT'
                            ? {
                                label: 'Важное',
                                className:
                                  'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
                              }
                            : null

                        return (
                          <Link
                            key={notif.id}
                            href={linkTarget}
                            onClick={() => {
                              hapticLight()
                              if (!isDeadlineKind(notif.kind)) {
                                markNotificationsRead(notif.ids)
                              }
                              setIsOpen(false)
                            }}
                            className={`tap-highlight group relative flex items-start gap-3 overflow-hidden rounded-2xl border px-4 py-3 transition ${cardTone} hover:-translate-y-0.5 hover:border-slate-600/70 hover:bg-slate-800/70`}
                          >
                            <span className={`absolute left-0 top-0 h-full w-1 ${accentTone}`} />
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
                                {notif.count > 1 && (
                                  <span className="rounded-full border border-slate-700/70 bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-200">
                                    x{notif.count}
                                  </span>
                                )}
                                {isUnread && (
                                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                )}
                              </div>
                              {notificationSettings.showPreviews && body && (
                                <div className="mt-1 line-clamp-2 text-xs text-slate-300">
                                  {body}
                                </div>
                              )}
                              {notificationSettings.showOrganizations && org && (
                                <div className="mt-1 truncate text-xs text-slate-400">{org}</div>
                              )}
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span>{getKindLabel(notif.kind)}</span>
                                <span className="text-slate-600">•</span>
                                {renderNotificationMeta(notif)}
                                {priorityBadge && (
                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-[10px] ${priorityBadge.className}`}
                                  >
                                    {priorityBadge.label}
                                  </span>
                                )}
                                {notif.letter?.number && (
                                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-200">
                                    №{notif.letter.number}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                                {!isDeadlineKind(notif.kind) && notif.unreadCount > 0 && (
                                  <button
                                    onClick={(event) => {
                                      event.preventDefault()
                                      event.stopPropagation()
                                      hapticLight()
                                      markNotificationsRead(notif.ids)
                                    }}
                                    className="tap-highlight rounded-full bg-slate-800/80 px-2.5 py-1 text-slate-200 transition hover:bg-slate-700"
                                  >
                                    Отметить прочитанным
                                  </button>
                                )}
                                {isDeadlineKind(notif.kind) && notif.letter?.id && (
                                  <button
                                    onClick={(event) => {
                                      event.preventDefault()
                                      event.stopPropagation()
                                      hapticLight()
                                      if (notif.letter?.id) {
                                        snoozeDeadline(notif.letter.id)
                                      }
                                    }}
                                    className="tap-highlight rounded-full bg-slate-800/80 px-2.5 py-1 text-slate-200 transition hover:bg-slate-700"
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
                                        hapticMedium()
                                        assignToMe(notif.letter!.id)
                                      }}
                                      className="tap-highlight rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-200 transition hover:bg-emerald-500/25"
                                    >
                                      Назначить меня
                                    </button>
                                  )}
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-500 transition group-hover:text-slate-300" />
                          </Link>
                        )
                      })}
                    </div>
                  ))}
                  {canLoadMore && activeFilter !== 'deadlines' && (
                    <button
                      onClick={() => {
                        hapticLight()
                        setNotificationsLimit((prev) =>
                          Math.min(prev + NOTIFICATIONS_INCREMENT, 200)
                        )
                      }}
                      className="tap-highlight mx-auto block rounded-full border border-slate-700/70 px-4 py-2 text-xs text-slate-300 transition hover:border-slate-500/70 hover:bg-slate-800/70 hover:text-slate-100"
                    >
                      {'Показать ещё'}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="divide-y divide-slate-800/80 border-t border-slate-800/80">
              <Link
                href="/notifications"
                onClick={() => {
                  hapticLight()
                  setIsOpen(false)
                }}
                className="tap-highlight block px-4 py-3 text-center text-sm text-slate-400 transition hover:text-slate-200"
              >
                \u0418\u0441\u0442\u043e\u0440\u0438\u044f
                \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439
              </Link>
              <Link
                href="/settings"
                onClick={() => {
                  hapticLight()
                  setIsOpen(false)
                }}
                className="tap-highlight block px-4 py-3 text-center text-sm text-slate-400 transition hover:text-slate-200"
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

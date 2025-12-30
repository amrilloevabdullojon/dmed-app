'use client'

import { useState, useEffect } from 'react'
import { Bell, X, AlertTriangle, Clock, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { formatDate, getDaysUntilDeadline, pluralizeDays } from '@/lib/utils'

interface Notification {
  id: string
  type: 'overdue' | 'urgent'
  letter: {
    id: string
    number: string
    org: string
    deadlineDate: string
  }
  daysLeft: number
}


interface UserNotification {
  id: string
  type: 'COMMENT' | 'STATUS' | 'ASSIGNMENT' | 'SYSTEM'
  title: string
  body: string | null
  isRead: boolean
  createdAt: string
  letter?: {
    id: string
    number: string
    org: string
  } | null
}

export function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [userNotifications, setUserNotifications] = useState<UserNotification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadNotifications()
    // Обновлять каждые 5 минут
    const interval = setInterval(loadNotifications, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const userRes = await fetch('/api/notifications')
      if (userRes.ok) {
        const userData = await userRes.json()
        setUserNotifications(userData.notifications || [])
      }
      // Загрузить просроченные
      const overdueRes = await fetch('/api/letters?filter=overdue&limit=10')
      const overdueData = await overdueRes.json()

      // Загрузить срочные
      const urgentRes = await fetch('/api/letters?filter=urgent&limit=10')
      const urgentData = await urgentRes.json()

      const notifs: Notification[] = []

      // Добавить просроченные
      overdueData.letters?.forEach((letter: any) => {
        notifs.push({
          id: `overdue-${letter.id}`,
          type: 'overdue',
          letter: {
            id: letter.id,
            number: letter.number,
            org: letter.org,
            deadlineDate: letter.deadlineDate,
          },
          daysLeft: getDaysUntilDeadline(letter.deadlineDate),
        })
      })

      // Добавить срочные
      urgentData.letters?.forEach((letter: any) => {
        notifs.push({
          id: `urgent-${letter.id}`,
          type: 'urgent',
          letter: {
            id: letter.id,
            number: letter.number,
            org: letter.org,
            deadlineDate: letter.deadlineDate,
          },
          daysLeft: getDaysUntilDeadline(letter.deadlineDate),
        })
      })

      setNotifications(notifs)
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const overdueCount = notifications.filter((n) => n.type === 'overdue').length
  const urgentCount = notifications.filter((n) => n.type === 'urgent').length
  const unreadCount = userNotifications.filter((n) => !n.isRead).length
  const totalCount = notifications.length + unreadCount

  const markNotificationRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      })
      setUserNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      )
    } catch (error) {
      console.error('Failed to mark notification read:', error)
    }
  }

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      setUserNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } catch (error) {
      console.error('Failed to mark all notifications read:', error)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white transition"
        aria-label="Открыть уведомления"
      >
        <Bell className="w-5 h-5" />
        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-96 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <h3 className="text-white font-medium">???????????</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-emerald-400 hover:text-emerald-300 transition"
                  >
                    ???????? ???
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-gray-400 hover:text-white transition"
                  aria-label="Закрыть"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {userNotifications.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 border-b border-gray-700">
                  D?D??, ??D?D?D'D_D?D?D?D?D,D1
                </div>
              ) : (
                <div className="divide-y divide-gray-700 border-b border-gray-700">
                  {userNotifications.map((notif) => (
                    <Link
                      key={notif.id}
                      href={notif.letter?.id ? `/letters/${notif.letter.id}` : '/letters'}
                      onClick={() => {
                        markNotificationRead(notif.id)
                        setIsOpen(false)
                      }}
                      className={`flex items-start gap-3 px-4 py-3 transition ${
                        notif.isRead ? 'bg-transparent' : 'bg-emerald-500/5'
                      } hover:bg-gray-700/50`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white">{notif.title}</div>
                        {notif.body && (
                          <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                            {notif.body}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(notif.createdAt).toLocaleString('ru-RU')}
                        </div>
                      </div>
                      {notif.letter?.number && (
                        <span className="text-xs text-emerald-400 font-mono">
                          ?{notif.letter.number}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="flex border-b border-gray-700">
              <div className="flex-1 px-4 py-2 text-center border-r border-gray-700">
                <div className="text-red-400 font-bold">{overdueCount}</div>
                <div className="text-xs text-gray-500">Просрочено</div>
              </div>
              <div className="flex-1 px-4 py-2 text-center">
                <div className="text-yellow-400 font-bold">{urgentCount}</div>
                <div className="text-xs text-gray-500">Срочных</div>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  Нет уведомлений
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {notifications.map((notif) => (
                    <Link
                      key={notif.id}
                      href={`/letters/${notif.letter.id}`}
                      onClick={() => setIsOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-gray-700/50 transition"
                    >
                      <div
                        className={`p-2 rounded-lg ${
                          notif.type === 'overdue'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        {notif.type === 'overdue' ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : (
                          <Clock className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-emerald-400 text-sm">
                            №{notif.letter.number}
                          </span>
                          <span
                            className={`text-xs ${
                              notif.type === 'overdue'
                                ? 'text-red-400'
                                : 'text-yellow-400'
                            }`}
                          >
                            {notif.type === 'overdue'
                              ? `Просрочено на ${Math.abs(notif.daysLeft)} ${pluralizeDays(notif.daysLeft)}`
                              : `${notif.daysLeft} ${pluralizeDays(notif.daysLeft)}`}
                          </span>
                        </div>
                        <div className="text-white text-sm truncate">
                          {notif.letter.org}
                        </div>
                        <div className="text-xs text-gray-500">
                          Дедлайн: {formatDate(notif.letter.deadlineDate)}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <Link
              href="/letters?filter=overdue"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-3 text-center text-sm text-emerald-400 hover:text-emerald-300 border-t border-gray-700 transition"
            >
              Показать все просроченные
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

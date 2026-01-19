'use client'

import { memo, useMemo } from 'react'
import {
  Bell,
  Mail,
  Send,
  Smartphone,
  Volume2,
  Clock,
  Layers,
  Eye,
  SlidersHorizontal,
  Users,
  Grid3x3,
} from 'lucide-react'
import { SettingsToggle } from './SettingsToggle'
import { useNotificationSettings } from '@/hooks/useNotificationSettings'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { MobileAccordion } from '@/components/mobile/MobileTabs'
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationChannel,
  NotificationEventType,
  NotificationPriority,
  NotificationSettings,
  NotificationSubscription,
} from '@/lib/notification-settings'
import { USER_ROLES } from '@/lib/constants'

const digestOptions = [
  { value: 'instant', label: 'Сразу' },
  { value: 'daily', label: 'Раз в день' },
  { value: 'weekly', label: 'Раз в неделю' },
  { value: 'never', label: 'Не отправлять' },
] as const

const quietModeOptions = [
  { value: 'all', label: 'Все уведомления' },
  { value: 'important', label: 'Только важные' },
] as const

const eventOptions: { event: NotificationEventType; label: string; description: string }[] = [
  { event: 'NEW_LETTER', label: 'Новые письма', description: 'Уведомления о новых письмах' },
  { event: 'COMMENT', label: 'Комментарии', description: 'Новые комментарии к письмам' },
  { event: 'STATUS', label: 'Статус', description: 'Изменения статуса писем' },
  { event: 'ASSIGNMENT', label: 'Назначения', description: 'Назначение писем на вас' },
  {
    event: 'DEADLINE_URGENT',
    label: 'Срочные дедлайны',
    description: 'Приближающиеся дедлайны',
  },
  { event: 'DEADLINE_OVERDUE', label: 'Просрочки', description: 'Просроченные дедлайны' },
  { event: 'SYSTEM', label: 'Системные', description: 'Системные уведомления' },
]

const channelIcons = {
  inApp: Bell,
  email: Mail,
  telegram: Send,
  sms: Smartphone,
  push: Bell,
}

const channelLabels: Record<NotificationChannel, string> = {
  inApp: 'В системе',
  email: 'Email',
  telegram: 'Telegram',
  sms: 'SMS',
  push: 'Push',
}

const priorityLabels: Record<NotificationPriority, string> = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Высокий',
  critical: 'Критичный',
}

export const MobileNotificationsTab = memo(function MobileNotificationsTab() {
  const { settings, isLoading, isSaving, updateSettings } = useNotificationSettings()
  const push = usePushNotifications()

  const updateSetting = <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => {
    updateSettings({ [key]: value })
  }

  const matrixRows = useMemo(() => {
    const matrixMap = new Map(
      DEFAULT_NOTIFICATION_SETTINGS.matrix.map((item) => [item.event, item])
    )
    settings.matrix.forEach((item) => matrixMap.set(item.event, item))
    return eventOptions.map(
      (option) =>
        matrixMap.get(option.event) ||
        DEFAULT_NOTIFICATION_SETTINGS.matrix.find((item) => item.event === option.event) ||
        DEFAULT_NOTIFICATION_SETTINGS.matrix[0]
    )
  }, [settings.matrix])

  const updateMatrixItem = (
    event: NotificationEventType,
    patch: Partial<NotificationSettings['matrix'][number]>
  ) => {
    const next = matrixRows.map((row) => (row.event === event ? { ...row, ...patch } : row))
    updateSetting('matrix', next)
  }

  const toggleMatrixChannel = (event: NotificationEventType, channel: NotificationChannel) => {
    const row = matrixRows.find((item) => item.event === event)
    if (!row) return
    updateMatrixItem(event, {
      channels: {
        ...row.channels,
        [channel]: !row.channels[channel],
      },
    })
  }

  const updateMatrixPriority = (event: NotificationEventType, priority: NotificationPriority) => {
    updateMatrixItem(event, { priority })
  }

  // Mobile-optimized accordion items
  const accordionItems = [
    {
      id: 'channels',
      title: 'Каналы уведомлений',
      icon: <Bell className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <SettingsToggle
            label="Внутри системы"
            description="Показывать уведомления в центре уведомлений."
            icon={<Bell className="h-4 w-4" />}
            enabled={settings.inAppNotifications}
            onToggle={(enabled) => updateSetting('inAppNotifications', enabled)}
          />
          <SettingsToggle
            label="Email"
            description="Отправлять уведомления на почту."
            icon={<Mail className="h-4 w-4" />}
            enabled={settings.emailNotifications}
            onToggle={(enabled) => updateSetting('emailNotifications', enabled)}
          />
          {settings.emailNotifications && (
            <div className="ml-11 space-y-3 border-l-2 border-white/10 pl-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Частота
              </label>
              <select
                value={settings.emailDigest}
                onChange={(event) =>
                  updateSetting(
                    'emailDigest',
                    event.target.value as NotificationSettings['emailDigest']
                  )
                }
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white transition focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
              >
                {digestOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <SettingsToggle
            label="Telegram"
            description="Уведомления в Telegram."
            icon={<Send className="h-4 w-4" />}
            enabled={settings.telegramNotifications}
            onToggle={(enabled) => updateSetting('telegramNotifications', enabled)}
          />
          <SettingsToggle
            label="SMS"
            description="Короткие уведомления на телефон."
            icon={<Smartphone className="h-4 w-4" />}
            enabled={settings.smsNotifications}
            onToggle={(enabled) => updateSetting('smsNotifications', enabled)}
          />
          <SettingsToggle
            label="Push"
            description={
              push.isSupported
                ? 'Push-уведомления в браузере.'
                : 'Push не поддерживаются браузером.'
            }
            icon={<Bell className="h-4 w-4" />}
            enabled={settings.pushNotifications && push.isSubscribed}
            onToggle={async (enabled) => {
              updateSetting('pushNotifications', enabled)
              if (enabled) {
                if (!push.isSubscribed) {
                  const permitted = await push.requestPermission()
                  if (permitted) {
                    await push.subscribeToPush()
                  }
                }
              } else {
                if (push.isSubscribed) {
                  await push.unsubscribeFromPush()
                }
              }
            }}
          />
        </div>
      ),
    },
    {
      id: 'schedule',
      title: 'Тихие часы',
      icon: <Clock className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <SettingsToggle
            label="Включить тихие часы"
            description="Ограничить уведомления в определенное время."
            icon={<Clock className="h-4 w-4" />}
            enabled={settings.quietHoursEnabled}
            onToggle={(enabled) => updateSetting('quietHoursEnabled', enabled)}
          />
          {settings.quietHoursEnabled && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Начало
                  </label>
                  <input
                    type="time"
                    value={settings.quietHoursStart}
                    onChange={(event) => updateSetting('quietHoursStart', event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Конец
                  </label>
                  <input
                    type="time"
                    value={settings.quietHoursEnd}
                    onChange={(event) => updateSetting('quietHoursEnd', event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Режим
                </label>
                <select
                  value={settings.quietMode}
                  onChange={(event) =>
                    updateSetting(
                      'quietMode',
                      event.target.value as NotificationSettings['quietMode']
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white transition focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                >
                  {quietModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <SettingsToggle
            label="Звук"
            description="Проигрывать звук при уведомлениях."
            icon={<Volume2 className="h-4 w-4" />}
            enabled={settings.soundNotifications}
            onToggle={(enabled) => updateSetting('soundNotifications', enabled)}
          />
        </div>
      ),
    },
    {
      id: 'display',
      title: 'Отображение',
      icon: <Eye className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <SettingsToggle
            label="Группировать"
            description="Объединять похожие события."
            icon={<Layers className="h-4 w-4" />}
            enabled={settings.groupSimilar}
            onToggle={(enabled) => updateSetting('groupSimilar', enabled)}
          />
          <SettingsToggle
            label="Превью"
            description="Показывать текст уведомлений."
            icon={<Eye className="h-4 w-4" />}
            enabled={settings.showPreviews}
            onToggle={(enabled) => updateSetting('showPreviews', enabled)}
          />
          <SettingsToggle
            label="Организации"
            description="Показывать организацию в уведомлении."
            icon={<Users className="h-4 w-4" />}
            enabled={settings.showOrganizations}
            onToggle={(enabled) => updateSetting('showOrganizations', enabled)}
          />
        </div>
      ),
    },
    {
      id: 'events',
      title: 'Типы событий',
      icon: <Grid3x3 className="h-5 w-5" />,
      content: (
        <div className="space-y-3">
          <p className="mb-4 text-xs text-gray-400">
            Настройте каналы и приоритет для каждого типа событий.
          </p>
          {eventOptions.map((eventOption) => {
            const row = matrixRows.find((r) => r.event === eventOption.event)
            if (!row) return null

            return (
              <div
                key={eventOption.event}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <h4 className="mb-2 text-sm font-medium text-white">{eventOption.label}</h4>
                <p className="mb-3 text-xs text-gray-400">{eventOption.description}</p>

                {/* Channels */}
                <div className="mb-3">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Каналы
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(row.channels).map(([channel, enabled]) => {
                      const Icon = channelIcons[channel as NotificationChannel]
                      return (
                        <button
                          key={channel}
                          onClick={() =>
                            toggleMatrixChannel(eventOption.event, channel as NotificationChannel)
                          }
                          className={`tap-highlight flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                            enabled
                              ? 'border border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
                              : 'border border-white/10 bg-white/5 text-slate-400'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {channelLabels[channel as NotificationChannel]}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Приоритет
                  </label>
                  <select
                    value={row.priority}
                    onChange={(e) =>
                      updateMatrixPriority(
                        eventOption.event,
                        e.target.value as NotificationPriority
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  >
                    {(['low', 'normal', 'high', 'critical'] as NotificationPriority[]).map(
                      (priority) => (
                        <option key={priority} value={priority}>
                          {priorityLabels[priority]}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="pb-safe-bottom">
      <MobileAccordion items={accordionItems} allowMultiple className="space-y-3" />

      {/* Quick actions at bottom */}
      <div className="mt-6 space-y-3">
        <button
          onClick={() => updateSettings(DEFAULT_NOTIFICATION_SETTINGS)}
          disabled={isSaving}
          className="tap-highlight touch-target w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
        >
          {isSaving ? 'Сохранение...' : 'Сбросить настройки'}
        </button>
      </div>
    </div>
  )
})

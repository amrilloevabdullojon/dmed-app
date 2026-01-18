'use client'

import { memo, useMemo } from 'react'
import {
  Bell,
  Mail,
  Send,
  Smartphone,
  Volume2,
  Rss,
  Clock,
  Layers,
  Eye,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import { SettingsToggle } from './SettingsToggle'
import { useNotificationSettings } from '@/hooks/useNotificationSettings'
import { usePushNotifications } from '@/hooks/usePushNotifications'
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
  { value: 'all', label: 'Показывать все уведомления' },
  { value: 'important', label: 'Только важные и дедлайны' },
] as const

const eventOptions: { event: NotificationEventType; label: string }[] = [
  { event: 'NEW_LETTER', label: 'Новые письма' },
  { event: 'COMMENT', label: 'Комментарии' },
  { event: 'STATUS', label: 'Изменение статуса' },
  { event: 'ASSIGNMENT', label: 'Назначения' },
  { event: 'DEADLINE_URGENT', label: 'Срочные дедлайны' },
  { event: 'DEADLINE_OVERDUE', label: 'Просрочки' },
  { event: 'SYSTEM', label: 'Системные' },
]

const channelOptions: { key: NotificationChannel; label: string }[] = [
  { key: 'inApp', label: 'Внутри' },
  { key: 'email', label: 'Email' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'sms', label: 'SMS' },
  { key: 'push', label: 'Push' },
]

const priorityOptions: { value: NotificationPriority; label: string }[] = [
  { value: 'low', label: 'Низкий' },
  { value: 'normal', label: 'Обычный' },
  { value: 'high', label: 'Высокий' },
  { value: 'critical', label: 'Критичный' },
]

export const NotificationsTab = memo(function NotificationsTab() {
  const { settings, isLoading, isSaving, updateSettings } = useNotificationSettings()
  const push = usePushNotifications()

  const updateSetting = <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => {
    updateSettings({ [key]: value })
  }

  const resetSettings = () => {
    updateSettings(DEFAULT_NOTIFICATION_SETTINGS)
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

  const roleOptions = useMemo(
    () =>
      Object.entries(USER_ROLES).map(([value, config]) => ({
        value,
        label: config.label,
      })),
    []
  )

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

  const updateSubscription = (index: number, patch: Partial<NotificationSubscription>) => {
    const next = settings.subscriptions.map((item, idx) =>
      idx === index ? { ...item, ...patch } : item
    )
    updateSetting('subscriptions', next)
  }

  const addSubscription = () => {
    updateSetting('subscriptions', [...settings.subscriptions, { event: 'ALL', scope: 'all' }])
  }

  const removeSubscription = (index: number) => {
    updateSetting(
      'subscriptions',
      settings.subscriptions.filter((_, idx) => idx !== index)
    )
  }

  return (
    <div className="space-y-6">
      <div className="panel panel-glass rounded-2xl p-6">
        <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="rounded-full bg-sky-500/10 p-2 text-sky-300">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Каналы уведомлений</h3>
            <p className="text-xs text-gray-400">
              Выберите каналы, в которые хотите получать уведомления о событиях.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <SettingsToggle
            label="Внутри системы"
            description="Показывать уведомления в центре уведомлений и подсветку на иконке."
            icon={<Bell className="h-4 w-4" />}
            enabled={settings.inAppNotifications}
            onToggle={(enabled) => updateSetting('inAppNotifications', enabled)}
          />
          <SettingsToggle
            label="Email-уведомления"
            description="Отправлять уведомления на почту."
            icon={<Mail className="h-4 w-4" />}
            enabled={settings.emailNotifications}
            onToggle={(enabled) => updateSetting('emailNotifications', enabled)}
          />
          {settings.emailNotifications && (
            <div className="ml-11 space-y-3 border-l-2 border-white/10 pl-6">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Частота писем
              </label>
              <select
                value={settings.emailDigest}
                onChange={(event) =>
                  updateSetting(
                    'emailDigest',
                    event.target.value as NotificationSettings['emailDigest']
                  )
                }
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white transition focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
              >
                {digestOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400">
                Для срочных событий будет отправка сразу, независимо от дайджеста.
              </p>
            </div>
          )}
          <SettingsToggle
            label="Telegram"
            description="Отправлять уведомления в Telegram."
            icon={<Send className="h-4 w-4" />}
            enabled={settings.telegramNotifications}
            onToggle={(enabled) => updateSetting('telegramNotifications', enabled)}
          />
          <SettingsToggle
            label="SMS"
            description="Получать короткие уведомления на телефон."
            icon={<Smartphone className="h-4 w-4" />}
            enabled={settings.smsNotifications}
            onToggle={(enabled) => updateSetting('smsNotifications', enabled)}
          />
        </div>
      </div>

      <div className="panel panel-glass rounded-2xl p-6">
        <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="rounded-full bg-purple-500/10 p-2 text-purple-300">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Режимы и расписание</h3>
            <p className="text-xs text-gray-400">
              Настройте тихие часы и дополнительные режимы для уведомлений.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <SettingsToggle
            label="Тихие часы"
            description="Во время тихих часов можно показывать только важные уведомления."
            icon={<Clock className="h-4 w-4" />}
            enabled={settings.quietHoursEnabled}
            onToggle={(enabled) => updateSetting('quietHoursEnabled', enabled)}
          />
          {settings.quietHoursEnabled && (
            <div className="ml-11 space-y-4 border-l-2 border-white/10 pl-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Начало
                  </label>
                  <input
                    type="time"
                    value={settings.quietHoursStart}
                    onChange={(event) => updateSetting('quietHoursStart', event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white transition focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
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
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white transition focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Режим в тихие часы
                </label>
                <select
                  value={settings.quietMode}
                  onChange={(event) =>
                    updateSetting(
                      'quietMode',
                      event.target.value as NotificationSettings['quietMode']
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white transition focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
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
            label="Звуковые уведомления"
            description="Проигрывать звук при новых уведомлениях."
            icon={<Volume2 className="h-4 w-4" />}
            enabled={settings.soundNotifications}
            onToggle={(enabled) => updateSetting('soundNotifications', enabled)}
          />
          <SettingsToggle
            label="Push-уведомления"
            description={
              push.isSupported
                ? 'Показывать push-уведомления в браузере.'
                : 'Push-уведомления не поддерживаются вашим браузером.'
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
          {push.error && (
            <div className="ml-11 text-xs text-red-400">{push.error}</div>
          )}
          {push.isLoading && (
            <div className="ml-11 text-xs text-gray-400">Загрузка...</div>
          )}
        </div>
      </div>

      <div className="panel panel-glass rounded-2xl p-6">
        <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="rounded-full bg-amber-500/10 p-2 text-amber-300">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Отображение</h3>
            <p className="text-xs text-gray-400">
              Настройте, как уведомления выглядят в центре уведомлений.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <SettingsToggle
            label="Группировать похожие"
            description="Объединять похожие события в один блок с количеством."
            icon={<Layers className="h-4 w-4" />}
            enabled={settings.groupSimilar}
            onToggle={(enabled) => updateSetting('groupSimilar', enabled)}
          />
          <SettingsToggle
            label="Показывать превью"
            description="Отображать текст комментария или изменения статуса."
            icon={<Eye className="h-4 w-4" />}
            enabled={settings.showPreviews}
            onToggle={(enabled) => updateSetting('showPreviews', enabled)}
          />
          <SettingsToggle
            label="Показывать учреждение"
            description="Добавлять название учреждения под заголовком."
            icon={<Rss className="h-4 w-4" />}
            enabled={settings.showOrganizations}
            onToggle={(enabled) => updateSetting('showOrganizations', enabled)}
          />
        </div>
      </div>

      <div className="panel panel-glass rounded-2xl p-6">
        <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="rounded-full bg-teal-500/10 p-2 text-teal-300">
            <Rss className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Типы событий</h3>
            <p className="text-xs text-gray-400">
              Выберите, о каких событиях отправлять уведомления.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <SettingsToggle
            label="Новые письма"
            description="Уведомлять о создании новых писем."
            enabled={settings.notifyOnNewLetter}
            onToggle={(enabled) => updateSetting('notifyOnNewLetter', enabled)}
          />
          <SettingsToggle
            label="Изменение статуса"
            description="Уведомлять о смене статуса письма."
            enabled={settings.notifyOnStatusChange}
            onToggle={(enabled) => updateSetting('notifyOnStatusChange', enabled)}
          />
          <SettingsToggle
            label="Комментарии"
            description="Уведомлять о новых комментариях."
            enabled={settings.notifyOnComment}
            onToggle={(enabled) => updateSetting('notifyOnComment', enabled)}
          />
          <SettingsToggle
            label="Назначения"
            description="Уведомлять о назначении исполнителя."
            enabled={settings.notifyOnAssignment}
            onToggle={(enabled) => updateSetting('notifyOnAssignment', enabled)}
          />
          <SettingsToggle
            label="Дедлайны"
            description="Показывать уведомления о сроках и просрочках."
            enabled={settings.notifyOnDeadline}
            onToggle={(enabled) => updateSetting('notifyOnDeadline', enabled)}
          />
          <SettingsToggle
            label="Системные"
            description="Показывать системные уведомления и сервисные сообщения."
            enabled={settings.notifyOnSystem}
            onToggle={(enabled) => updateSetting('notifyOnSystem', enabled)}
          />
        </div>
      </div>

      <div className="panel panel-glass rounded-2xl p-6">
        <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="rounded-full bg-sky-500/10 p-2 text-sky-300">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Матрица событий</h3>
            <p className="text-xs text-gray-400">
              Настройте каналы доставки и приоритет для каждого типа уведомлений.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 text-xs uppercase tracking-wide text-gray-500 md:grid-cols-[1.6fr_1fr_3fr]">
            <span>Событие</span>
            <span>Приоритет</span>
            <span>Каналы</span>
          </div>
          {matrixRows.map((row) => {
            const label = eventOptions.find((item) => item.event === row.event)?.label || row.event
            return (
              <div
                key={row.event}
                className="grid items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 md:grid-cols-[1.6fr_1fr_3fr]"
              >
                <div className="text-sm font-medium text-white">{label}</div>
                <select
                  value={row.priority}
                  onChange={(event) =>
                    updateMatrixPriority(row.event, event.target.value as NotificationPriority)
                  }
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                >
                  {priorityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2">
                  {channelOptions.map((channel) => {
                    const active = row.channels[channel.key]
                    return (
                      <button
                        key={channel.key}
                        type="button"
                        onClick={() => toggleMatrixChannel(row.event, channel.key)}
                        className={`rounded-full border px-3 py-1 text-xs transition ${
                          active
                            ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                            : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'
                        }`}
                      >
                        {channel.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="panel panel-glass rounded-2xl p-6">
        <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-300">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Подписки и роли</h3>
            <p className="text-xs text-gray-400">
              Добавьте дополнительные источники событий для ваших уведомлений.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {settings.subscriptions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-xs text-gray-400">
              Нет активных подписок.
            </div>
          ) : (
            settings.subscriptions.map((subscription, index) => {
              const scope = subscription.scope
              return (
                <div
                  key={`${subscription.scope}-${subscription.event}-${index}`}
                  className="rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <div className="grid gap-3 md:grid-cols-4">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Событие
                      </label>
                      <select
                        value={subscription.event}
                        onChange={(event) =>
                          updateSubscription(index, {
                            event: event.target.value as NotificationSubscription['event'],
                          })
                        }
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                      >
                        <option value="ALL">Все события</option>
                        {eventOptions.map((item) => (
                          <option key={item.event} value={item.event}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Область
                      </label>
                      <select
                        value={subscription.scope}
                        onChange={(event) =>
                          updateSubscription(index, {
                            scope: event.target.value as NotificationSubscription['scope'],
                            value: event.target.value === 'all' ? undefined : subscription.value,
                          })
                        }
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                      >
                        <option value="all">Все</option>
                        <option value="role">Роль</option>
                        <option value="user">Пользователь</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Значение
                      </label>
                      {scope === 'role' ? (
                        <select
                          value={subscription.value || ''}
                          onChange={(event) =>
                            updateSubscription(index, { value: event.target.value })
                          }
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                        >
                          <option value="">Выберите роль</option>
                          {roleOptions.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={subscription.value || ''}
                          onChange={(event) =>
                            updateSubscription(index, { value: event.target.value })
                          }
                          placeholder={scope === 'user' ? 'ID или email' : '—'}
                          disabled={scope === 'all'}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-60"
                        />
                      )}
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeSubscription(index)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}

          <button
            type="button"
            onClick={addSubscription}
            className="tap-highlight w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:border-emerald-400/50 hover:bg-emerald-500/20"
          >
            Добавить подписку
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={resetSettings}
          className="tap-highlight rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-gray-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
        >
          Сбросить настройки
        </button>
        <div className="text-xs text-gray-500">
          {isLoading
            ? 'Загружаем настройки...'
            : isSaving
              ? 'Сохраняем настройки на сервере...'
              : 'Настройки синхронизируются между устройствами и применяются сразу.'}
        </div>
      </div>
    </div>
  )
})

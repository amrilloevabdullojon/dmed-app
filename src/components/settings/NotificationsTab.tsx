'use client'

import { memo, useMemo } from 'react'
import { Bell, Mail, Send, Smartphone, Volume2, Rss, Clock, Layers, Eye } from 'lucide-react'
import { SettingsToggle } from './SettingsToggle'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { DEFAULT_NOTIFICATION_SETTINGS, NotificationSettings } from '@/lib/notification-settings'

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

export const NotificationsTab = memo(function NotificationsTab() {
  const [storedSettings, setStoredSettings] = useLocalStorage<NotificationSettings>(
    'notification-settings',
    DEFAULT_NOTIFICATION_SETTINGS
  )

  const settings = useMemo(
    () => ({ ...DEFAULT_NOTIFICATION_SETTINGS, ...storedSettings }),
    [storedSettings]
  )

  const updateSetting = <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => {
    setStoredSettings((prev) => ({
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...prev,
      [key]: value,
    }))
  }

  const resetSettings = () => {
    setStoredSettings(DEFAULT_NOTIFICATION_SETTINGS)
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
            description="Показывать push-уведомления в браузере."
            icon={<Bell className="h-4 w-4" />}
            enabled={settings.pushNotifications}
            onToggle={(enabled) => updateSetting('pushNotifications', enabled)}
          />
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={resetSettings}
          className="tap-highlight rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-gray-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
        >
          Сбросить настройки
        </button>
        <div className="text-xs text-gray-500">
          Настройки сохраняются в браузере и применяются сразу.
        </div>
      </div>
    </div>
  )
})

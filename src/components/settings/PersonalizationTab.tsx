'use client'

import { memo } from 'react'
import { Palette, Globe, Sparkles, Monitor } from 'lucide-react'
import { SettingsToggle } from './SettingsToggle'
import { useLocalStorage } from '@/hooks/useLocalStorage'

interface PersonalizationSettings {
  theme: 'light' | 'dark' | 'auto'
  language: 'ru' | 'en'
  density: 'compact' | 'comfortable' | 'spacious'
  animations: boolean
}

export const PersonalizationTab = memo(function PersonalizationTab() {
  const [settings, setSettings] = useLocalStorage<PersonalizationSettings>(
    'personalization-settings',
    {
      theme: 'dark',
      language: 'ru',
      density: 'comfortable',
      animations: true,
    }
  )

  const updateSetting = <K extends keyof PersonalizationSettings>(
    key: K,
    value: PersonalizationSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      {/* Theme Section */}
      <div className="panel panel-glass rounded-2xl p-6">
        <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="rounded-full bg-purple-500/10 p-2 text-purple-300">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Тема оформления</h3>
            <p className="text-xs text-gray-400">
              Выберите светлую, темную или автоматическую тему.
            </p>
          </div>
        </div>

        <div>
          <label className="mb-3 block text-sm font-medium text-white">Цветовая схема</label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              onClick={() => updateSetting('theme', 'light')}
              className={`flex items-center gap-3 rounded-xl border p-4 transition ${
                settings.theme === 'light'
                  ? 'border-emerald-400/50 bg-emerald-500/15 shadow-[0_0_18px_rgba(16,185,129,0.25)]'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="rounded-full bg-white p-2 text-slate-900">
                <Monitor className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-white">Светлая</div>
                <div className="text-xs text-gray-400">Светлый интерфейс</div>
              </div>
            </button>

            <button
              onClick={() => updateSetting('theme', 'dark')}
              className={`flex items-center gap-3 rounded-xl border p-4 transition ${
                settings.theme === 'dark'
                  ? 'border-emerald-400/50 bg-emerald-500/15 shadow-[0_0_18px_rgba(16,185,129,0.25)]'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="rounded-full bg-slate-900 p-2 text-white">
                <Monitor className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-white">Темная</div>
                <div className="text-xs text-gray-400">Темный интерфейс</div>
              </div>
            </button>

            <button
              onClick={() => updateSetting('theme', 'auto')}
              className={`flex items-center gap-3 rounded-xl border p-4 transition ${
                settings.theme === 'auto'
                  ? 'border-emerald-400/50 bg-emerald-500/15 shadow-[0_0_18px_rgba(16,185,129,0.25)]'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="rounded-full bg-gradient-to-br from-white to-slate-900 p-2 text-white">
                <Monitor className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-white">Авто</div>
                <div className="text-xs text-gray-400">По системе</div>
              </div>
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            {settings.theme === 'auto' &&
              'Тема будет автоматически меняться в зависимости от системных настроек'}
            {settings.theme === 'light' && 'Применена светлая тема оформления'}
            {settings.theme === 'dark' && 'Применена темная тема оформления'}
          </p>
        </div>
      </div>

      {/* Language Section */}
      <div className="panel panel-glass rounded-2xl p-6">
        <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="rounded-full bg-blue-500/10 p-2 text-blue-300">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Язык интерфейса</h3>
            <p className="text-xs text-gray-400">Выберите язык для отображения интерфейса.</p>
          </div>
        </div>

        <div>
          <label className="mb-3 block text-sm font-medium text-white">Язык</label>
          <select
            value={settings.language}
            onChange={(e) =>
              updateSetting('language', e.target.value as PersonalizationSettings['language'])
            }
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white transition focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
          >
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
          <p className="mt-2 text-xs text-gray-400">
            Интерфейс будет отображаться на выбранном языке. Перезагрузка не требуется.
          </p>
        </div>
      </div>

      {/* Density Section */}
      <div className="panel panel-glass rounded-2xl p-6">
        <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="rounded-full bg-orange-500/10 p-2 text-orange-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Плотность интерфейса</h3>
            <p className="text-xs text-gray-400">
              Настройте размер элементов и отступы в интерфейсе.
            </p>
          </div>
        </div>

        <div>
          <label className="mb-3 block text-sm font-medium text-white">Плотность</label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              onClick={() => updateSetting('density', 'compact')}
              className={`rounded-xl border p-4 text-left transition ${
                settings.density === 'compact'
                  ? 'border-emerald-400/50 bg-emerald-500/15 shadow-[0_0_18px_rgba(16,185,129,0.25)]'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="text-sm font-semibold text-white">Компактный</div>
              <div className="text-xs text-gray-400">Больше информации на экране</div>
            </button>

            <button
              onClick={() => updateSetting('density', 'comfortable')}
              className={`rounded-xl border p-4 text-left transition ${
                settings.density === 'comfortable'
                  ? 'border-emerald-400/50 bg-emerald-500/15 shadow-[0_0_18px_rgba(16,185,129,0.25)]'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="text-sm font-semibold text-white">Комфортный</div>
              <div className="text-xs text-gray-400">Баланс плотности и читаемости</div>
            </button>

            <button
              onClick={() => updateSetting('density', 'spacious')}
              className={`rounded-xl border p-4 text-left transition ${
                settings.density === 'spacious'
                  ? 'border-emerald-400/50 bg-emerald-500/15 shadow-[0_0_18px_rgba(16,185,129,0.25)]'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="text-sm font-semibold text-white">Просторный</div>
              <div className="text-xs text-gray-400">Максимальная читаемость</div>
            </button>
          </div>
        </div>
      </div>

      {/* Animations Section */}
      <div className="panel panel-glass rounded-2xl p-6">
        <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="rounded-full bg-teal-500/10 p-2 text-teal-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Анимации и эффекты</h3>
            <p className="text-xs text-gray-400">
              Управляйте анимациями и визуальными эффектами интерфейса.
            </p>
          </div>
        </div>

        <SettingsToggle
          label="Включить анимации"
          description="Использовать плавные переходы и анимации в интерфейсе. Отключение может улучшить производительность."
          icon={<Sparkles className="h-4 w-4" />}
          enabled={settings.animations}
          onToggle={(enabled) => updateSetting('animations', enabled)}
        />
      </div>
    </div>
  )
})

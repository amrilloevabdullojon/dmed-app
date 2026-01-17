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
  backgroundAnimations: boolean
  wallpaperStyle: 'aurora' | 'nebula' | 'glow' | 'cosmic'
  wallpaperIntensity: number
  snowfall: boolean
  particles: boolean
}

export const PersonalizationTab = memo(function PersonalizationTab() {
  const [settings, setSettings] = useLocalStorage<PersonalizationSettings>(
    'personalization-settings',
    {
      theme: 'dark',
      language: 'ru',
      density: 'comfortable',
      animations: true,
      backgroundAnimations: true,
      wallpaperStyle: 'aurora',
      wallpaperIntensity: 60,
      snowfall: false,
      particles: false,
    }
  )

  const updateSetting = <K extends keyof PersonalizationSettings>(
    key: K,
    value: PersonalizationSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const backgroundAnimationsEnabled = settings.backgroundAnimations ?? true
  const wallpaperStyle = settings.wallpaperStyle ?? 'aurora'
  const wallpaperIntensity = settings.wallpaperIntensity ?? 60

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
        <div className="mt-4">
          <SettingsToggle
            label={
              '\u0410\u043d\u0438\u043c\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0439 \u0444\u043e\u043d'
            }
            description={
              '\u0421\u043d\u0435\u0433, \u043c\u0435\u0440\u0446\u0430\u043d\u0438\u0435 \u0438 \u043f\u0440\u0430\u0437\u0434\u043d\u0438\u0447\u043d\u044b\u0435 \u044d\u0444\u0444\u0435\u043a\u0442\u044b \u0432 \u0444\u043e\u043d\u0435. \u041e\u0442\u043a\u043b\u044e\u0447\u0438\u0442\u0435, \u0435\u0441\u043b\u0438 \u043c\u0435\u0448\u0430\u0435\u0442 \u0438\u043b\u0438 \u0442\u043e\u0440\u043c\u043e\u0437\u0438\u0442.'
            }
            icon={<Sparkles className="h-4 w-4" />}
            enabled={backgroundAnimationsEnabled}
            onToggle={(enabled) => updateSetting('backgroundAnimations', enabled)}
          />
        </div>
        <div
          className={`mt-4 space-y-4 ${
            backgroundAnimationsEnabled ? '' : 'pointer-events-none opacity-60'
          }`}
        >
          <div>
            <label className="mb-2 block text-sm font-medium text-white">
              {'\u0421\u0442\u0438\u043b\u044c \u043e\u0431\u043e\u0435\u0432'}
            </label>
            <select
              value={wallpaperStyle}
              onChange={(e) =>
                updateSetting(
                  'wallpaperStyle',
                  e.target.value as PersonalizationSettings['wallpaperStyle']
                )
              }
              disabled={!backgroundAnimationsEnabled}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white transition focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
            >
              <option value="aurora">Аврора</option>
              <option value="nebula">Небула</option>
              <option value="glow">Сияние</option>
              <option value="cosmic">Космос</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Выберите характер фона: мягкая аврора, глубокая небула, чистое сияние или космическая атмосфера.
            </p>
          </div>
          <div>
            <label className="mb-2 flex items-center justify-between text-sm font-medium text-white">
              <span>
                {'\u0418\u043d\u0442\u0435\u043d\u0441\u0438\u0432\u043d\u043e\u0441\u0442\u044c'}
              </span>
              <span className="text-xs text-gray-400">{wallpaperIntensity}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={wallpaperIntensity}
              onChange={(e) => updateSetting('wallpaperIntensity', Number(e.target.value))}
              disabled={!backgroundAnimationsEnabled}
              className="w-full accent-emerald-400"
            />
            <p className="mt-1 text-xs text-gray-400">
              Пользуйтесь слайдером, чтобы усилить или ослабить эффект.
            </p>
          </div>

          <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <h4 className="text-sm font-semibold text-white">Дополнительные эффекты</h4>

            <SettingsToggle
              label="Падающий снег"
              description="Анимация падающих снежинок с реалистичным движением и вращением."
              icon={<Sparkles className="h-4 w-4" />}
              enabled={settings.snowfall ?? false}
              onToggle={(enabled) => updateSetting('snowfall', enabled)}
            />

            <SettingsToggle
              label="Плавающие частицы"
              description="Всплывающие светящиеся частицы для атмосферного эффекта."
              icon={<Sparkles className="h-4 w-4" />}
              enabled={settings.particles ?? false}
              onToggle={(enabled) => updateSetting('particles', enabled)}
            />
          </div>
        </div>
      </div>
    </div>
  )
})

'use client'

import { memo } from 'react'
import { Layout, ListTree, Save, Keyboard } from 'lucide-react'
import { SettingsToggle } from './SettingsToggle'
import { useLocalStorage } from '@/hooks/useLocalStorage'

interface WorkflowSettings {
  defaultView: 'grid' | 'list' | 'kanban'
  itemsPerPage: 10 | 25 | 50 | 100
  autoSave: boolean
  autoSaveInterval: 30 | 60 | 120
  keyboardShortcuts: boolean
}

export const WorkflowTab = memo(function WorkflowTab() {
  const [settings, setSettings] = useLocalStorage<WorkflowSettings>('workflow-settings', {
    defaultView: 'grid',
    itemsPerPage: 25,
    autoSave: true,
    autoSaveInterval: 60,
    keyboardShortcuts: true,
  })

  const updateSetting = <K extends keyof WorkflowSettings>(key: K, value: WorkflowSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      {/* Default View Section */}
      <div className="panel panel-glass rounded-2xl p-6">
        <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="rounded-full bg-blue-500/10 p-2 text-blue-300">
            <Layout className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Отображение по умолчанию</h3>
            <p className="text-xs text-gray-400">
              Выберите предпочтительный способ отображения писем.
            </p>
          </div>
        </div>

        <div>
          <label className="mb-3 block text-sm font-medium text-white">Вид по умолчанию</label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              onClick={() => updateSetting('defaultView', 'grid')}
              className={`rounded-xl border p-4 text-left transition ${
                settings.defaultView === 'grid'
                  ? 'border-emerald-400/50 bg-emerald-500/15 shadow-[0_0_18px_rgba(16,185,129,0.25)]'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="text-sm font-semibold text-white">Сетка</div>
              <div className="text-xs text-gray-400">Карточки в сетке</div>
            </button>

            <button
              onClick={() => updateSetting('defaultView', 'list')}
              className={`rounded-xl border p-4 text-left transition ${
                settings.defaultView === 'list'
                  ? 'border-emerald-400/50 bg-emerald-500/15 shadow-[0_0_18px_rgba(16,185,129,0.25)]'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="text-sm font-semibold text-white">Список</div>
              <div className="text-xs text-gray-400">Табличное представление</div>
            </button>

            <button
              onClick={() => updateSetting('defaultView', 'kanban')}
              className={`rounded-xl border p-4 text-left transition ${
                settings.defaultView === 'kanban'
                  ? 'border-emerald-400/50 bg-emerald-500/15 shadow-[0_0_18px_rgba(16,185,129,0.25)]'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="text-sm font-semibold text-white">Канбан</div>
              <div className="text-xs text-gray-400">Доска с колонками</div>
            </button>
          </div>
        </div>
      </div>

      {/* Pagination Section */}
      <div className="panel panel-glass rounded-2xl p-6">
        <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="rounded-full bg-purple-500/10 p-2 text-purple-300">
            <ListTree className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Элементов на странице</h3>
            <p className="text-xs text-gray-400">
              Настройте количество отображаемых элементов на одной странице.
            </p>
          </div>
        </div>

        <div>
          <label className="mb-3 block text-sm font-medium text-white">Количество элементов</label>
          <select
            value={settings.itemsPerPage}
            onChange={(e) =>
              updateSetting(
                'itemsPerPage',
                parseInt(e.target.value) as WorkflowSettings['itemsPerPage']
              )
            }
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white transition focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
          >
            <option value="10">10 элементов</option>
            <option value="25">25 элементов</option>
            <option value="50">50 элементов</option>
            <option value="100">100 элементов</option>
          </select>
          <p className="mt-2 text-xs text-gray-400">
            {settings.itemsPerPage <= 25 && 'Быстрая загрузка, подходит для медленного интернета'}
            {settings.itemsPerPage === 50 && 'Оптимальный баланс между скоростью и объемом данных'}
            {settings.itemsPerPage === 100 && 'Максимум данных на странице, может быть медленнее'}
          </p>
        </div>
      </div>

      {/* Auto-save Section */}
      <div className="panel panel-glass rounded-2xl p-6">
        <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="rounded-full bg-teal-500/10 p-2 text-teal-300">
            <Save className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Автосохранение</h3>
            <p className="text-xs text-gray-400">
              Автоматически сохранять черновики при редактировании.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <SettingsToggle
            label="Автосохранение"
            description="Автоматически сохранять изменения при редактировании писем."
            icon={<Save className="h-4 w-4" />}
            enabled={settings.autoSave}
            onToggle={(enabled) => updateSetting('autoSave', enabled)}
          />

          {settings.autoSave && (
            <div className="ml-11 space-y-3 border-l-2 border-white/10 pl-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-white">
                  Интервал автосохранения
                </label>
                <select
                  value={settings.autoSaveInterval}
                  onChange={(e) =>
                    updateSetting(
                      'autoSaveInterval',
                      parseInt(e.target.value) as WorkflowSettings['autoSaveInterval']
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white transition focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                >
                  <option value="30">Каждые 30 секунд</option>
                  <option value="60">Каждую минуту</option>
                  <option value="120">Каждые 2 минуты</option>
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  {settings.autoSaveInterval === 30 &&
                    'Частое сохранение, минимальный риск потери данных'}
                  {settings.autoSaveInterval === 60 &&
                    'Оптимальный баланс между частотой и нагрузкой'}
                  {settings.autoSaveInterval === 120 &&
                    'Редкое сохранение, меньше нагрузки на сервер'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Section */}
      <div className="panel panel-glass rounded-2xl p-6">
        <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="rounded-full bg-orange-500/10 p-2 text-orange-300">
            <Keyboard className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Горячие клавиши</h3>
            <p className="text-xs text-gray-400">
              Используйте горячие клавиши для быстрой навигации и действий.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <SettingsToggle
            label="Горячие клавиши"
            description="Включить горячие клавиши для быстрых действий (например, Ctrl+N для нового письма)."
            icon={<Keyboard className="h-4 w-4" />}
            enabled={settings.keyboardShortcuts}
            onToggle={(enabled) => updateSetting('keyboardShortcuts', enabled)}
          />

          {settings.keyboardShortcuts && (
            <div className="ml-11 space-y-2 border-l-2 border-white/10 pl-6">
              <div className="text-sm text-gray-300">Доступные горячие клавиши:</div>
              <div className="space-y-1 text-xs text-gray-400">
                <div className="flex items-center justify-between">
                  <span>Создать письмо</span>
                  <kbd className="rounded bg-white/10 px-2 py-1 font-mono">Ctrl + N</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Поиск</span>
                  <kbd className="rounded bg-white/10 px-2 py-1 font-mono">Ctrl + K</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Сохранить</span>
                  <kbd className="rounded bg-white/10 px-2 py-1 font-mono">Ctrl + S</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Настройки</span>
                  <kbd className="rounded bg-white/10 px-2 py-1 font-mono">Ctrl + ,</kbd>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

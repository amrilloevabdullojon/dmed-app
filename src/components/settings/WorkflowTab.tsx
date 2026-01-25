'use client'

import { memo } from 'react'
import { Layout, ListTree, Keyboard, Table, LayoutGrid, Columns3 } from 'lucide-react'
import { SettingsToggle } from './SettingsToggle'
import { useLocalStorage } from '@/hooks/useLocalStorage'

// Типы для настроек (совместимы с LettersPageClient)
type ViewMode = 'table' | 'cards' | 'kanban'

const VIEW_OPTIONS: {
  value: ViewMode
  label: string
  description: string
  icon: React.ReactNode
}[] = [
  {
    value: 'cards',
    label: 'Карточки',
    description: 'Карточки в сетке',
    icon: <LayoutGrid className="h-5 w-5" />,
  },
  {
    value: 'table',
    label: 'Таблица',
    description: 'Табличное представление',
    icon: <Table className="h-5 w-5" />,
  },
  {
    value: 'kanban',
    label: 'Канбан',
    description: 'Доска с колонками',
    icon: <Columns3 className="h-5 w-5" />,
  },
]

const ITEMS_OPTIONS = [
  { value: 10, label: '10 элементов', hint: 'Быстрая загрузка' },
  { value: 25, label: '25 элементов', hint: 'Подходит для медленного интернета' },
  { value: 50, label: '50 элементов', hint: 'Оптимальный баланс' },
  { value: 100, label: '100 элементов', hint: 'Максимум данных' },
]

export const WorkflowTab = memo(function WorkflowTab() {
  // Используем те же ключи, что и на странице писем
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>('letters-view-mode', 'table')
  const [itemsPerPage, setItemsPerPage] = useLocalStorage<number>('letters-items-per-page', 50)
  const [keyboardShortcuts, setKeyboardShortcuts] = useLocalStorage<boolean>(
    'keyboard-shortcuts-enabled',
    true
  )

  return (
    <div className="space-y-6">
      {/* Default View Section */}
      <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-800/60">
        <div className="border-b border-slate-700/50 bg-slate-800/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-2.5 shadow-lg shadow-blue-500/20">
              <Layout className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Отображение по умолчанию</h3>
              <p className="text-sm text-slate-400">
                Выберите предпочтительный способ отображения писем
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <label className="mb-4 block text-sm font-medium text-slate-300">Вид по умолчанию</label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setViewMode(option.value)}
                className={`group relative overflow-hidden rounded-xl border p-4 text-left transition-all ${
                  viewMode === option.value
                    ? 'border-blue-400/50 bg-gradient-to-br from-blue-500/15 to-blue-600/10 shadow-lg shadow-blue-500/10'
                    : 'border-slate-600/50 bg-slate-700/30 hover:border-slate-500 hover:bg-slate-700/50'
                }`}
              >
                {viewMode === option.value && (
                  <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-400 shadow-lg shadow-blue-400/50" />
                )}
                <div
                  className={`mb-3 inline-flex rounded-lg p-2.5 ${
                    viewMode === option.value
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-slate-600/50 text-slate-400 group-hover:bg-slate-600 group-hover:text-slate-300'
                  }`}
                >
                  {option.icon}
                </div>
                <div className="text-sm font-semibold text-white">{option.label}</div>
                <div className="mt-1 text-xs text-slate-400">{option.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pagination Section */}
      <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-800/60">
        <div className="border-b border-slate-700/50 bg-slate-800/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 p-2.5 shadow-lg shadow-purple-500/20">
              <ListTree className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Элементов на странице</h3>
              <p className="text-sm text-slate-400">Настройте количество отображаемых элементов</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <label className="mb-4 block text-sm font-medium text-slate-300">
            Количество элементов
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ITEMS_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setItemsPerPage(option.value)}
                className={`group relative overflow-hidden rounded-xl border p-3 text-center transition-all ${
                  itemsPerPage === option.value
                    ? 'border-purple-400/50 bg-gradient-to-br from-purple-500/15 to-purple-600/10 shadow-lg shadow-purple-500/10'
                    : 'border-slate-600/50 bg-slate-700/30 hover:border-slate-500 hover:bg-slate-700/50'
                }`}
              >
                {itemsPerPage === option.value && (
                  <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-purple-400 shadow-lg shadow-purple-400/50" />
                )}
                <div
                  className={`text-2xl font-bold ${
                    itemsPerPage === option.value ? 'text-purple-300' : 'text-white'
                  }`}
                >
                  {option.value}
                </div>
                <div className="mt-1 text-xs text-slate-400">{option.hint}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Section */}
      <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-800/60">
        <div className="border-b border-slate-700/50 bg-slate-800/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 p-2.5 shadow-lg shadow-orange-500/20">
              <Keyboard className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Горячие клавиши</h3>
              <p className="text-sm text-slate-400">
                Используйте горячие клавиши для быстрой навигации
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <SettingsToggle
              label="Включить горячие клавиши"
              description="Быстрые действия с помощью клавиатуры (Ctrl+N, Ctrl+K и др.)"
              icon={<Keyboard className="h-4 w-4" />}
              enabled={keyboardShortcuts}
              onToggle={setKeyboardShortcuts}
            />

            {keyboardShortcuts && (
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-600/50 bg-slate-700/30">
                <div className="border-b border-slate-600/50 bg-slate-700/50 px-4 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Доступные горячие клавиши
                  </span>
                </div>
                <div className="divide-y divide-slate-600/30">
                  {[
                    { key: 'Ctrl + N', action: 'Создать письмо' },
                    { key: 'Ctrl + K', action: 'Поиск' },
                    { key: 'Ctrl + S', action: 'Сохранить' },
                    { key: 'Ctrl + ,', action: 'Настройки' },
                    { key: 'J / ↓', action: 'Следующий элемент' },
                    { key: 'K / ↑', action: 'Предыдущий элемент' },
                    { key: 'Enter', action: 'Открыть' },
                    { key: 'Space', action: 'Выбрать' },
                    { key: 'Esc', action: 'Закрыть / Отмена' },
                  ].map((shortcut, index) => (
                    <div key={index} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm text-slate-300">{shortcut.action}</span>
                      <kbd className="rounded-lg bg-slate-600/50 px-2.5 py-1 font-mono text-xs text-slate-300 ring-1 ring-slate-500/50">
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

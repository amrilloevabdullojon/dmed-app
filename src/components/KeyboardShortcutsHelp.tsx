'use client'

import { useState, useEffect } from 'react'
import { X, Command, Keyboard } from 'lucide-react'
import { useKeyboardShortcut, getShortcutDisplay } from '@/hooks/useKeyboardShortcuts'

interface ShortcutItem {
  keys: {
    key: string
    modifiers?: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean }
  }
  description: string
  category: string
}

const shortcuts: ShortcutItem[] = [
  // Навигация
  { keys: { key: '/' }, description: 'Перейти к поиску', category: 'Навигация' },
  {
    keys: { key: 'h', modifiers: { alt: true } },
    description: 'На главную',
    category: 'Навигация',
  },
  { keys: { key: 'g', modifiers: { alt: true } }, description: 'К письмам', category: 'Навигация' },

  // Действия
  {
    keys: { key: 'n', modifiers: { ctrl: true } },
    description: 'Новое письмо',
    category: 'Действия',
  },
  { keys: { key: 's', modifiers: { ctrl: true } }, description: 'Сохранить', category: 'Действия' },
  { keys: { key: 'Escape' }, description: 'Закрыть / Отмена', category: 'Действия' },

  // Список
  { keys: { key: 'ArrowUp' }, description: 'Предыдущий элемент', category: 'Список' },
  { keys: { key: 'ArrowDown' }, description: 'Следующий элемент', category: 'Список' },
  { keys: { key: 'Enter' }, description: 'Открыть выбранное', category: 'Список' },
  { keys: { key: 'j' }, description: 'Вниз по списку', category: 'Список' },
  { keys: { key: 'k' }, description: 'Вверх по списку', category: 'Список' },

  // Справка
  {
    keys: { key: '?', modifiers: { shift: true } },
    description: 'Показать горячие клавиши',
    category: 'Справка',
  },
]

interface KeyboardShortcutsHelpProps {
  isOpen: boolean
  onClose: () => void
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  // Close on Escape
  useKeyboardShortcut('Escape', onClose, { enabled: isOpen })

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  // Group shortcuts by category
  const categories = shortcuts.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = []
      }
      acc[shortcut.category].push(shortcut)
      return acc
    },
    {} as Record<string, ShortcutItem[]>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="relative z-10 max-h-[80vh] w-full max-w-lg overflow-auto rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-2xl"
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
              <Keyboard className="h-5 w-5 text-blue-400" />
            </div>
            <h2 id="shortcuts-title" className="text-lg font-semibold text-white">
              Горячие клавиши
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-700 hover:text-white"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Shortcuts by category */}
        <div className="space-y-6">
          {Object.entries(categories).map(([category, items]) => (
            <div key={category}>
              <h3 className="mb-3 text-sm font-medium text-gray-400">{category}</h3>
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg bg-gray-700/50 px-3 py-2"
                  >
                    <span className="text-sm text-gray-300">{item.description}</span>
                    <kbd className="rounded bg-gray-600 px-2 py-1 font-mono text-xs text-gray-200">
                      {getShortcutDisplay(item.keys)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
          <Command className="h-3 w-3" />
          <span>Нажмите Escape для закрытия</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook for using keyboard shortcuts help modal
 */
export function useKeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false)

  // Open on Shift+?
  useKeyboardShortcut('?', () => setIsOpen(true), {
    modifiers: { shift: true },
    ignoreInputs: true,
  })

  const open = () => setIsOpen(true)
  const close = () => setIsOpen(false)

  return {
    isOpen,
    open,
    close,
    KeyboardShortcutsDialog: <KeyboardShortcutsHelp isOpen={isOpen} onClose={close} />,
  }
}

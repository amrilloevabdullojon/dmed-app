'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { X, Keyboard } from 'lucide-react'
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcuts'

interface ShortcutGroup {
  title: string
  shortcuts: Array<{
    keys: string
    description: string
  }>
}

interface KeyboardShortcutsHelpProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Модальное окно со справкой по горячим клавишам
 *
 * Открывается по нажатию "?"
 */
export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null

  const shortcutGroups: ShortcutGroup[] = [
    {
      title: 'Общие',
      shortcuts: [
        { keys: 'Ctrl+K', description: 'Открыть командную палитру' },
        { keys: '?', description: 'Показать справку по горячим клавишам' },
        { keys: '/', description: 'Фокус на поиске' },
        { keys: 'Esc', description: 'Закрыть модальное окно' },
      ],
    },
    {
      title: 'Навигация',
      shortcuts: [
        { keys: 'G then H', description: 'Перейти на главную' },
        { keys: 'G then L', description: 'Перейти к письмам' },
        { keys: 'G then A', description: 'Перейти к аналитике' },
        { keys: 'G then S', description: 'Перейти к настройкам' },
      ],
    },
    {
      title: 'Действия',
      shortcuts: [
        { keys: 'Ctrl+N', description: 'Создать новое письмо' },
        { keys: 'E', description: 'Редактировать (на странице письма)' },
        { keys: 'D', description: 'Удалить (на странице письма)' },
        { keys: 'Ctrl+S', description: 'Сохранить' },
      ],
    },
    {
      title: 'Списки',
      shortcuts: [
        { keys: 'J / ↓', description: 'Следующий элемент' },
        { keys: 'K / ↑', description: 'Предыдущий элемент' },
        { keys: 'Enter', description: 'Открыть выбранный элемент' },
        { keys: 'X', description: 'Выбрать/снять выбор' },
      ],
    },
    {
      title: 'Редактирование',
      shortcuts: [
        { keys: 'Ctrl+Enter', description: 'Отправить форму' },
        { keys: 'Ctrl+Z', description: 'Отменить' },
        { keys: 'Ctrl+Y', description: 'Повторить' },
        { keys: 'Ctrl+A', description: 'Выбрать всё' },
      ],
    },
  ]

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-700 bg-gray-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/20">
              <Keyboard className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Горячие клавиши</h2>
              <p className="text-sm text-gray-400">
                Используйте клавиатуру для быстрой навигации
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-700 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto p-6">
          <div className="grid gap-6 md:grid-cols-2">
            {shortcutGroups.map((group) => (
              <div key={group.title}>
                <h3 className="mb-3 font-semibold text-white">{group.title}</h3>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg bg-gray-900/50 p-3"
                    >
                      <span className="text-sm text-gray-300">{shortcut.description}</span>
                      <kbd className="flex items-center gap-1 rounded bg-gray-700 px-2 py-1 font-mono text-xs text-gray-300">
                        {shortcut.keys.split(' ').map((part, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <span className="text-gray-500">then</span>}
                            <span>{part}</span>
                          </React.Fragment>
                        ))}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-4 text-center">
          <p className="text-sm text-gray-500">
            Нажмите <kbd className="rounded bg-gray-700 px-2 py-0.5">?</kbd> чтобы открыть эту
            справку снова
          </p>
        </div>
      </div>
    </>
  )
}

export function useKeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  // Открытие по "?"
  useKeyboardShortcut({
    key: '?',
    shift: true, // Shift+/ = ?
    description: 'Show keyboard shortcuts',
    handler: open,
  })

  // Закрытие по Escape
  useKeyboardShortcut({
    key: 'Escape',
    description: 'Close shortcuts help',
    handler: close,
    enabled: isOpen,
  })

  const KeyboardShortcutsDialog = useMemo(
    () => <KeyboardShortcutsHelp isOpen={isOpen} onClose={close} />,
    [isOpen, close]
  )

  return { isOpen, open, close, KeyboardShortcutsDialog }
}

/**
 * Floating button для открытия справки
 */
export function KeyboardShortcutsButton() {
  const { isOpen, open, close, KeyboardShortcutsDialog } = useKeyboardShortcutsHelp()

  return (
    <>
      <button
        onClick={() => (isOpen ? close() : open())}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 shadow-lg transition hover:bg-gray-700"
        title="Горячие клавиши (?)"
      >
        <Keyboard className="h-5 w-5 text-gray-300" />
      </button>

      {KeyboardShortcutsDialog}
    </>
  )
}

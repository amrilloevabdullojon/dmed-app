import { useEffect, useCallback, useState } from 'react'

interface KeyboardShortcuts {
  onUp?: () => void
  onDown?: () => void
  onEnter?: () => void
  onEscape?: () => void
  onSpace?: () => void
  onDelete?: () => void
  onSearch?: () => void // Ctrl+F or /
  onNew?: () => void // N
  onSelectAll?: () => void // Ctrl+A
  enabled?: boolean
}

// Проверяем настройку горячих клавиш из localStorage
function getKeyboardShortcutsEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const stored = localStorage.getItem('keyboard-shortcuts-enabled')
    if (stored !== null) {
      return JSON.parse(stored) === true
    }
  } catch {
    // ignore
  }
  return true
}

export function useKeyboard({
  onUp,
  onDown,
  onEnter,
  onEscape,
  onSpace,
  onDelete,
  onSearch,
  onNew,
  onSelectAll,
  enabled = true,
}: KeyboardShortcuts) {
  const [shortcutsEnabled, setShortcutsEnabled] = useState(true)

  // Слушаем изменения в localStorage
  useEffect(() => {
    setShortcutsEnabled(getKeyboardShortcutsEnabled())

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'keyboard-shortcuts-enabled') {
        setShortcutsEnabled(getKeyboardShortcutsEnabled())
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || !shortcutsEnabled) return

      // Игнорировать если фокус в поле ввода
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        // Только Escape работает в полях ввода
        if (e.key === 'Escape' && onEscape) {
          e.preventDefault()
          onEscape()
        }
        return
      }

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          if (onDown) {
            e.preventDefault()
            onDown()
          }
          break

        case 'k':
        case 'ArrowUp':
          if (onUp) {
            e.preventDefault()
            onUp()
          }
          break

        case 'Enter':
          if (onEnter) {
            e.preventDefault()
            onEnter()
          }
          break

        case 'Escape':
          if (onEscape) {
            e.preventDefault()
            onEscape()
          }
          break

        case ' ':
          if (onSpace) {
            e.preventDefault()
            onSpace()
          }
          break

        case 'Delete':
        case 'Backspace':
          if (onDelete && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            onDelete()
          }
          break

        case '/':
          if (onSearch && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            onSearch()
          }
          break

        case 'f':
          if (onSearch && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            onSearch()
          }
          break

        case 'n':
          if (onNew && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            onNew()
          }
          break

        case 'a':
          if (onSelectAll && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            onSelectAll()
          }
          break
      }
    },
    [
      enabled,
      shortcutsEnabled,
      onUp,
      onDown,
      onEnter,
      onEscape,
      onSpace,
      onDelete,
      onSearch,
      onNew,
      onSelectAll,
    ]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

// Компонент для отображения подсказок по горячим клавишам
export function KeyboardShortcutsHelp() {
  return (
    <div className="space-y-1 text-xs text-gray-500">
      <div>
        <kbd className="rounded bg-gray-700 px-1">J</kbd> /{' '}
        <kbd className="rounded bg-gray-700 px-1">↓</kbd> — Вниз
      </div>
      <div>
        <kbd className="rounded bg-gray-700 px-1">K</kbd> /{' '}
        <kbd className="rounded bg-gray-700 px-1">↑</kbd> — Вверх
      </div>
      <div>
        <kbd className="rounded bg-gray-700 px-1">Enter</kbd> — Открыть
      </div>
      <div>
        <kbd className="rounded bg-gray-700 px-1">Space</kbd> — Выбрать
      </div>
      <div>
        <kbd className="rounded bg-gray-700 px-1">Esc</kbd> — Закрыть/Отмена
      </div>
      <div>
        <kbd className="rounded bg-gray-700 px-1">/</kbd> — Поиск
      </div>
      <div>
        <kbd className="rounded bg-gray-700 px-1">N</kbd> — Новое письмо
      </div>
    </div>
  )
}

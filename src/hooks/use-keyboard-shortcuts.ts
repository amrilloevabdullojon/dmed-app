import { useEffect, useCallback, useRef } from 'react'

/**
 * Типы для клавиш
 */
export type ModifierKey = 'ctrl' | 'alt' | 'shift' | 'meta'
export type Key = string

export interface ShortcutConfig {
  key: Key
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
  description?: string
  preventDefault?: boolean
  enabled?: boolean
}

export interface Shortcut extends ShortcutConfig {
  handler: (event: KeyboardEvent) => void
}

/**
 * Проверяет, совпадает ли нажатая комбинация с конфигом
 */
function matchesShortcut(event: KeyboardEvent, config: ShortcutConfig): boolean {
  // Нормализуем key (приводим к lowercase)
  const eventKey = event.key.toLowerCase()
  const configKey = config.key.toLowerCase()

  // Проверяем основную клавишу
  if (eventKey !== configKey) return false

  // Проверяем модификаторы
  if (config.ctrl && !event.ctrlKey) return false
  if (!config.ctrl && event.ctrlKey) return false

  if (config.alt && !event.altKey) return false
  if (!config.alt && event.altKey) return false

  if (config.shift && !event.shiftKey) return false
  if (!config.shift && event.shiftKey) return false

  if (config.meta && !event.metaKey) return false
  if (!config.meta && event.metaKey) return false

  return true
}

/**
 * Проверяет, является ли элемент полем ввода
 */
function isInputElement(element: Element | null): boolean {
  if (!element) return false

  const tagName = element.tagName.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true
  }

  // Проверяем contenteditable
  if (element.getAttribute('contenteditable') === 'true') {
    return true
  }

  return false
}

/**
 * Hook для регистрации горячих клавиш
 *
 * @example
 * ```tsx
 * useKeyboardShortcut({
 *   key: 'k',
 *   ctrl: true,
 *   description: 'Open search',
 *   handler: () => openSearch(),
 * })
 * ```
 */
export function useKeyboardShortcut(config: Shortcut) {
  const { key, ctrl, alt, shift, meta, handler, preventDefault = true, enabled = true } = config

  // Используем ref для handler чтобы избежать пересоздания listener
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Игнорируем если фокус в поле ввода (кроме Escape)
      if (key.toLowerCase() !== 'escape' && isInputElement(event.target as Element)) {
        return
      }

      if (matchesShortcut(event, { key, ctrl, alt, shift, meta })) {
        if (preventDefault) {
          event.preventDefault()
        }
        handlerRef.current(event)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [key, ctrl, alt, shift, meta, preventDefault, enabled])
}

/**
 * Hook для регистрации нескольких горячих клавиш
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts([
 *   { key: 'k', ctrl: true, handler: openSearch },
 *   { key: 'n', ctrl: true, handler: createNew },
 *   { key: '/', handler: focusSearch },
 * ])
 * ```
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const shortcutsRef = useRef(shortcuts)
  shortcutsRef.current = shortcuts

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Проверяем каждый shortcut
      for (const shortcut of shortcutsRef.current) {
        if (shortcut.enabled === false) continue

        // Игнорируем если фокус в поле ввода (кроме Escape)
        if (
          shortcut.key.toLowerCase() !== 'escape' &&
          isInputElement(event.target as Element)
        ) {
          continue
        }

        if (matchesShortcut(event, shortcut)) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault()
          }
          shortcut.handler(event)
          break // Обрабатываем только первый совпавший
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}

/**
 * Форматирует shortcut для отображения
 *
 * @example
 * ```tsx
 * formatShortcut({ key: 'k', ctrl: true }) // "Ctrl+K"
 * formatShortcut({ key: 'Enter', shift: true }) // "Shift+Enter"
 * ```
 */
export function formatShortcut(config: ShortcutConfig): string {
  const parts: string[] = []

  // Определяем платформу для правильного отображения
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)

  if (config.ctrl) parts.push(isMac ? '⌃' : 'Ctrl')
  if (config.alt) parts.push(isMac ? '⌥' : 'Alt')
  if (config.shift) parts.push(isMac ? '⇧' : 'Shift')
  if (config.meta) parts.push(isMac ? '⌘' : 'Win')

  // Специальные клавиши
  const specialKeys: Record<string, string> = {
    escape: 'Esc',
    enter: 'Enter',
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
    backspace: '⌫',
    delete: 'Del',
    tab: 'Tab',
    ' ': 'Space',
  }

  const key = config.key.toLowerCase()
  parts.push(specialKeys[key] || config.key.toUpperCase())

  return parts.join('+')
}

/**
 * Глобальное хранилище зарегистрированных shortcuts для справки
 */
const globalShortcuts: Map<string, ShortcutConfig> = new Map()

export function registerGlobalShortcut(id: string, config: ShortcutConfig) {
  globalShortcuts.set(id, config)
}

export function unregisterGlobalShortcut(id: string) {
  globalShortcuts.delete(id)
}

export function getGlobalShortcuts(): Map<string, ShortcutConfig> {
  return globalShortcuts
}

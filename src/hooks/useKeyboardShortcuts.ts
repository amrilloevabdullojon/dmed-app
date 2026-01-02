'use client'

import { useEffect, useCallback, useRef } from 'react'

/**
 * Modifier keys
 */
interface Modifiers {
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
}

/**
 * Keyboard shortcut definition
 */
export interface KeyboardShortcut {
  /** Key to listen for (e.g., 'k', 'Enter', 'Escape') */
  key: string

  /** Modifier keys */
  modifiers?: Modifiers

  /** Callback function */
  handler: (event: KeyboardEvent) => void

  /** Description for help menu */
  description?: string

  /** Prevent default browser behavior */
  preventDefault?: boolean

  /** Only trigger when no input is focused */
  ignoreInputs?: boolean

  /** Enable/disable shortcut */
  enabled?: boolean
}

/**
 * Options for useKeyboardShortcuts
 */
interface UseKeyboardShortcutsOptions {
  /** Global shortcuts (work even when inputs are focused) */
  global?: boolean

  /** Scope element (default: document) */
  scope?: React.RefObject<HTMLElement>
}

/**
 * Check if element is an input
 */
function isInputElement(element: Element | null): boolean {
  if (!element) return false
  const tagName = element.tagName.toLowerCase()
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    (element as HTMLElement).isContentEditable
  )
}

/**
 * Check if modifiers match
 */
function checkModifiers(event: KeyboardEvent, modifiers?: Modifiers): boolean {
  if (!modifiers) return !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey

  const ctrl = modifiers.ctrl ?? false
  const alt = modifiers.alt ?? false
  const shift = modifiers.shift ?? false
  const meta = modifiers.meta ?? false

  return (
    event.ctrlKey === ctrl &&
    event.altKey === alt &&
    event.shiftKey === shift &&
    event.metaKey === meta
  )
}

/**
 * Normalize key for comparison
 */
function normalizeKey(key: string): string {
  const keyMap: Record<string, string> = {
    esc: 'Escape',
    escape: 'Escape',
    enter: 'Enter',
    space: ' ',
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    tab: 'Tab',
    delete: 'Delete',
    backspace: 'Backspace',
  }
  return keyMap[key.toLowerCase()] || key
}

/**
 * Hook for handling keyboard shortcuts.
 *
 * @example
 * ```tsx
 * function App() {
 *   const [isSearchOpen, setSearchOpen] = useState(false)
 *
 *   useKeyboardShortcuts([
 *     {
 *       key: 'k',
 *       modifiers: { ctrl: true },
 *       handler: () => setSearchOpen(true),
 *       description: 'Open search',
 *       preventDefault: true
 *     },
 *     {
 *       key: 'Escape',
 *       handler: () => setSearchOpen(false),
 *       description: 'Close search'
 *     },
 *     {
 *       key: 'n',
 *       modifiers: { ctrl: true, shift: true },
 *       handler: () => createNewItem(),
 *       description: 'Create new item',
 *       ignoreInputs: true
 *     }
 *   ])
 * }
 * ```
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
): void {
  const { global = false, scope } = options

  const shortcutsRef = useRef(shortcuts)
  shortcutsRef.current = shortcuts

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Check if we should ignore (input focused)
      const isInput = isInputElement(event.target as Element)

      for (const shortcut of shortcutsRef.current) {
        // Check if shortcut is enabled
        if (shortcut.enabled === false) continue

        // Check if we should ignore inputs
        if (shortcut.ignoreInputs !== false && isInput && !global) continue

        // Check key match
        const normalizedKey = normalizeKey(shortcut.key)
        if (event.key !== normalizedKey && event.key.toLowerCase() !== shortcut.key.toLowerCase()) {
          continue
        }

        // Check modifiers
        if (!checkModifiers(event, shortcut.modifiers)) continue

        // Execute handler
        if (shortcut.preventDefault !== false) {
          event.preventDefault()
        }
        shortcut.handler(event)
        break // Only trigger first matching shortcut
      }
    },
    [global]
  )

  useEffect(() => {
    const target = scope?.current || document

    target.addEventListener('keydown', handleKeyDown as EventListener)
    return () => target.removeEventListener('keydown', handleKeyDown as EventListener)
  }, [handleKeyDown, scope])
}

/**
 * Hook for single keyboard shortcut
 *
 * @example
 * ```tsx
 * function Modal({ onClose }) {
 *   useKeyboardShortcut('Escape', onClose)
 *
 *   return <div>Modal content</div>
 * }
 * ```
 */
export function useKeyboardShortcut(
  key: string,
  handler: (event: KeyboardEvent) => void,
  options: Omit<KeyboardShortcut, 'key' | 'handler'> & UseKeyboardShortcutsOptions = {}
): void {
  const { global, scope, ...shortcutOptions } = options

  useKeyboardShortcuts(
    [
      {
        key,
        handler,
        ...shortcutOptions,
      },
    ],
    { global, scope }
  )
}

/**
 * Hook for arrow key navigation
 *
 * @example
 * ```tsx
 * function List({ items }) {
 *   const [selectedIndex, setSelectedIndex] = useState(0)
 *
 *   useArrowNavigation({
 *     onUp: () => setSelectedIndex(i => Math.max(0, i - 1)),
 *     onDown: () => setSelectedIndex(i => Math.min(items.length - 1, i + 1)),
 *     onEnter: () => selectItem(items[selectedIndex])
 *   })
 * }
 * ```
 */
export function useArrowNavigation(handlers: {
  onUp?: () => void
  onDown?: () => void
  onLeft?: () => void
  onRight?: () => void
  onEnter?: () => void
  onEscape?: () => void
  enabled?: boolean
}): void {
  const { onUp, onDown, onLeft, onRight, onEnter, onEscape, enabled = true } = handlers

  useKeyboardShortcuts(
    [
      { key: 'ArrowUp', handler: () => onUp?.(), enabled: enabled && !!onUp },
      { key: 'ArrowDown', handler: () => onDown?.(), enabled: enabled && !!onDown },
      { key: 'ArrowLeft', handler: () => onLeft?.(), enabled: enabled && !!onLeft },
      { key: 'ArrowRight', handler: () => onRight?.(), enabled: enabled && !!onRight },
      { key: 'Enter', handler: () => onEnter?.(), enabled: enabled && !!onEnter },
      { key: 'Escape', handler: () => onEscape?.(), enabled: enabled && !!onEscape },
    ],
    { global: true }
  )
}

/**
 * Get shortcut display string (for UI)
 *
 * @example
 * getShortcutDisplay({ key: 'k', modifiers: { ctrl: true } }) // 'Ctrl+K'
 */
export function getShortcutDisplay(shortcut: Pick<KeyboardShortcut, 'key' | 'modifiers'>): string {
  const parts: string[] = []

  if (shortcut.modifiers?.ctrl) parts.push('Ctrl')
  if (shortcut.modifiers?.alt) parts.push('Alt')
  if (shortcut.modifiers?.shift) parts.push('Shift')
  if (shortcut.modifiers?.meta) {
    parts.push(typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? '⌘' : 'Win')
  }

  // Capitalize single letter keys
  let key = shortcut.key
  if (key.length === 1) {
    key = key.toUpperCase()
  }

  parts.push(key)

  return parts.join('+')
}

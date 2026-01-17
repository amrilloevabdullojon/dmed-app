'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, FileText, Plus, Settings, User, LogOut, Home, BarChart } from 'lucide-react'
import { useKeyboardShortcut, formatShortcut } from '@/hooks/use-keyboard-shortcuts'
import { cn } from '@/lib/utils'

interface Command {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  shortcut?: string
  action: () => void
  category?: string
}

interface CommandPaletteProps {
  commands?: Command[]
}

/**
 * Command Palette - быстрый доступ к действиям через Cmd+K
 *
 * @example
 * ```tsx
 * <CommandPalette />
 * ```
 */
export function CommandPalette({ commands: customCommands }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Определяем команды по умолчанию
  const defaultCommands: Command[] = [
    {
      id: 'home',
      label: 'Перейти на главную',
      description: 'Открыть дашборд',
      icon: <Home className="h-4 w-4" />,
      action: () => {
        router.push('/')
        setIsOpen(false)
      },
      category: 'Навигация',
    },
    {
      id: 'letters',
      label: 'Все письма',
      description: 'Открыть список писем',
      icon: <FileText className="h-4 w-4" />,
      action: () => {
        router.push('/letters')
        setIsOpen(false)
      },
      category: 'Навигация',
    },
    {
      id: 'new-letter',
      label: 'Создать письмо',
      description: 'Добавить новое письмо',
      icon: <Plus className="h-4 w-4" />,
      shortcut: 'Ctrl+N',
      action: () => {
        router.push('/letters/new')
        setIsOpen(false)
      },
      category: 'Действия',
    },
    {
      id: 'analytics',
      label: 'Аналитика',
      description: 'Открыть страницу аналитики',
      icon: <BarChart className="h-4 w-4" />,
      action: () => {
        router.push('/analytics')
        setIsOpen(false)
      },
      category: 'Навигация',
    },
    {
      id: 'settings',
      label: 'Настройки',
      description: 'Открыть настройки',
      icon: <Settings className="h-4 w-4" />,
      action: () => {
        router.push('/settings')
        setIsOpen(false)
      },
      category: 'Навигация',
    },
    {
      id: 'profile',
      label: 'Профиль',
      description: 'Открыть профиль',
      icon: <User className="h-4 w-4" />,
      action: () => {
        router.push('/profile')
        setIsOpen(false)
      },
      category: 'Навигация',
    },
  ]

  const allCommands = [...defaultCommands, ...(customCommands || [])]

  // Фильтруем команды по поисковому запросу
  const filteredCommands = search
    ? allCommands.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(search.toLowerCase()) ||
          cmd.description?.toLowerCase().includes(search.toLowerCase())
      )
    : allCommands

  // Группируем по категориям
  const groupedCommands = filteredCommands.reduce(
    (acc, cmd) => {
      const category = cmd.category || 'Другое'
      if (!acc[category]) acc[category] = []
      acc[category].push(cmd)
      return acc
    },
    {} as Record<string, Command[]>
  )

  // Открытие/закрытие палитры
  useKeyboardShortcut({
    key: 'k',
    ctrl: true,
    description: 'Open command palette',
    handler: () => setIsOpen((prev) => !prev),
  })

  // Закрытие по Escape
  useKeyboardShortcut({
    key: 'Escape',
    description: 'Close command palette',
    handler: () => setIsOpen(false),
    enabled: isOpen,
  })

  // Навигация стрелками
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, filteredCommands])

  // Фокус на input при открытии
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Сброс состояния при закрытии
  useEffect(() => {
    if (!isOpen) {
      setSearch('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Palette */}
      <div className="fixed left-1/2 top-1/4 z-50 w-full max-w-2xl -translate-x-1/2 rounded-xl border border-gray-700 bg-gray-800 shadow-2xl">
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-gray-700 p-4">
          <Search className="h-5 w-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Поиск команд..."
            className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none"
          />
          <kbd className="hidden rounded bg-gray-700 px-2 py-1 text-xs text-gray-400 sm:block">
            ESC
          </kbd>
        </div>

        {/* Commands List */}
        <div className="max-h-96 overflow-y-auto p-2">
          {Object.keys(groupedCommands).length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              Команды не найдены
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, commands]) => (
              <div key={category} className="mb-4 last:mb-0">
                <div className="mb-1 px-3 py-1 text-xs font-semibold uppercase text-gray-500">
                  {category}
                </div>
                {commands.map((cmd, index) => {
                  const globalIndex = filteredCommands.indexOf(cmd)
                  const isSelected = globalIndex === selectedIndex

                  return (
                    <button
                      key={cmd.id}
                      onClick={cmd.action}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition',
                        isSelected
                          ? 'bg-emerald-600/20 text-white'
                          : 'text-gray-300 hover:bg-gray-700/50'
                      )}
                    >
                      {cmd.icon && (
                        <div className={cn('flex-shrink-0', isSelected && 'text-emerald-400')}>
                          {cmd.icon}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{cmd.label}</div>
                        {cmd.description && (
                          <div className="text-xs text-gray-500">{cmd.description}</div>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <kbd className="hidden rounded bg-gray-700 px-2 py-1 text-xs text-gray-400 sm:block">
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-700 px-4 py-2 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="rounded bg-gray-700 px-1.5 py-0.5">↑↓</kbd> для навигации
            </span>
            <span>
              <kbd className="rounded bg-gray-700 px-1.5 py-0.5">Enter</kbd> для выбора
            </span>
          </div>
          <span>
            <kbd className="rounded bg-gray-700 px-1.5 py-0.5">Esc</kbd> закрыть
          </span>
        </div>
      </div>
    </>
  )
}

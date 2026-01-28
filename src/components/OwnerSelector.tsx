'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { User, ChevronDown, Check, X, Search, Loader2, UserX } from 'lucide-react'

export interface OwnerOption {
  id: string
  name: string | null
  email: string | null
  image?: string | null
}

interface OwnerSelectorProps {
  currentOwner: OwnerOption | null
  users: OwnerOption[]
  onSelect: (userId: string | null) => Promise<void>
  disabled?: boolean
  canEdit?: boolean
  compact?: boolean
  placeholder?: string
}

export function OwnerSelector({
  currentOwner,
  users,
  onSelect,
  disabled = false,
  canEdit = true,
  compact = false,
  placeholder = 'Выбрать исполнителя',
}: OwnerSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Вычисление позиции dropdown
  const updateDropdownPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 280),
      })
    }
  }, [])

  // Обновление позиции при открытии и скролле
  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition()
      window.addEventListener('scroll', updateDropdownPosition, true)
      window.addEventListener('resize', updateDropdownPosition)
      return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true)
        window.removeEventListener('resize', updateDropdownPosition)
      }
    }
  }, [isOpen, updateDropdownPosition])

  // Закрытие dropdown при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false)
        setSearch('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Фокус на input при открытии
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [isOpen])

  // Закрытие по Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleSelect = async (userId: string | null) => {
    if (disabled || saving) return
    setSaving(true)
    try {
      await onSelect(userId)
      setIsOpen(false)
      setSearch('')
    } finally {
      setSaving(false)
    }
  }

  const filteredUsers = users.filter((user) => {
    if (!search.trim()) return true
    const query = search.toLowerCase()
    return user.name?.toLowerCase().includes(query) || user.email?.toLowerCase().includes(query)
  })

  if (!canEdit) {
    return (
      <div className="flex items-center gap-2 text-white">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500/20">
          <User className="h-3.5 w-3.5 text-teal-400" />
        </div>
        <span className="text-sm">{currentOwner?.name || currentOwner?.email || placeholder}</span>
      </div>
    )
  }

  const dropdown = isOpen && typeof window !== 'undefined' ? createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        zIndex: 9999,
      }}
      className="overflow-hidden rounded-xl border border-slate-600/50 bg-slate-900 shadow-2xl"
    >
      {/* Поиск */}
      <div className="border-b border-slate-700/50 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Найти пользователя..."
            className="w-full rounded-lg border border-slate-600/50 bg-slate-800/50 py-2 pl-10 pr-3 text-sm text-white placeholder-slate-500 focus:border-teal-500/50 focus:outline-none"
          />
        </div>
      </div>

      {/* Опция "Снять исполнителя" */}
      {currentOwner && (
        <button
          type="button"
          onClick={() => handleSelect(null)}
          disabled={saving}
          className="flex w-full items-center gap-3 border-b border-slate-700/50 px-4 py-2.5 text-left transition hover:bg-red-500/10 disabled:opacity-50"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20">
            <X className="h-4 w-4 text-red-400" />
          </div>
          <span className="text-sm font-medium text-red-400">Снять исполнителя</span>
        </button>
      )}

      {/* Список пользователей */}
      <div className="max-h-56 overflow-auto p-1.5">
        {filteredUsers.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-slate-500">
            {search ? 'Пользователи не найдены' : 'Нет доступных пользователей'}
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isSelected = currentOwner?.id === user.id
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelect(user.id)}
                disabled={saving || isSelected}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                  isSelected
                    ? 'bg-teal-500/20'
                    : 'hover:bg-slate-800/80'
                } disabled:cursor-default`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    isSelected ? 'bg-teal-500/30' : 'bg-slate-700/80'
                  }`}
                >
                  <User
                    className={`h-4 w-4 ${isSelected ? 'text-teal-300' : 'text-slate-400'}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-sm font-medium ${isSelected ? 'text-teal-200' : 'text-white'}`}
                  >
                    {user.name || user.email}
                  </div>
                  {user.name && user.email && (
                    <div className="truncate text-xs text-slate-500">{user.email}</div>
                  )}
                </div>
                {isSelected && <Check className="h-4 w-4 shrink-0 text-teal-400" />}
              </button>
            )
          })
        )}
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`group flex items-center gap-2 rounded-lg transition ${
          compact
            ? 'px-2 py-1.5 text-sm hover:bg-slate-700/50'
            : 'w-full border border-slate-600/50 bg-slate-800/50 px-3 py-2.5 hover:border-slate-500/50 hover:bg-slate-700/50'
        } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${
          isOpen ? 'border-teal-500/50 ring-1 ring-teal-500/30' : ''
        }`}
      >
        {currentOwner ? (
          <>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500/20">
              <User className="h-3.5 w-3.5 text-teal-400" />
            </div>
            <span className="flex-1 truncate text-left text-sm font-medium text-white">
              {currentOwner.name || currentOwner.email}
            </span>
          </>
        ) : (
          <>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700/80">
              <UserX className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <span className="flex-1 truncate text-left text-sm text-slate-400">{placeholder}</span>
          </>
        )}
        {saving ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-teal-400" />
        ) : (
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        )}
      </button>
      {dropdown}
    </>
  )
}

'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
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
  const [mounted, setMounted] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Позиция dropdown вычисляется только при открытии
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })

  // Mount check for portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Вычисление позиции при открытии
  const calculatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 280),
      })
    }
  }, [])

  // Открытие dropdown
  const handleOpen = useCallback(() => {
    if (disabled || !canEdit) return
    calculatePosition()
    setIsOpen(true)
  }, [disabled, canEdit, calculatePosition])

  // Закрытие dropdown
  const handleClose = useCallback(() => {
    setIsOpen(false)
    setSearch('')
  }, [])

  // Toggle
  const handleToggle = useCallback(() => {
    if (isOpen) {
      handleClose()
    } else {
      handleOpen()
    }
  }, [isOpen, handleClose, handleOpen])

  // Закрытие при клике вне
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        handleClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }

    const handleScroll = () => calculatePosition()

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleScroll)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
    }
  }, [isOpen, handleClose, calculatePosition])

  // Фокус на input при открытии
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Выбор пользователя
  const handleSelect = useCallback(async (userId: string | null) => {
    if (disabled || saving) return
    setSaving(true)
    try {
      await onSelect(userId)
      handleClose()
    } catch (error) {
      console.error('Failed to select owner:', error)
    } finally {
      setSaving(false)
    }
  }, [disabled, saving, onSelect, handleClose])

  // Фильтрованные пользователи
  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users
    const query = search.toLowerCase()
    return users.filter(
      (user) =>
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
    )
  }, [users, search])

  // Только для чтения
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

  // Dropdown content
  const dropdownContent = (
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: position.width,
        zIndex: 99999,
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
                  isSelected ? 'bg-teal-500/20' : 'hover:bg-slate-800/80'
                } disabled:cursor-default`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    isSelected ? 'bg-teal-500/30' : 'bg-slate-700/80'
                  }`}
                >
                  <User className={`h-4 w-4 ${isSelected ? 'text-teal-300' : 'text-slate-400'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-sm font-medium ${
                      isSelected ? 'text-teal-200' : 'text-white'
                    }`}
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
    </div>
  )

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
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
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>
      {mounted && isOpen && createPortal(dropdownContent, document.body)}
    </>
  )
}

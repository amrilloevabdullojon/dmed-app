'use client'

import { memo, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search, Clock, FileText, Building2, X, Trash2 } from 'lucide-react'
import { STATUS_LABELS, getWorkingDaysUntilDeadline, pluralizeDays } from '@/lib/utils'
import type { SearchSuggestion } from './letters-types'

interface LettersSearchSuggestionsProps {
  search: string
  suggestions: SearchSuggestion[]
  recentSearches: string[]
  isLoading: boolean
  selectedIndex: number
  onSelectRecent: (value: string) => void
  onClearRecent: () => void
  onRemoveRecent?: (value: string) => void
  onSelectSuggestion?: (suggestion: SearchSuggestion) => void
  onAutoComplete?: (value: string) => void
}

export const LettersSearchSuggestions = memo(function LettersSearchSuggestions({
  search,
  suggestions,
  recentSearches,
  isLoading,
  selectedIndex,
  onSelectRecent,
  onClearRecent,
  onRemoveRecent,
  onSelectSuggestion,
  onAutoComplete,
}: LettersSearchSuggestionsProps) {
  const router = useRouter()
  const listRef = useRef<HTMLDivElement>(null)

  // Прокрутка к выбранному элементу
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`)
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex])

  const renderHighlightedText = useCallback((value: string, query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return value
    const lowerValue = value.toLowerCase()
    const lowerQuery = trimmed.toLowerCase()
    const index = lowerValue.indexOf(lowerQuery)
    if (index === -1) return value
    const before = value.slice(0, index)
    const match = value.slice(index, index + trimmed.length)
    const after = value.slice(index + trimmed.length)
    return (
      <>
        {before}
        <span className="font-semibold text-teal-300">{match}</span>
        {after}
      </>
    )
  }, [])

  const trimmedSearch = search.trim()

  // Генерация autocomplete подсказок на основе найденных писем
  const autocompleteSuggestions = trimmedSearch
    ? Array.from(
        new Set(
          suggestions
            .flatMap((s) => [s.org, s.number])
            .filter(
              (text) =>
                text.toLowerCase().includes(trimmedSearch.toLowerCase()) &&
                text.toLowerCase() !== trimmedSearch.toLowerCase()
            )
        )
      ).slice(0, 3)
    : []

  const totalItems = trimmedSearch
    ? autocompleteSuggestions.length + suggestions.length
    : recentSearches.length

  return (
    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[100] overflow-hidden rounded-xl border border-slate-600/50 bg-slate-900 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/50 bg-slate-800/50 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
          {trimmedSearch ? (
            <>
              <Search className="h-3.5 w-3.5 text-teal-400" />
              <span>Результаты для &quot;{trimmedSearch}&quot;</span>
            </>
          ) : (
            <>
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>Последние поиски</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-teal-400" />}
          {!trimmedSearch && recentSearches.length > 0 && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                onClearRecent()
              }}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-700/50 hover:text-red-400"
              title="Очистить всю историю"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Очистить</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div ref={listRef} className="max-h-72 overflow-auto">
        {!trimmedSearch ? (
          // Последние поиски
          recentSearches.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800">
                <Search className="h-6 w-6 text-slate-600" />
              </div>
              <div className="text-sm font-medium text-slate-400">Пока нет истории поиска</div>
              <div className="mt-1 text-xs text-slate-600">
                Начните вводить номер, организацию или содержание
              </div>
            </div>
          ) : (
            <div className="p-2">
              {recentSearches.map((item, index) => (
                <div
                  key={item}
                  data-index={index}
                  className={`group flex items-center gap-2 rounded-lg transition ${
                    selectedIndex === index
                      ? 'bg-teal-500/20'
                      : 'hover:bg-slate-800/80'
                  }`}
                >
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      onSelectRecent(item)
                    }}
                    className="flex flex-1 items-center gap-3 px-3 py-2.5 text-left"
                  >
                    <Clock className={`h-4 w-4 shrink-0 ${selectedIndex === index ? 'text-teal-400' : 'text-slate-500'}`} />
                    <span className={`truncate text-sm ${selectedIndex === index ? 'text-white' : 'text-slate-300'}`}>
                      {item}
                    </span>
                  </button>
                  {onRemoveRecent && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onRemoveRecent(item)
                      }}
                      className="mr-2 rounded p-1.5 text-slate-600 opacity-0 transition hover:bg-slate-700 hover:text-red-400 group-hover:opacity-100"
                      title="Удалить из истории"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        ) : suggestions.length === 0 && !isLoading ? (
          // Ничего не найдено
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800">
              <FileText className="h-6 w-6 text-slate-600" />
            </div>
            <div className="text-sm font-medium text-slate-400">Ничего не найдено</div>
            <div className="mt-2 text-xs text-slate-600">
              Попробуйте изменить запрос
            </div>
          </div>
        ) : (
          <div className="p-2">
            {/* Autocomplete подсказки */}
            {autocompleteSuggestions.length > 0 && (
              <div className="mb-2 border-b border-slate-700/50 pb-2">
                <div className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Автодополнение
                </div>
                {autocompleteSuggestions.map((text, index) => (
                  <button
                    key={text}
                    type="button"
                    data-index={index}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      onAutoComplete?.(text)
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                      selectedIndex === index
                        ? 'bg-teal-500/20 text-white'
                        : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                    }`}
                  >
                    <Search className={`h-4 w-4 shrink-0 ${selectedIndex === index ? 'text-teal-400' : ''}`} />
                    <span className="flex-1 truncate text-sm">{renderHighlightedText(text, search)}</span>
                    <kbd className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] text-slate-500">Tab</kbd>
                  </button>
                ))}
              </div>
            )}

            {/* Результаты писем */}
            {suggestions.length > 0 && (
              <>
                <div className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Письма ({suggestions.length})
                </div>
                {suggestions.map((item, index) => {
                  const actualIndex = autocompleteSuggestions.length + index
                  const daysLeft = getWorkingDaysUntilDeadline(item.deadlineDate)
                  const isSelected = selectedIndex === actualIndex
                  const tone =
                    daysLeft < 0
                      ? 'text-red-400'
                      : daysLeft <= 2
                        ? 'text-yellow-400'
                        : 'text-emerald-400'

                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-index={actualIndex}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        if (onSelectSuggestion) {
                          onSelectSuggestion(item)
                        } else {
                          router.push(`/letters/${item.id}`)
                        }
                      }}
                      className={`group flex w-full flex-col gap-1.5 rounded-lg px-3 py-3 text-left transition ${
                        isSelected ? 'bg-teal-500/20' : 'hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`rounded bg-slate-800 px-2 py-0.5 font-mono text-sm ${isSelected ? 'text-teal-300' : 'text-teal-400'}`}>
                            #{item.number}
                          </span>
                          <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${isSelected ? 'bg-slate-700' : 'bg-slate-800/60'} text-slate-400`}>
                            {STATUS_LABELS[item.status]}
                          </span>
                        </div>
                        <span className={`text-xs font-medium ${tone}`}>
                          {daysLeft >= 0 ? `${daysLeft} раб. ${pluralizeDays(daysLeft)}` : 'Просрочено'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                        <span className={`truncate text-xs ${isSelected ? 'text-slate-200' : 'text-slate-400'}`}>
                          {renderHighlightedText(item.org, search)}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {totalItems > 0 && (
        <div className="flex items-center justify-between border-t border-slate-700/50 bg-slate-800/30 px-4 py-2">
          <div className="flex items-center gap-4 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-slate-700/80 px-1.5 py-0.5 font-mono">↑↓</kbd>
              <span className="hidden sm:inline">навигация</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-slate-700/80 px-1.5 py-0.5 font-mono">Enter</kbd>
              <span className="hidden sm:inline">выбрать</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-slate-700/80 px-1.5 py-0.5 font-mono">Esc</kbd>
              <span className="hidden sm:inline">закрыть</span>
            </span>
          </div>
          {trimmedSearch && suggestions.length > 0 && (
            <span className="text-[10px] text-slate-600">
              {suggestions.length} {suggestions.length === 1 ? 'результат' : 'результатов'}
            </span>
          )}
        </div>
      )}
    </div>
  )
})

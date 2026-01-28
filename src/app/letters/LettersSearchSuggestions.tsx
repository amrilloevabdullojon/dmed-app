'use client'

import { memo, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search, Clock, FileText, Building2 } from 'lucide-react'
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
    <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/98 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {trimmedSearch ? (
            <>
              <Search className="h-3.5 w-3.5" />
              <span>Результаты для &quot;{trimmedSearch}&quot;</span>
            </>
          ) : (
            <>
              <Clock className="h-3.5 w-3.5" />
              <span>Последние поиски</span>
            </>
          )}
        </div>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-teal-400" />}
      </div>

      <div ref={listRef} className="max-h-64 overflow-auto">
        {!trimmedSearch ? (
          // Последние поиски
          recentSearches.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
              <Search className="mb-2 h-8 w-8 text-slate-600" />
              <div className="text-sm text-slate-500">Пока нет истории поиска</div>
              <div className="mt-1 text-xs text-slate-600">
                Начните вводить номер, организацию или содержание
              </div>
            </div>
          ) : (
            <div className="p-2">
              {recentSearches.map((item, index) => (
                <button
                  key={item}
                  type="button"
                  data-index={index}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onSelectRecent(item)
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                    selectedIndex === index
                      ? 'bg-teal-500/20 text-white'
                      : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <Clock className="h-4 w-4 shrink-0 text-slate-500" />
                  <span className="truncate text-sm">{item}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-600">
                    Enter
                  </span>
                </button>
              ))}
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault()
                  onClearRecent()
                }}
                className="mt-2 w-full rounded-lg px-3 py-2 text-center text-xs text-slate-500 transition hover:bg-slate-800/40 hover:text-slate-300"
              >
                Очистить историю
              </button>
            </div>
          )
        ) : suggestions.length === 0 && !isLoading ? (
          // Ничего не найдено
          <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
            <FileText className="mb-2 h-8 w-8 text-slate-600" />
            <div className="text-sm text-slate-400">Ничего не найдено</div>
            <div className="mt-2 text-xs text-slate-600">
              Попробуйте изменить запрос или использовать:
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <span className="rounded-md bg-slate-800/60 px-2 py-1 text-xs text-slate-400">
                номер письма
              </span>
              <span className="rounded-md bg-slate-800/60 px-2 py-1 text-xs text-slate-400">
                организация
              </span>
              <span className="rounded-md bg-slate-800/60 px-2 py-1 text-xs text-slate-400">
                Jira ссылка
              </span>
            </div>
          </div>
        ) : (
          <div className="p-2">
            {/* Autocomplete подсказки */}
            {autocompleteSuggestions.length > 0 && (
              <div className="mb-2 border-b border-slate-700/50 pb-2">
                <div className="mb-1.5 px-2 text-[10px] uppercase tracking-wider text-slate-500">
                  Автодополнение
                </div>
                {autocompleteSuggestions.map((text, index) => (
                  <button
                    key={text}
                    type="button"
                    data-index={index}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      onAutoComplete?.(text)
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                      selectedIndex === index
                        ? 'bg-teal-500/20 text-white'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <Search className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-sm">{renderHighlightedText(text, search)}</span>
                    <span className="ml-auto text-[10px] text-slate-600">Tab</span>
                  </button>
                ))}
              </div>
            )}

            {/* Результаты писем */}
            {suggestions.length > 0 && (
              <>
                <div className="mb-1.5 px-2 text-[10px] uppercase tracking-wider text-slate-500">
                  Письма ({suggestions.length})
                </div>
                {suggestions.map((item, index) => {
                  const actualIndex = autocompleteSuggestions.length + index
                  const daysLeft = getWorkingDaysUntilDeadline(item.deadlineDate)
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
                      onMouseDown={(event) => {
                        event.preventDefault()
                        if (onSelectSuggestion) {
                          onSelectSuggestion(item)
                        } else {
                          router.push(`/letters/${item.id}`)
                        }
                      }}
                      className={`group flex w-full flex-col gap-1.5 rounded-lg px-3 py-2.5 text-left transition ${
                        selectedIndex === actualIndex ? 'bg-teal-500/20' : 'hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-sm ${selectedIndex === actualIndex ? 'text-teal-300' : 'text-teal-400'}`}
                          >
                            №{item.number}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] ${
                              selectedIndex === actualIndex ? 'bg-slate-700/80' : 'bg-slate-800/60'
                            } text-slate-400`}
                          >
                            {STATUS_LABELS[item.status]}
                          </span>
                        </div>
                        <span className={`text-xs ${tone}`}>
                          {daysLeft >= 0
                            ? `${daysLeft} раб. ${pluralizeDays(daysLeft)}`
                            : 'Просрочено'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                        <span
                          className={`truncate text-xs ${selectedIndex === actualIndex ? 'text-slate-200' : 'text-slate-400'}`}
                        >
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

      {/* Footer с подсказками по навигации */}
      {totalItems > 0 && (
        <div className="flex items-center justify-between border-t border-slate-700/50 bg-slate-800/30 px-4 py-2 text-[10px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded bg-slate-700/60 px-1.5 py-0.5 font-mono">↑↓</kbd> навигация
            </span>
            <span>
              <kbd className="rounded bg-slate-700/60 px-1.5 py-0.5 font-mono">Enter</kbd> выбрать
            </span>
            <span>
              <kbd className="rounded bg-slate-700/60 px-1.5 py-0.5 font-mono">Esc</kbd> закрыть
            </span>
          </div>
          {trimmedSearch && suggestions.length > 0 && (
            <span className="text-slate-600">
              {suggestions.length} {suggestions.length === 1 ? 'результат' : 'результатов'}
            </span>
          )}
        </div>
      )}
    </div>
  )
})

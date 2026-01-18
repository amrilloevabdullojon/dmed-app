import { useState, useCallback } from 'react'
import type { LetterStatus } from '@/types/prisma'

export type SearchFilters = {
  query: string
  status: LetterStatus[]
  ownerId: string
  org: string
  type: string
  tags: string[]
  dateFrom: string
  dateTo: string
  deadlineFrom: string
  deadlineTo: string
  priorityMin: number
  priorityMax: number
  overdue: boolean
  dueToday: boolean
  dueThisWeek: boolean
  hasAnswer: boolean | null
  hasJiraLink: boolean | null
  favorite: boolean
  watching: boolean
}

export type SearchResult = {
  letters: any[]
  total: number
  page: number
  limit: number
  pages: number
  hasMore: boolean
}

export function useLetterSearch() {
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(
    async (
      filters: Partial<SearchFilters>,
      page = 1,
      limit = 50,
      sortBy = 'deadlineDate',
      sortOrder: 'asc' | 'desc' = 'asc'
    ) => {
      try {
        setLoading(true)
        setError(null)

        // Строим query параметры
        const params = new URLSearchParams()

        if (filters.query) params.append('q', filters.query)
        if (filters.status && filters.status.length > 0) {
          params.append('status', filters.status.join(','))
        }
        if (filters.ownerId) params.append('ownerId', filters.ownerId)
        if (filters.org) params.append('org', filters.org)
        if (filters.type) params.append('type', filters.type)
        if (filters.tags && filters.tags.length > 0) {
          params.append('tags', filters.tags.join(','))
        }
        if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
        if (filters.dateTo) params.append('dateTo', filters.dateTo)
        if (filters.deadlineFrom) params.append('deadlineFrom', filters.deadlineFrom)
        if (filters.deadlineTo) params.append('deadlineTo', filters.deadlineTo)
        if (filters.priorityMin !== undefined) {
          params.append('priorityMin', filters.priorityMin.toString())
        }
        if (filters.priorityMax !== undefined) {
          params.append('priorityMax', filters.priorityMax.toString())
        }
        if (filters.overdue) params.append('overdue', 'true')
        if (filters.dueToday) params.append('dueToday', 'true')
        if (filters.dueThisWeek) params.append('dueThisWeek', 'true')
        if (filters.hasAnswer !== null && filters.hasAnswer !== undefined) {
          params.append('hasAnswer', filters.hasAnswer.toString())
        }
        if (filters.hasJiraLink !== null && filters.hasJiraLink !== undefined) {
          params.append('hasJiraLink', filters.hasJiraLink.toString())
        }
        if (filters.favorite) params.append('favorite', 'true')
        if (filters.watching) params.append('watching', 'true')

        params.append('page', page.toString())
        params.append('limit', limit.toString())
        params.append('sortBy', sortBy)
        params.append('sortOrder', sortOrder)

        const res = await fetch(`/api/letters/search?${params.toString()}`)

        if (!res.ok) {
          throw new Error('Ошибка поиска')
        }

        const data = await res.json()
        setResults(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
        setResults(null)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const quickSearch = useCallback(async (query: string, limit = 10) => {
    try {
      const params = new URLSearchParams({
        q: query,
        quick: 'true',
        limit: limit.toString(),
      })

      const res = await fetch(`/api/letters/search?${params.toString()}`)

      if (!res.ok) {
        throw new Error('Ошибка быстрого поиска')
      }

      const data = await res.json()
      return data.results || []
    } catch (err) {
      console.error('Quick search error:', err)
      return []
    }
  }, [])

  const exportResults = useCallback(async (filters: Partial<SearchFilters>) => {
    try {
      // Для экспорта нужно получить все результаты без пагинации
      const params = new URLSearchParams()

      if (filters.query) params.append('q', filters.query)
      if (filters.status && filters.status.length > 0) {
        params.append('status', filters.status.join(','))
      }
      // ... добавить остальные фильтры

      params.append('limit', '1000') // Максимум для экспорта

      const res = await fetch(`/api/letters/search?${params.toString()}`)

      if (!res.ok) {
        throw new Error('Ошибка экспорта')
      }

      const data = await res.json()

      // Формируем CSV
      const headers = ['Номер', 'Организация', 'Дата', 'Дедлайн', 'Статус', 'Ответственный']
      const rows = data.letters.map((letter: any) => [
        letter.number,
        letter.org,
        new Date(letter.date).toLocaleDateString('ru-RU'),
        new Date(letter.deadlineDate).toLocaleDateString('ru-RU'),
        letter.status,
        letter.owner?.name || '',
      ])

      const csv =
        [headers, ...rows].map((row) => row.map((cell: string) => `"${cell}"`).join(',')).join('\n')

      // Скачиваем файл
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `letters_${new Date().toISOString().split('T')[0]}.csv`
      link.click()
    } catch (err) {
      console.error('Export error:', err)
      alert('Ошибка экспорта')
    }
  }, [])

  return {
    results,
    loading,
    error,
    search,
    quickSearch,
    exportResults,
  }
}



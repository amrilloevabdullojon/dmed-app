import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { LetterStatus } from '@/types/prisma'
import { toast } from '@/lib/toast'

/**
 * Типы для писем
 */
export interface Letter {
  id: string
  number: string
  org: string
  date: string
  deadlineDate: string
  status: LetterStatus
  type: string | null
  content: string | null
  answer: string | null
  priority: number
  owner: {
    id: string
    name: string | null
    email: string | null
  } | null
}

export interface LetterFilters {
  query?: string
  status?: LetterStatus | LetterStatus[]
  ownerId?: string
  org?: string
  overdue?: boolean
  dueToday?: boolean
  urgent?: boolean
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface LettersResponse {
  letters: Letter[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

/**
 * Query keys для кэширования
 */
export const letterKeys = {
  all: ['letters'] as const,
  lists: () => [...letterKeys.all, 'list'] as const,
  list: (filters: LetterFilters) => [...letterKeys.lists(), filters] as const,
  details: () => [...letterKeys.all, 'detail'] as const,
  detail: (id: string) => [...letterKeys.details(), id] as const,
  stats: () => [...letterKeys.all, 'stats'] as const,
}

/**
 * Hook для получения списка писем с кэшированием
 */
export function useLetters(filters: LetterFilters = {}) {
  return useQuery({
    queryKey: letterKeys.list(filters),
    queryFn: async (): Promise<LettersResponse> => {
      const params = new URLSearchParams()

      if (filters.query) params.set('query', filters.query)
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          params.set('status', filters.status.join(','))
        } else {
          params.set('status', filters.status)
        }
      }
      if (filters.ownerId) params.set('ownerId', filters.ownerId)
      if (filters.org) params.set('org', filters.org)
      if (filters.overdue) params.set('overdue', 'true')
      if (filters.dueToday) params.set('dueToday', 'true')
      if (filters.urgent) params.set('urgent', 'true')
      if (filters.page) params.set('page', String(filters.page))
      if (filters.limit) params.set('limit', String(filters.limit))
      if (filters.sortBy) params.set('sortBy', filters.sortBy)
      if (filters.sortOrder) params.set('sortOrder', filters.sortOrder)

      const res = await fetch(`/api/letters?${params}`)
      if (!res.ok) {
        throw new Error('Failed to fetch letters')
      }
      return res.json()
    },
    staleTime: 30000, // 30 секунд
    gcTime: 5 * 60 * 1000, // 5 минут (ранее cacheTime)
  })
}

/**
 * Hook для получения одного письма
 */
export function useLetter(id: string | null) {
  return useQuery({
    queryKey: letterKeys.detail(id || ''),
    queryFn: async (): Promise<Letter> => {
      if (!id) throw new Error('Letter ID is required')

      const res = await fetch(`/api/letters/${id}`)
      if (!res.ok) {
        throw new Error('Failed to fetch letter')
      }
      return res.json()
    },
    enabled: !!id, // Запускать только если есть ID
    staleTime: 60000, // 1 минута
  })
}

/**
 * Hook для обновления письма с optimistic updates
 */
export function useUpdateLetter() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: Partial<Letter>
    }): Promise<Letter> => {
      const res = await fetch(`/api/letters/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to update letter')
      }

      return res.json()
    },
    // Optimistic update
    onMutate: async ({ id, data }) => {
      // Отменяем текущие запросы
      await queryClient.cancelQueries({ queryKey: letterKeys.detail(id) })

      // Сохраняем предыдущее состояние
      const previousLetter = queryClient.getQueryData(letterKeys.detail(id))

      // Оптимистично обновляем
      queryClient.setQueryData(letterKeys.detail(id), (old: any) => ({
        ...old,
        ...data,
      }))

      return { previousLetter }
    },
    // Если ошибка - откатываем
    onError: (err, { id }, context) => {
      if (context?.previousLetter) {
        queryClient.setQueryData(letterKeys.detail(id), context.previousLetter)
      }
      toast.error('Ошибка обновления', err.message)
    },
    // После успеха - инвалидируем связанные запросы
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: letterKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: letterKeys.lists() })
      queryClient.invalidateQueries({ queryKey: letterKeys.stats() })
      toast.success('Письмо обновлено')
    },
  })
}

/**
 * Hook для удаления письма
 */
export function useDeleteLetter() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await fetch(`/api/letters/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to delete letter')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: letterKeys.lists() })
      queryClient.invalidateQueries({ queryKey: letterKeys.stats() })
      toast.success('Письмо удалено')
    },
    onError: (err: Error) => {
      toast.error('Ошибка удаления', err.message)
    },
  })
}

/**
 * Hook для создания письма
 */
export function useCreateLetter() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<Letter>): Promise<Letter> => {
      const res = await fetch('/api/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to create letter')
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: letterKeys.lists() })
      queryClient.invalidateQueries({ queryKey: letterKeys.stats() })
      toast.success('Письмо создано')
    },
    onError: (err: Error) => {
      toast.error('Ошибка создания', err.message)
    },
  })
}



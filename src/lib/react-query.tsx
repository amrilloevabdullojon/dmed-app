'use client'

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, ReactNode } from 'react'
import { fetchWithRetry, FetchError } from './fetch-utils'

/**
 * Default query client options
 */
const defaultQueryClientOptions = {
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
      retry: 2,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
}

/**
 * React Query Provider with DevTools
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient(defaultQueryClientOptions))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}

// Re-export hooks for convenience
export { useQuery, useMutation, useQueryClient }

/**
 * Query keys factory
 */
export const queryKeys = {
  // Letters
  letters: {
    all: ['letters'] as const,
    lists: () => [...queryKeys.letters.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.letters.lists(), filters] as const,
    details: () => [...queryKeys.letters.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.letters.details(), id] as const,
    stats: () => [...queryKeys.letters.all, 'stats'] as const,
  },

  // Users
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
    current: () => [...queryKeys.users.all, 'current'] as const,
  },

  // Comments
  comments: {
    all: ['comments'] as const,
    byLetter: (letterId: string) => [...queryKeys.comments.all, letterId] as const,
  },

  // Templates
  templates: {
    all: ['templates'] as const,
    lists: () => [...queryKeys.templates.all, 'list'] as const,
  },

  // Notifications
  notifications: {
    all: ['notifications'] as const,
    unread: () => [...queryKeys.notifications.all, 'unread'] as const,
  },
}

/**
 * Generic fetcher for React Query
 */
export async function queryFetcher<T>(url: string): Promise<T> {
  return fetchWithRetry<T>(url, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

/**
 * Hook for fetching letters with filters
 */
export function useLetters(filters: Record<string, unknown> = {}) {
  const searchParams = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  })

  return useQuery({
    queryKey: queryKeys.letters.list(filters),
    queryFn: () =>
      queryFetcher<{ letters: unknown[]; total: number }>(`/api/letters?${searchParams}`),
  })
}

/**
 * Hook for fetching single letter
 */
export function useLetter(id: string | null) {
  return useQuery({
    queryKey: queryKeys.letters.detail(id || ''),
    queryFn: () => queryFetcher<{ letter: unknown }>(`/api/letters/${id}`),
    enabled: !!id,
  })
}

/**
 * Hook for fetching letter stats
 */
export function useLetterStats() {
  return useQuery({
    queryKey: queryKeys.letters.stats(),
    queryFn: () => queryFetcher<{ stats: unknown }>('/api/stats'),
    staleTime: 60 * 1000, // 1 minute
  })
}

/**
 * Hook for letter mutations
 */
export function useLetterMutation() {
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: async (data: unknown) => {
      return fetchWithRetry('/api/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.letters.all })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: unknown }) => {
      return fetchWithRetry(`/api/letters/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.letters.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.letters.lists() })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return fetchWithRetry(`/api/letters/${id}`, {
        method: 'DELETE',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.letters.all })
    },
  })

  return {
    create: createMutation,
    update: updateMutation,
    delete: deleteMutation,
  }
}

/**
 * Hook for fetching users
 */
export function useUsers(filters: Record<string, unknown> = {}) {
  const searchParams = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  })

  return useQuery({
    queryKey: queryKeys.users.list(filters),
    queryFn: () => queryFetcher<{ users: unknown[] }>(`/api/users?${searchParams}`),
  })
}

/**
 * Hook for current user
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.users.current(),
    queryFn: () => queryFetcher<{ user: unknown }>('/api/users/me'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook for bulk creating letters
 */
export interface BulkCreateLetterInput {
  number: string
  org: string
  date: string
  deadlineDate?: string
  type?: string
  content?: string
  priority?: number
}

export interface BulkCreateResult {
  success: boolean
  created: number
  skipped: number
  skippedNumbers: string[]
  letters: unknown[]
}

export function useBulkCreateLetters() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      letters,
      skipDuplicates = false,
    }: {
      letters: BulkCreateLetterInput[]
      skipDuplicates?: boolean
    }): Promise<BulkCreateResult> => {
      return fetchWithRetry('/api/letters/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ letters, skipDuplicates }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.letters.all })
    },
  })
}

/**
 * Prefetch helpers
 */
export function usePrefetch() {
  const queryClient = useQueryClient()

  return {
    prefetchLetter: (id: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.letters.detail(id),
        queryFn: () => queryFetcher(`/api/letters/${id}`),
      })
    },
    prefetchLetters: (filters: Record<string, unknown> = {}) => {
      const searchParams = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.set(key, String(value))
        }
      })
      queryClient.prefetchQuery({
        queryKey: queryKeys.letters.list(filters),
        queryFn: () => queryFetcher(`/api/letters?${searchParams}`),
      })
    },
  }
}

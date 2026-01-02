'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchWithRetry, FetchError } from '@/lib/fetch-utils'

/**
 * State for useFetch hook
 */
interface FetchState<T> {
  data: T | null
  error: FetchError | null
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
}

/**
 * Options for useFetch hook
 */
interface UseFetchOptions<T> extends RequestInit {
  /** Skip initial fetch (useful for conditional fetching) */
  skip?: boolean

  /** Transform response data */
  transform?: (data: unknown) => T

  /** Initial data value */
  initialData?: T

  /** Maximum retry attempts */
  maxRetries?: number

  /** Request timeout in ms */
  timeout?: number

  /** Callback on success */
  onSuccess?: (data: T) => void

  /** Callback on error */
  onError?: (error: FetchError) => void

  /** Refetch interval in ms */
  refetchInterval?: number

  /** Refetch on window focus */
  refetchOnFocus?: boolean
}

/**
 * Hook for fetching data with automatic retry, caching, and state management.
 *
 * @example
 * ```tsx
 * function UserProfile({ userId }: { userId: string }) {
 *   const { data, isLoading, error, refetch } = useFetch<User>(
 *     `/api/users/${userId}`,
 *     { refetchOnFocus: true }
 *   )
 *
 *   if (isLoading) return <Spinner />
 *   if (error) return <Error message={error.message} />
 *   if (!data) return null
 *
 *   return <Profile user={data} />
 * }
 * ```
 */
export function useFetch<T = unknown>(
  url: string | null,
  options: UseFetchOptions<T> = {}
): FetchState<T> & {
  refetch: () => Promise<void>
  mutate: (data: T | ((prev: T | null) => T)) => void
} {
  const {
    skip = false,
    transform,
    initialData = null,
    maxRetries = 3,
    timeout = 30000,
    onSuccess,
    onError,
    refetchInterval,
    refetchOnFocus = false,
    ...fetchOptions
  } = options

  const [state, setState] = useState<FetchState<T>>({
    data: initialData,
    error: null,
    isLoading: !skip && url !== null,
    isError: false,
    isSuccess: false,
  })

  const abortControllerRef = useRef<AbortController | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)

  const fetchData = useCallback(async () => {
    if (!url || skip) return

    // Abort previous request
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()

    setState((prev) => ({ ...prev, isLoading: true, isError: false }))

    try {
      const result = await fetchWithRetry<T>(url, {
        ...fetchOptions,
        signal: abortControllerRef.current.signal,
        maxRetries,
        timeout,
      })

      if (!isMountedRef.current) return

      const data = transform ? transform(result) : result

      setState({
        data,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
      })

      onSuccess?.(data)
    } catch (error) {
      if (!isMountedRef.current) return

      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      const fetchError =
        error instanceof FetchError
          ? error
          : new FetchError(error instanceof Error ? error.message : 'Unknown error')

      setState((prev) => ({
        ...prev,
        error: fetchError,
        isLoading: false,
        isError: true,
        isSuccess: false,
      }))

      onError?.(fetchError)
    }
  }, [url, skip, fetchOptions, maxRetries, timeout, transform, onSuccess, onError])

  // Initial fetch
  useEffect(() => {
    fetchData()

    return () => {
      abortControllerRef.current?.abort()
    }
  }, [fetchData])

  // Refetch interval
  useEffect(() => {
    if (refetchInterval && !skip && url) {
      intervalRef.current = setInterval(fetchData, refetchInterval)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [refetchInterval, skip, url, fetchData])

  // Refetch on focus
  useEffect(() => {
    if (!refetchOnFocus || skip || !url) return

    const handleFocus = () => {
      fetchData()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [refetchOnFocus, skip, url, fetchData])

  // Cleanup
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const mutate = useCallback((dataOrFn: T | ((prev: T | null) => T)) => {
    setState((prev) => ({
      ...prev,
      data:
        typeof dataOrFn === 'function' ? (dataOrFn as (prev: T | null) => T)(prev.data) : dataOrFn,
    }))
  }, [])

  return {
    ...state,
    refetch: fetchData,
    mutate,
  }
}

/**
 * Hook for mutations (POST, PUT, PATCH, DELETE) with retry support.
 *
 * @example
 * ```tsx
 * function CreateUserForm() {
 *   const { mutate, isLoading, error } = useMutation<User>('/api/users', {
 *     method: 'POST',
 *     onSuccess: (user) => toast.success(`User ${user.name} created!`)
 *   })
 *
 *   const handleSubmit = async (data: CreateUserInput) => {
 *     await mutate(data)
 *   }
 *
 *   return <Form onSubmit={handleSubmit} disabled={isLoading} />
 * }
 * ```
 */
export function useMutation<TResponse = unknown, TInput = unknown>(
  url: string,
  options: Omit<UseFetchOptions<TResponse>, 'skip' | 'refetchInterval' | 'refetchOnFocus'> & {
    method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  } = {}
): {
  mutate: (data?: TInput) => Promise<TResponse | null>
  data: TResponse | null
  error: FetchError | null
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
  reset: () => void
} {
  const {
    method = 'POST',
    transform,
    maxRetries = 3,
    timeout = 30000,
    onSuccess,
    onError,
    ...fetchOptions
  } = options

  const [state, setState] = useState<FetchState<TResponse>>({
    data: null,
    error: null,
    isLoading: false,
    isError: false,
    isSuccess: false,
  })

  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const mutate = useCallback(
    async (data?: TInput): Promise<TResponse | null> => {
      setState((prev) => ({ ...prev, isLoading: true, isError: false }))

      try {
        const result = await fetchWithRetry<TResponse>(url, {
          ...fetchOptions,
          method,
          body: data ? JSON.stringify(data) : undefined,
          headers: {
            'Content-Type': 'application/json',
            ...fetchOptions.headers,
          },
          maxRetries,
          timeout,
        })

        if (!isMountedRef.current) return null

        const transformedData = transform ? transform(result) : result

        setState({
          data: transformedData,
          error: null,
          isLoading: false,
          isError: false,
          isSuccess: true,
        })

        onSuccess?.(transformedData)
        return transformedData
      } catch (error) {
        if (!isMountedRef.current) return null

        const fetchError =
          error instanceof FetchError
            ? error
            : new FetchError(error instanceof Error ? error.message : 'Unknown error')

        setState((prev) => ({
          ...prev,
          error: fetchError,
          isLoading: false,
          isError: true,
          isSuccess: false,
        }))

        onError?.(fetchError)
        return null
      }
    },
    [url, method, fetchOptions, maxRetries, timeout, transform, onSuccess, onError]
  )

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isLoading: false,
      isError: false,
      isSuccess: false,
    })
  }, [])

  return {
    ...state,
    mutate,
    reset,
  }
}

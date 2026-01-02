/**
 * Utility functions for making fetch requests with retry, timeout, and error handling.
 */

/**
 * Options for fetch with retry
 */
interface FetchWithRetryOptions extends RequestInit {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number

  /** Base delay between retries in ms (default: 1000) */
  retryDelay?: number

  /** Whether to use exponential backoff (default: true) */
  exponentialBackoff?: boolean

  /** Request timeout in ms (default: 30000) */
  timeout?: number

  /** HTTP status codes that should trigger a retry (default: [408, 429, 500, 502, 503, 504]) */
  retryableStatuses?: number[]

  /** Callback called before each retry */
  onRetry?: (attempt: number, error: Error) => void
}

/**
 * Error class for fetch errors with additional context
 */
export class FetchError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly statusText?: string,
    public readonly response?: Response,
    public readonly isTimeout?: boolean,
    public readonly isNetworkError?: boolean
  ) {
    super(message)
    this.name = 'FetchError'
  }
}

/**
 * Default retryable HTTP status codes
 */
const DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504]

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calculate delay for a given retry attempt
 */
function calculateDelay(attempt: number, baseDelay: number, exponentialBackoff: boolean): number {
  if (!exponentialBackoff) {
    return baseDelay
  }
  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1)
  const jitter = Math.random() * 0.3 * exponentialDelay // 0-30% jitter
  return Math.min(exponentialDelay + jitter, 30000) // Cap at 30 seconds
}

/**
 * Create an AbortController with timeout
 */
function createTimeoutController(timeout: number): {
  controller: AbortController
  timeoutId: NodeJS.Timeout
} {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  return { controller, timeoutId }
}

/**
 * Fetch with automatic retry on failure.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const data = await fetchWithRetry('/api/users')
 *
 * // With options
 * const data = await fetchWithRetry('/api/users', {
 *   method: 'POST',
 *   body: JSON.stringify({ name: 'John' }),
 *   maxRetries: 5,
 *   timeout: 10000,
 *   onRetry: (attempt, error) => console.log(`Retry ${attempt}: ${error.message}`)
 * })
 * ```
 */
export async function fetchWithRetry<T = unknown>(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    exponentialBackoff = true,
    timeout = 30000,
    retryableStatuses = DEFAULT_RETRYABLE_STATUSES,
    onRetry,
    ...fetchOptions
  } = options

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const { controller, timeoutId } = createTimeoutController(timeout)

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const shouldRetry = attempt <= maxRetries && retryableStatuses.includes(response.status)

        if (shouldRetry) {
          const error = new FetchError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            response.statusText,
            response
          )
          lastError = error
          onRetry?.(attempt, error)

          const delay = calculateDelay(attempt, retryDelay, exponentialBackoff)
          await sleep(delay)
          continue
        }

        throw new FetchError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          response.statusText,
          response
        )
      }

      // Try to parse as JSON, fallback to text
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        return (await response.json()) as T
      }
      return (await response.text()) as unknown as T
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof FetchError) {
        throw error
      }

      const isAbortError = error instanceof Error && error.name === 'AbortError'
      const isNetworkError = error instanceof TypeError && error.message.includes('fetch')

      if (isAbortError) {
        throw new FetchError('Request timeout', undefined, undefined, undefined, true)
      }

      if (attempt <= maxRetries && (isNetworkError || isAbortError)) {
        lastError = error instanceof Error ? error : new Error(String(error))
        onRetry?.(attempt, lastError)

        const delay = calculateDelay(attempt, retryDelay, exponentialBackoff)
        await sleep(delay)
        continue
      }

      if (isNetworkError) {
        throw new FetchError('Network error', undefined, undefined, undefined, false, true)
      }

      throw error
    }
  }

  throw lastError || new FetchError('Max retries exceeded')
}

/**
 * Typed fetch helper for JSON APIs.
 *
 * @example
 * ```typescript
 * interface User {
 *   id: string
 *   name: string
 * }
 *
 * const user = await fetchJSON<User>('/api/users/123')
 * ```
 */
export async function fetchJSON<T>(url: string, options: FetchWithRetryOptions = {}): Promise<T> {
  return fetchWithRetry<T>(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  })
}

/**
 * POST helper with automatic JSON serialization.
 *
 * @example
 * ```typescript
 * const result = await postJSON('/api/users', { name: 'John' })
 * ```
 */
export async function postJSON<T, D = unknown>(
  url: string,
  data: D,
  options: FetchWithRetryOptions = {}
): Promise<T> {
  return fetchJSON<T>(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * PUT helper with automatic JSON serialization.
 */
export async function putJSON<T, D = unknown>(
  url: string,
  data: D,
  options: FetchWithRetryOptions = {}
): Promise<T> {
  return fetchJSON<T>(url, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/**
 * PATCH helper with automatic JSON serialization.
 */
export async function patchJSON<T, D = unknown>(
  url: string,
  data: D,
  options: FetchWithRetryOptions = {}
): Promise<T> {
  return fetchJSON<T>(url, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

/**
 * DELETE helper.
 */
export async function deleteJSON<T>(url: string, options: FetchWithRetryOptions = {}): Promise<T> {
  return fetchJSON<T>(url, {
    ...options,
    method: 'DELETE',
  })
}

/**
 * Create a fetch instance with default options.
 *
 * @example
 * ```typescript
 * const api = createFetchClient({
 *   baseUrl: 'https://api.example.com',
 *   headers: { Authorization: 'Bearer token' },
 *   timeout: 10000
 * })
 *
 * const users = await api.get<User[]>('/users')
 * const newUser = await api.post<User>('/users', { name: 'John' })
 * ```
 */
export function createFetchClient(defaultOptions: {
  baseUrl?: string
  headers?: HeadersInit
  timeout?: number
  maxRetries?: number
}) {
  const { baseUrl = '', headers: defaultHeaders = {}, ...defaults } = defaultOptions

  const buildUrl = (path: string) => `${baseUrl}${path}`

  return {
    get: <T>(path: string, options: FetchWithRetryOptions = {}) =>
      fetchJSON<T>(buildUrl(path), {
        ...defaults,
        ...options,
        method: 'GET',
        headers: { ...defaultHeaders, ...options.headers },
      }),

    post: <T, D = unknown>(path: string, data: D, options: FetchWithRetryOptions = {}) =>
      postJSON<T, D>(buildUrl(path), data, {
        ...defaults,
        ...options,
        headers: { ...defaultHeaders, ...options.headers },
      }),

    put: <T, D = unknown>(path: string, data: D, options: FetchWithRetryOptions = {}) =>
      putJSON<T, D>(buildUrl(path), data, {
        ...defaults,
        ...options,
        headers: { ...defaultHeaders, ...options.headers },
      }),

    patch: <T, D = unknown>(path: string, data: D, options: FetchWithRetryOptions = {}) =>
      patchJSON<T, D>(buildUrl(path), data, {
        ...defaults,
        ...options,
        headers: { ...defaultHeaders, ...options.headers },
      }),

    delete: <T>(path: string, options: FetchWithRetryOptions = {}) =>
      deleteJSON<T>(buildUrl(path), {
        ...defaults,
        ...options,
        headers: { ...defaultHeaders, ...options.headers },
      }),
  }
}

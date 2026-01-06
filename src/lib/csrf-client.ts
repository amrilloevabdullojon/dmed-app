const CSRF_COOKIE_NAME = 'csrf-token'
const CSRF_HEADER_NAME = 'x-csrf-token'
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

let csrfFetchInstalled = false

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null
  const cookies = document.cookie ? document.cookie.split('; ') : []
  for (const item of cookies) {
    const [key, ...rest] = item.split('=')
    if (key === name) {
      return decodeURIComponent(rest.join('='))
    }
  }
  return null
}

function isSameOrigin(url: string): boolean {
  if (url.startsWith('/')) return true
  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.origin === window.location.origin
  } catch {
    return false
  }
}

function buildHeaders(input: RequestInfo, init?: RequestInit): Headers {
  const headers = new Headers()
  if (input instanceof Request) {
    input.headers.forEach((value, key) => headers.set(key, value))
  }
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value))
  }
  return headers
}

function getMethod(input: RequestInfo, init?: RequestInit): string {
  if (init?.method) return init.method
  if (input instanceof Request) return input.method
  return 'GET'
}

function getUrl(input: RequestInfo): string {
  if (input instanceof Request) return input.url
  return typeof input === 'string' ? input : String(input)
}

export function installCsrfFetch(): void {
  if (typeof window === 'undefined' || csrfFetchInstalled) return
  csrfFetchInstalled = true

  const originalFetch = window.fetch.bind(window)

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const method = getMethod(input, init).toUpperCase()
    const url = getUrl(input as RequestInfo)

    if (!MUTATING_METHODS.has(method) || !isSameOrigin(url)) {
      return originalFetch(input, init)
    }

    const headers = buildHeaders(input as RequestInfo, init)
    if (!headers.has(CSRF_HEADER_NAME)) {
      const token = getCookieValue(CSRF_COOKIE_NAME)
      if (token) {
        headers.set(CSRF_HEADER_NAME, token)
      }
    }

    if (input instanceof Request) {
      const requestWithHeaders = new Request(input, { headers })
      return originalFetch(requestWithHeaders)
    }

    return originalFetch(input, { ...init, headers })
  }
}

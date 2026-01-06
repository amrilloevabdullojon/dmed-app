import { csrfGuard, isValidCsrfRequest } from '@/lib/security'
import type { NextRequest } from 'next/server'

const createRequest = ({
  method = 'POST',
  path = '/api/letters',
  headerToken,
  cookieToken,
}: {
  method?: string
  path?: string
  headerToken?: string
  cookieToken?: string
}): NextRequest =>
  ({
    method,
    headers: new Headers(headerToken ? { 'x-csrf-token': headerToken } : {}),
    cookies: {
      get: (name: string) =>
        name === 'csrf-token' && cookieToken ? { value: cookieToken } : undefined,
    },
    nextUrl: new URL(`http://localhost${path}`),
  }) as unknown as NextRequest

describe('csrf', () => {
  it('allows safe methods without tokens', () => {
    const request = createRequest({ method: 'GET' })
    expect(isValidCsrfRequest(request)).toBe(true)
  })

  it('skips excluded paths', () => {
    const request = createRequest({ method: 'POST', path: '/api/auth/callback' })
    expect(isValidCsrfRequest(request)).toBe(true)
  })

  it('validates matching header and cookie', () => {
    const request = createRequest({ headerToken: 'abc', cookieToken: 'abc' })
    expect(isValidCsrfRequest(request)).toBe(true)
  })

  it('rejects mismatched tokens', () => {
    const request = createRequest({ headerToken: 'abc', cookieToken: 'xyz' })
    expect(isValidCsrfRequest(request)).toBe(false)
    const response = csrfGuard(request)
    expect(response?.status).toBe(403)
  })
})

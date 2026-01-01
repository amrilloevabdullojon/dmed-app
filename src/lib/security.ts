import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Security headers configuration.
 * Apply CSP and other security headers to all responses.
 */
export const securityHeaders = {
  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-eval in dev
    "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://accounts.google.com https://*.googleapis.com wss:",
    "frame-src 'self' https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; '),

  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Prevent clickjacking
  'X-Frame-Options': 'DENY',

  // XSS Protection (legacy, but still useful)
  'X-XSS-Protection': '1; mode=block',

  // Referrer Policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions Policy (formerly Feature-Policy)
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'interest-cohort=()', // Disable FLoC
  ].join(', '),

  // HSTS (only in production)
  ...(process.env.NODE_ENV === 'production' && {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  }),
}

/**
 * Apply security headers to a response.
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    if (value) {
      response.headers.set(key, value)
    }
  })
  return response
}

/**
 * CSRF token utilities.
 * Generates and validates CSRF tokens for form submissions.
 */

const CSRF_TOKEN_HEADER = 'x-csrf-token'
const CSRF_TOKEN_COOKIE = 'csrf-token'
const CSRF_TOKEN_LENGTH = 32

/**
 * Generate a random CSRF token.
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(CSRF_TOKEN_LENGTH)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Validate CSRF token from request.
 * Compares header token with cookie token.
 */
export function validateCsrfToken(request: NextRequest): boolean {
  const headerToken = request.headers.get(CSRF_TOKEN_HEADER)
  const cookieToken = request.cookies.get(CSRF_TOKEN_COOKIE)?.value

  if (!headerToken || !cookieToken) {
    return false
  }

  // Constant-time comparison to prevent timing attacks
  if (headerToken.length !== cookieToken.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < headerToken.length; i++) {
    result |= headerToken.charCodeAt(i) ^ cookieToken.charCodeAt(i)
  }

  return result === 0
}

/**
 * Create a response with CSRF token cookie.
 */
export function setCsrfTokenCookie(response: NextResponse): NextResponse {
  const token = generateCsrfToken()

  response.cookies.set(CSRF_TOKEN_COOKIE, token, {
    httpOnly: false, // Must be readable by JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  })

  return response
}

/**
 * Methods that require CSRF protection.
 */
export const CSRF_PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

/**
 * Paths excluded from CSRF protection (e.g., API routes for external services).
 */
export const CSRF_EXCLUDED_PATHS = [
  '/api/auth', // NextAuth handles its own CSRF
  '/api/health',
  '/api/webhook', // Webhooks use signatures
]

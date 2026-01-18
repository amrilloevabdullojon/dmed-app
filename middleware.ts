import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { applySecurityHeaders, setCsrfTokenCookie } from '@/lib/security'
import { ROLE_HIERARCHY } from '@/lib/constants'
import type { Role } from '@prisma/client'

const PUBLIC_PREFIXES = ['/login', '/u', '/portal']
const PUBLIC_PATHS = ['/request']
const PUBLIC_FILES = [
  '/favicon.ico',
  '/favicon.svg',
  '/apple-touch-icon.svg',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
  '/sw.js',
]

const ADMIN_ROUTES = ['/users', '/settings/system']
const MANAGER_ROUTES = ['/stats/detailed', '/templates/manage']

const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.includes(pathname) ||
  PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
  PUBLIC_FILES.includes(pathname) ||
  /\.[a-zA-Z0-9]+$/.test(pathname)

function hasMinRole(userRole: Role, minRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole]
}

function finalizeResponse(request: NextRequest, response: NextResponse): NextResponse {
  if (request.method === 'GET' && !request.nextUrl.pathname.startsWith('/api')) {
    const csrfCookie = request.cookies.get('csrf-token')
    if (!csrfCookie) {
      setCsrfTokenCookie(response)
    }
  }
  return applySecurityHeaders(response)
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  if (isPublicPath(pathname)) {
    if (token && pathname === '/login') {
      const redirectUrl = new URL('/letters', request.url)
      return finalizeResponse(request, NextResponse.redirect(redirectUrl))
    }
    return finalizeResponse(request, NextResponse.next())
  }

  if (!token) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', `${pathname}${search}`)
    return finalizeResponse(request, NextResponse.redirect(loginUrl))
  }

  const userRole = (token.role as Role) || 'VIEWER'

  if (ADMIN_ROUTES.some((route) => pathname.startsWith(route)) && !hasMinRole(userRole, 'ADMIN')) {
    return finalizeResponse(
      request,
      NextResponse.redirect(new URL('/letters?error=forbidden', request.url))
    )
  }

  if (
    MANAGER_ROUTES.some((route) => pathname.startsWith(route)) &&
    !hasMinRole(userRole, 'MANAGER')
  ) {
    return finalizeResponse(
      request,
      NextResponse.redirect(new URL('/letters?error=forbidden', request.url))
    )
  }

  if (token.canLogin === false) {
    return finalizeResponse(
      request,
      NextResponse.redirect(new URL('/login?error=disabled', request.url))
    )
  }

  const response = NextResponse.next()
  response.headers.set('x-user-id', token.sub || '')
  response.headers.set('x-user-role', userRole)
  return finalizeResponse(request, response)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image).*)'],
}

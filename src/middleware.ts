import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Защищённые маршруты, требующие авторизации
 */
const PROTECTED_ROUTES = ['/letters', '/users', '/settings', '/profile', '/stats', '/templates']

/**
 * Публичные маршруты (не требуют авторизации)
 */
const PUBLIC_ROUTES = ['/login', '/auth', '/api/auth', '/api/health']

/**
 * Маршруты только для админов
 */
const ADMIN_ROUTES = ['/users', '/settings/system']

/**
 * Маршруты только для менеджеров и выше
 */
const MANAGER_ROUTES = ['/stats/detailed', '/templates/manage']

/**
 * Иерархия ролей
 */
const ROLE_HIERARCHY: Record<string, number> = {
  VIEWER: 0,
  EMPLOYEE: 1,
  AUDITOR: 2,
  MANAGER: 3,
  ADMIN: 4,
  SUPERADMIN: 5,
}

/**
 * Проверка минимальной роли
 */
function hasMinRole(userRole: string, minRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0)
}

/**
 * Проверка, является ли маршрут публичным
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
}

/**
 * Проверка, является ли маршрут защищённым
 */
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route))
}

/**
 * Проверка, является ли маршрут админским
 */
function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some((route) => pathname.startsWith(route))
}

/**
 * Проверка, является ли маршрут для менеджеров
 */
function isManagerRoute(pathname: string): boolean {
  return MANAGER_ROUTES.some((route) => pathname.startsWith(route))
}

/**
 * Security headers
 */
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static files and API auth routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next()
  }

  // Get session token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  const response = NextResponse.next()

  // Apply security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // Public routes - allow access
  if (isPublicRoute(pathname)) {
    // Redirect authenticated users away from login
    if (token && pathname === '/login') {
      return NextResponse.redirect(new URL('/letters', request.url))
    }
    return response
  }

  // Protected routes - require authentication
  if (isProtectedRoute(pathname)) {
    if (!token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const userRole = (token.role as string) || 'VIEWER'

    // Check admin routes
    if (isAdminRoute(pathname) && !hasMinRole(userRole, 'ADMIN')) {
      return NextResponse.redirect(new URL('/letters?error=forbidden', request.url))
    }

    // Check manager routes
    if (isManagerRoute(pathname) && !hasMinRole(userRole, 'MANAGER')) {
      return NextResponse.redirect(new URL('/letters?error=forbidden', request.url))
    }

    // Check if user can login
    if (token.canLogin === false) {
      return NextResponse.redirect(new URL('/login?error=disabled', request.url))
    }
  }

  // API routes protection
  if (pathname.startsWith('/api') && !isPublicRoute(pathname)) {
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Add user info to headers for server components
  if (token) {
    response.headers.set('x-user-id', token.sub || '')
    response.headers.set('x-user-role', (token.role as string) || 'VIEWER')
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}

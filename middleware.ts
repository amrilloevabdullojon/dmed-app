import { NextRequest, NextResponse } from 'next/server'

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

const hasSessionCookie = (request: NextRequest) =>
  request.cookies.has('next-auth.session-token') ||
  request.cookies.has('__Secure-next-auth.session-token')

const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.includes(pathname) ||
  PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
  PUBLIC_FILES.includes(pathname) ||
  /\.[a-zA-Z0-9]+$/.test(pathname)

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  if (hasSessionCookie(request)) {
    return NextResponse.next()
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.searchParams.set('next', `${pathname}${search}`)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image).*)'],
}

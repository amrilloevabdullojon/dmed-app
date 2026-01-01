import { NextRequest, NextResponse } from 'next/server'
import { getServerSession, Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit'
import type { Role } from '@prisma/client'

/**
 * Extended session type with user role
 */
export interface AuthenticatedSession extends Session {
  user: Session['user'] & {
    id: string
    role: Role
  }
}

/**
 * API handler options
 */
interface HandlerOptions {
  /** Rate limit preset or custom config */
  rateLimit?: keyof typeof RATE_LIMITS | { limit: number; windowMs: number }

  /** Minimum role required (ordered: VIEWER < EMPLOYEE < AUDITOR < MANAGER < ADMIN < SUPERADMIN) */
  minRole?: Role

  /** Allow unauthenticated access */
  public?: boolean
}

const ROLE_HIERARCHY: Record<Role, number> = {
  VIEWER: 0,
  EMPLOYEE: 1,
  AUDITOR: 2,
  MANAGER: 3,
  ADMIN: 4,
  SUPERADMIN: 5,
}

function hasMinRole(userRole: Role, minRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole]
}

/**
 * Wrapper for API route handlers with built-in auth, rate limiting, and error handling.
 *
 * @example
 * ```typescript
 * // Basic authenticated endpoint
 * export const GET = withAuth(async (req, session) => {
 *   return NextResponse.json({ user: session.user })
 * })
 *
 * // Admin-only endpoint with heavy rate limit
 * export const POST = withAuth(
 *   async (req, session) => {
 *     // ...
 *   },
 *   { minRole: 'ADMIN', rateLimit: 'heavy' }
 * )
 *
 * // Public endpoint
 * export const GET = withAuth(
 *   async (req) => {
 *     return NextResponse.json({ status: 'ok' })
 *   },
 *   { public: true }
 * )
 * ```
 */
export function withAuth<T>(
  handler: (req: NextRequest, session: AuthenticatedSession) => Promise<NextResponse<T>>,
  options: HandlerOptions = {}
): (req: NextRequest) => Promise<NextResponse<T | { error: string }>> {
  return async (req: NextRequest) => {
    const context = `${req.method} ${req.nextUrl.pathname}`

    try {
      // Rate limiting
      if (options.rateLimit) {
        const config =
          typeof options.rateLimit === 'string'
            ? RATE_LIMITS[options.rateLimit]
            : options.rateLimit

        const identifier = getClientIdentifier(req.headers)
        const result = checkRateLimit(
          `${identifier}:${req.nextUrl.pathname}`,
          config.limit,
          config.windowMs
        )

        if (!result.success) {
          logger.warn(context, 'Rate limit exceeded', { identifier })
          return NextResponse.json(
            { error: 'Слишком много запросов. Попробуйте позже.' },
            {
              status: 429,
              headers: {
                'Retry-After': String(Math.ceil((result.reset - Date.now()) / 1000)),
                'X-RateLimit-Remaining': String(result.remaining),
                'X-RateLimit-Reset': String(result.reset),
              },
            }
          ) as NextResponse<{ error: string }>
        }
      }

      // Authentication check
      if (!options.public) {
        const session = (await getServerSession(authOptions)) as AuthenticatedSession | null

        if (!session) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          ) as NextResponse<{ error: string }>
        }

        // Role check
        if (options.minRole && !hasMinRole(session.user.role, options.minRole)) {
          logger.warn(context, 'Insufficient permissions', {
            userId: session.user.id,
            userRole: session.user.role,
            requiredRole: options.minRole,
          })
          return NextResponse.json(
            { error: 'Недостаточно прав для выполнения операции' },
            { status: 403 }
          ) as NextResponse<{ error: string }>
        }

        return handler(req, session)
      }

      // Public endpoint - pass null session (handler should handle this)
      return handler(req, null as unknown as AuthenticatedSession)
    } catch (error) {
      logger.error(context, error)

      return NextResponse.json(
        { error: 'Внутренняя ошибка сервера' },
        { status: 500 }
      ) as NextResponse<{ error: string }>
    }
  }
}

/**
 * Helper to create typed JSON response
 */
export function jsonResponse<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status })
}

/**
 * Helper to create error response
 */
export function errorResponse(
  error: string,
  status = 400
): NextResponse<{ error: string }> {
  return NextResponse.json({ error }, { status })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession, Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit'
import type { Role } from '@prisma/client'
import { z, ZodSchema, ZodError } from 'zod'

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
interface HandlerOptions<TBody = unknown, TQuery = unknown> {
  /** Rate limit preset or custom config */
  rateLimit?: keyof typeof RATE_LIMITS | { limit: number; windowMs: number }

  /** Minimum role required (ordered: VIEWER < EMPLOYEE < AUDITOR < MANAGER < ADMIN < SUPERADMIN) */
  minRole?: Role

  /** Allow unauthenticated access */
  public?: boolean

  /** Zod schema for request body validation */
  bodySchema?: ZodSchema<TBody>

  /** Zod schema for query params validation */
  querySchema?: ZodSchema<TQuery>

  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number
}

/**
 * Validated request context passed to handler
 */
interface RequestContext<TBody = unknown, TQuery = unknown> {
  body: TBody
  query: TQuery
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
 * Format Zod validation errors into readable message
 */
function formatZodErrors(error: ZodError): string {
  return error.errors
    .map((e) => {
      const path = e.path.join('.')
      return path ? `${path}: ${e.message}` : e.message
    })
    .join('; ')
}

/**
 * Parse query params from URL
 */
function parseQueryParams(url: URL): Record<string, string> {
  const params: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    params[key] = value
  })
  return params
}

/**
 * Create a timeout promise
 */
function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), ms)
  })
}

/**
 * Wrapper for API route handlers with built-in auth, rate limiting, validation, and error handling.
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
    const startTime = Date.now()
    const context = `${req.method} ${req.nextUrl.pathname}`
    const timeoutMs = options.timeout ?? 30000

    try {
      // Rate limiting
      if (options.rateLimit) {
        const config =
          typeof options.rateLimit === 'string' ? RATE_LIMITS[options.rateLimit] : options.rateLimit

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
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as NextResponse<{
            error: string
          }>
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

        // Execute handler with timeout
        const handlerPromise = handler(req, session)
        const response = await Promise.race([handlerPromise, createTimeout(timeoutMs)])

        // Log response time
        const duration = Date.now() - startTime
        if (duration > 1000) {
          logger.warn(context, `Slow request: ${duration}ms`, { duration })
        } else {
          logger.debug(context, `Request completed in ${duration}ms`, { duration })
        }

        return response
      }

      // Public endpoint - pass null session (handler should handle this)
      const handlerPromise = handler(req, null as unknown as AuthenticatedSession)
      const response = await Promise.race([handlerPromise, createTimeout(timeoutMs)])

      const duration = Date.now() - startTime
      if (duration > 1000) {
        logger.warn(context, `Slow request: ${duration}ms`, { duration })
      }

      return response
    } catch (error) {
      const duration = Date.now() - startTime

      if (error instanceof Error && error.message === 'Request timeout') {
        logger.error(context, `Request timeout after ${timeoutMs}ms`)
        return NextResponse.json(
          { error: 'Превышено время ожидания запроса' },
          { status: 504 }
        ) as NextResponse<{ error: string }>
      }

      logger.error(context, error, { duration })

      return NextResponse.json(
        { error: 'Внутренняя ошибка сервера' },
        { status: 500 }
      ) as NextResponse<{ error: string }>
    }
  }
}

/**
 * Enhanced wrapper with Zod validation support.
 *
 * @example
 * ```typescript
 * export const POST = withValidation(
 *   async (req, session, { body }) => {
 *     // body is typed as CreateLetterInput
 *     return NextResponse.json({ letter: await createLetter(body) })
 *   },
 *   { bodySchema: createLetterSchema }
 * )
 * ```
 */
export function withValidation<T, TBody = unknown, TQuery = unknown>(
  handler: (
    req: NextRequest,
    session: AuthenticatedSession,
    context: RequestContext<TBody, TQuery>
  ) => Promise<NextResponse<T>>,
  options: HandlerOptions<TBody, TQuery> = {}
): (req: NextRequest) => Promise<NextResponse<T | { error: string }>> {
  return async (req: NextRequest) => {
    const startTime = Date.now()
    const logContext = `${req.method} ${req.nextUrl.pathname}`
    const timeoutMs = options.timeout ?? 30000

    try {
      // Rate limiting
      if (options.rateLimit) {
        const config =
          typeof options.rateLimit === 'string' ? RATE_LIMITS[options.rateLimit] : options.rateLimit

        const identifier = getClientIdentifier(req.headers)
        const result = checkRateLimit(
          `${identifier}:${req.nextUrl.pathname}`,
          config.limit,
          config.windowMs
        )

        if (!result.success) {
          logger.warn(logContext, 'Rate limit exceeded', { identifier })
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

      // Validate query params
      let validatedQuery: TQuery = {} as TQuery
      if (options.querySchema) {
        const rawQuery = parseQueryParams(req.nextUrl)
        const queryResult = options.querySchema.safeParse(rawQuery)
        if (!queryResult.success) {
          return NextResponse.json(
            { error: `Некорректные параметры запроса: ${formatZodErrors(queryResult.error)}` },
            { status: 400 }
          ) as NextResponse<{ error: string }>
        }
        validatedQuery = queryResult.data
      }

      // Validate request body
      let validatedBody: TBody = {} as TBody
      if (options.bodySchema) {
        try {
          const rawBody = await req.json()
          const bodyResult = options.bodySchema.safeParse(rawBody)
          if (!bodyResult.success) {
            return NextResponse.json(
              { error: `Некорректные данные: ${formatZodErrors(bodyResult.error)}` },
              { status: 400 }
            ) as NextResponse<{ error: string }>
          }
          validatedBody = bodyResult.data
        } catch {
          return NextResponse.json(
            { error: 'Некорректный JSON в теле запроса' },
            { status: 400 }
          ) as NextResponse<{ error: string }>
        }
      }

      const requestContext: RequestContext<TBody, TQuery> = {
        body: validatedBody,
        query: validatedQuery,
      }

      // Authentication check
      if (!options.public) {
        const session = (await getServerSession(authOptions)) as AuthenticatedSession | null

        if (!session) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as NextResponse<{
            error: string
          }>
        }

        // Role check
        if (options.minRole && !hasMinRole(session.user.role, options.minRole)) {
          logger.warn(logContext, 'Insufficient permissions', {
            userId: session.user.id,
            userRole: session.user.role,
            requiredRole: options.minRole,
          })
          return NextResponse.json(
            { error: 'Недостаточно прав для выполнения операции' },
            { status: 403 }
          ) as NextResponse<{ error: string }>
        }

        const handlerPromise = handler(req, session, requestContext)
        const response = await Promise.race([handlerPromise, createTimeout(timeoutMs)])

        const duration = Date.now() - startTime
        if (duration > 1000) {
          logger.warn(logContext, `Slow request: ${duration}ms`, { duration })
        }

        return response
      }

      const handlerPromise = handler(req, null as unknown as AuthenticatedSession, requestContext)
      const response = await Promise.race([handlerPromise, createTimeout(timeoutMs)])

      const duration = Date.now() - startTime
      if (duration > 1000) {
        logger.warn(logContext, `Slow request: ${duration}ms`, { duration })
      }

      return response
    } catch (error) {
      const duration = Date.now() - startTime

      if (error instanceof Error && error.message === 'Request timeout') {
        logger.error(logContext, `Request timeout after ${timeoutMs}ms`)
        return NextResponse.json(
          { error: 'Превышено время ожидания запроса' },
          { status: 504 }
        ) as NextResponse<{ error: string }>
      }

      logger.error(logContext, error, { duration })

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
export function errorResponse(error: string, status = 400): NextResponse<{ error: string }> {
  return NextResponse.json({ error }, { status })
}

import { NextRequest, NextResponse } from 'next/server'
import { ZodType } from 'zod'
import { withAuth, AuthenticatedSession } from '@/lib/api-handler'
import { RATE_LIMITS } from '@/lib/rate-limit'
import type { Role } from '@prisma/client'

/**
 * Handler configuration for createHandler
 */
interface CreateHandlerConfig<TBody = unknown, TQuery = unknown, TResponse = unknown> {
  /** Request body validation schema */
  schema?: ZodType<TBody>

  /** Query params validation schema */
  querySchema?: ZodType<TQuery>

  /** Authentication requirement */
  auth?: 'required' | 'optional' | 'none'

  /** Minimum role required (when auth is 'required') */
  minRole?: Role

  /** Rate limit preset */
  rateLimit?: keyof typeof RATE_LIMITS

  /** Request timeout in ms */
  timeout?: number

  /** Handler function */
  handler: (params: {
    req: NextRequest
    session: AuthenticatedSession | null
    body: TBody
    query: TQuery
  }) => Promise<NextResponse<TResponse> | NextResponse<{ error: string }>>
}

/**
 * Enhanced API handler creator with type-safe body and query validation.
 *
 * Combines authentication, rate limiting, CSRF protection, and schema validation
 * in a single, easy-to-use wrapper.
 *
 * @example
 * ```typescript
 * // Authenticated endpoint with body validation
 * export const POST = createHandler({
 *   schema: createLetterSchema,
 *   auth: 'required',
 *   rateLimit: 'strict',
 *   handler: async ({ body, session }) => {
 *     const letter = await prisma.letter.create({
 *       data: { ...body, ownerId: session.user.id }
 *     })
 *     return NextResponse.json(letter)
 *   }
 * })
 *
 * // Admin-only endpoint
 * export const DELETE = createHandler({
 *   auth: 'required',
 *   minRole: 'ADMIN',
 *   handler: async ({ req, session }) => {
 *     // ... admin logic
 *     return NextResponse.json({ success: true })
 *   }
 * })
 *
 * // Public endpoint with query validation
 * export const GET = createHandler({
 *   querySchema: z.object({ page: z.string(), limit: z.string() }),
 *   auth: 'none',
 *   handler: async ({ query }) => {
 *     const page = parseInt(query.page)
 *     const limit = parseInt(query.limit)
 *     // ...
 *     return NextResponse.json({ data: [] })
 *   }
 * })
 * ```
 */
export function createHandler<TBody = unknown, TQuery = unknown, TResponse = unknown>(
  config: CreateHandlerConfig<TBody, TQuery, TResponse>
) {
  const isPublic = config.auth === 'none'
  const isOptional = config.auth === 'optional'

  return withAuth(
    async (req: NextRequest, session: AuthenticatedSession | null) => {
      // Parse and validate body
      let body = {} as TBody
      if (config.schema) {
        try {
          const rawBody = await req.json()
          body = config.schema.parse(rawBody)
        } catch (error) {
          if (error instanceof Error) {
            return NextResponse.json(
              { error: `Validation error: ${error.message}` },
              { status: 400 }
            )
          }
          return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }
      }

      // Parse and validate query
      let query = {} as TQuery
      if (config.querySchema) {
        try {
          const url = new URL(req.url)
          const queryParams = Object.fromEntries(url.searchParams.entries())
          query = config.querySchema.parse(queryParams)
        } catch (error) {
          if (error instanceof Error) {
            return NextResponse.json(
              { error: `Query validation error: ${error.message}` },
              { status: 400 }
            )
          }
          return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 })
        }
      }

      // Execute handler
      return config.handler({
        req,
        session: isPublic || isOptional ? session : session!,
        body,
        query,
      })
    },
    {
      public: isPublic,
      minRole: config.minRole,
      rateLimit: config.rateLimit,
      timeout: config.timeout,
    }
  )
}

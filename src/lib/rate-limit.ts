import { getRedisClient } from '@/lib/redis'

/**
 * Rate limiter for API endpoints.
 * Uses Redis when available, falls back to in-memory storage.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const cache = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000

let cleanupTimer: NodeJS.Timeout | null = null

function startCleanup() {
  if (cleanupTimer) return

  cleanupTimer = setInterval(() => {
    const now = Date.now()
    cache.forEach((entry, key) => {
      if (entry.resetAt < now) {
        cache.delete(key)
      }
    })
  }, CLEANUP_INTERVAL)

  // Don't prevent process exit
  if (cleanupTimer.unref) {
    cleanupTimer.unref()
  }
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  reset: number
}

/**
 * Check rate limit for a given identifier.
 *
 * @param identifier - Unique identifier (e.g., IP address, user ID)
 * @param limit - Maximum number of requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns Result indicating if request is allowed
 */
async function checkRateLimitMemory(
  identifier: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  startCleanup()

  const now = Date.now()
  const entry = cache.get(identifier)

  // No existing entry or window expired
  if (!entry || entry.resetAt < now) {
    cache.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    })
    return {
      success: true,
      remaining: limit - 1,
      reset: now + windowMs,
    }
  }

  // Window still active
  if (entry.count >= limit) {
    return {
      success: false,
      remaining: 0,
      reset: entry.resetAt,
    }
  }

  entry.count++
  return {
    success: true,
    remaining: limit - entry.count,
    reset: entry.resetAt,
  }
}

async function checkRateLimitRedis(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redis = getRedisClient()
  if (!redis) {
    return checkRateLimitMemory(identifier, limit, windowMs)
  }

  const key = `rate:${identifier}`
  const script = `
    local current = redis.call("INCR", KEYS[1])
    if tonumber(current) == 1 then
      redis.call("PEXPIRE", KEYS[1], ARGV[1])
    end
    local ttl = redis.call("PTTL", KEYS[1])
    return {current, ttl}
  `

  try {
    const result = (await redis.eval(script, [key], [windowMs])) as [number, number]
    const current = Number(result?.[0] ?? 0)
    const ttl = Number(result?.[1] ?? windowMs)
    const remaining = Math.max(0, limit - current)
    return {
      success: current <= limit,
      remaining,
      reset: Date.now() + (ttl > 0 ? ttl : windowMs),
    }
  } catch {
    return checkRateLimitMemory(identifier, limit, windowMs)
  }
}

export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  return checkRateLimitRedis(identifier, limit, windowMs)
}

/**
 * Rate limit configuration presets
 */
export const RATE_LIMITS = {
  // Standard API endpoints: 100 requests per minute
  standard: { limit: 100, windowMs: 60 * 1000 },

  // Sensitive endpoints (login, password reset): 10 requests per 15 minutes
  sensitive: { limit: 10, windowMs: 15 * 60 * 1000 },

  // Heavy operations (sync, export): 5 requests per minute
  heavy: { limit: 5, windowMs: 60 * 1000 },

  // Search endpoints: 30 requests per minute
  search: { limit: 30, windowMs: 60 * 1000 },

  // File uploads: 20 requests per minute
  upload: { limit: 20, windowMs: 60 * 1000 },
} as const

/**
 * Get client identifier from request headers.
 * Falls back to a default value for local development.
 */
export function getClientIdentifier(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'anonymous'
  )
}

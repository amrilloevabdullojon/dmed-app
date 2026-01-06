import { getRedisClient } from '@/lib/redis'

// In-memory cache with optional Redis backing.
interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private defaultTTL = 60 * 1000 // 1 minute

  async set<T>(key: string, data: T, ttlMs: number = this.defaultTTL): Promise<void> {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    })

    const redis = getRedisClient()
    if (!redis) return

    try {
      await redis.set(key, JSON.stringify(data), { px: ttlMs })
    } catch {
      // Best-effort Redis write; fall back to in-memory cache.
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key)

    if (entry) {
      if (Date.now() <= entry.expiresAt) {
        return entry.data as T
      }
      this.cache.delete(key)
    }

    const redis = getRedisClient()
    if (!redis) {
      return null
    }

    try {
      const cached = await redis.get<string>(key)
      if (!cached) return null
      const parsed = JSON.parse(cached) as T
      const ttl = await redis.pttl(key).catch(() => null)
      const expiresAt =
        typeof ttl === 'number' && ttl > 0 ? Date.now() + ttl : Date.now() + this.defaultTTL
      this.cache.set(key, { data: parsed, expiresAt })
      return parsed
    } catch {
      return null
    }
  }

  async invalidate(key: string): Promise<void> {
    this.cache.delete(key)
    const redis = getRedisClient()
    if (!redis) return
    try {
      await redis.del(key)
    } catch {
      // Ignore Redis failures.
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern)
    const keys = Array.from(this.cache.keys())
    keys.forEach((key) => {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    })

    const redis = getRedisClient()
    if (!redis) return

    try {
      const redisKeys = await redis.keys(pattern)
      if (redisKeys.length > 0) {
        await redis.del(...redisKeys)
      }
    } catch {
      // Ignore Redis failures.
    }
  }

  clear(): void {
    this.cache.clear()
  }

  cleanup(): void {
    const now = Date.now()
    const entries = Array.from(this.cache.entries())
    entries.forEach(([key, entry]) => {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    })
  }
}

export const cache = new SimpleCache()

export const CACHE_TTL = {
  STATS: 2 * 60 * 1000,
  LETTERS_LIST: 30 * 1000,
  LETTER_DETAIL: 60 * 1000,
  USERS: 5 * 60 * 1000,
}

export const CACHE_KEYS = {
  STATS: 'stats',
  LETTERS: (params: string) => `letters:${params}`,
  LETTER: (id: string) => `letter:${id}`,
  USERS: 'users',
}

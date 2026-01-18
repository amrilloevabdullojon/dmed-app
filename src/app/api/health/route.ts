import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env, hasSentry, hasRedis, hasTelegram } from '@/lib/env.validation'

interface CheckResult {
  status: 'ok' | 'error' | 'warning'
  latency?: number
  error?: string
  details?: Record<string, unknown>
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  uptime: number
  version: string
  environment: string
  checks: {
    database: CheckResult
    memory: CheckResult & { used: number; total: number; percent: number }
    disk?: CheckResult
    externalServices?: {
      sentry?: CheckResult
      redis?: CheckResult
      googleSheets?: CheckResult
      googleDrive?: CheckResult
      telegram?: CheckResult
    }
  }
  responseTime: number
}

// GET /api/health - расширенная проверка состояния приложения
export async function GET(request: Request) {
  const startTime = Date.now()
  const { searchParams } = new URL(request.url)
  const verbose = searchParams.get('verbose') === 'true'

  const checks: HealthStatus['checks'] = {
    database: { status: 'ok' },
    memory: { status: 'ok', used: 0, total: 0, percent: 0 },
  }

  // 1. Проверка базы данных
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const latency = Date.now() - dbStart

    checks.database = {
      status: latency > 1000 ? 'warning' : 'ok',
      latency,
    }

    // Дополнительная информация в verbose режиме
    if (verbose) {
      const [letterCount, userCount] = await Promise.all([
        prisma.letter.count({ where: { deletedAt: null } }),
        prisma.user.count(),
      ])
      checks.database.details = {
        activeLetters: letterCount,
        totalUsers: userCount,
      }
    }
  } catch (error) {
    checks.database = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown database error',
    }
  }

  // 2. Проверка памяти
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const memory = process.memoryUsage()
    const usedMB = Math.round(memory.heapUsed / 1024 / 1024)
    const totalMB = Math.round(memory.heapTotal / 1024 / 1024)
    const percent = Math.round((memory.heapUsed / memory.heapTotal) * 100)

    checks.memory = {
      status: percent > 95 ? 'error' : percent > 85 ? 'warning' : 'ok',
      used: usedMB,
      total: totalMB,
      percent,
    }

    if (verbose) {
      checks.memory.details = {
        rss: Math.round(memory.rss / 1024 / 1024),
        external: Math.round(memory.external / 1024 / 1024),
        arrayBuffers: Math.round(memory.arrayBuffers / 1024 / 1024),
      }
    }
  }

  // 3. Проверка внешних сервисов (только в verbose режиме)
  if (verbose) {
    checks.externalServices = {}

    // Sentry
    if (hasSentry) {
      checks.externalServices.sentry = {
        status: 'ok',
        details: {
          configured: true,
          environment: env.NODE_ENV,
        },
      }
    }

    // Redis
    if (hasRedis) {
      try {
        // Test Redis connection
        const { redis } = await import('@/lib/redis')
        const redisStart = Date.now()
        await redis.ping()
        const latency = Date.now() - redisStart

        checks.externalServices.redis = {
          status: latency > 500 ? 'warning' : 'ok',
          latency,
          details: { configured: true },
        }
      } catch (error) {
        checks.externalServices.redis = {
          status: 'error',
          error: error instanceof Error ? error.message : 'Redis connection failed',
        }
      }
    }

    // Google Sheets
    if (env.GOOGLE_SPREADSHEET_ID) {
      checks.externalServices.googleSheets = {
        status: 'ok',
        details: { configured: true },
      }
    }

    // Google Drive
    if (env.GOOGLE_DRIVE_FOLDER_ID) {
      checks.externalServices.googleDrive = {
        status: 'ok',
        details: { configured: true },
      }
    }

    // Telegram
    if (hasTelegram) {
      checks.externalServices.telegram = {
        status: 'ok',
        details: { configured: true },
      }
    }
  }

  // Определяем общий статус
  let status: HealthStatus['status'] = 'healthy'

  if (checks.database.status === 'error' || checks.memory.status === 'error') {
    status = 'unhealthy'
  } else if (
    checks.database.status === 'warning' ||
    checks.memory.status === 'warning'
  ) {
    status = 'degraded'
  }

  const response: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime ? Math.round(process.uptime()) : 0,
    version: process.env.npm_package_version || '1.0.0',
    environment: env.NODE_ENV,
    checks,
    responseTime: Date.now() - startTime,
  }

  // Log health check failures
  if (status !== 'healthy') {
    const { logger } = await import('@/lib/logger.server')
    logger.warn('health.check', `Health status: ${status}`, {
      checks: Object.fromEntries(
        Object.entries(checks).map(([key, value]) => [key, value.status])
      ),
    })
  }

  // Добавить метрики для мониторинга
  const httpStatus = status === 'unhealthy' ? 503 : status === 'degraded' ? 200 : 200

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Health-Status': status,
      'X-Response-Time': `${response.responseTime}ms`,
    },
  })
}

// HEAD /api/health - быстрая проверка (для load balancers)
export async function HEAD() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return new NextResponse(null, { status: 200 })
  } catch {
    return new NextResponse(null, { status: 503 })
  }
}

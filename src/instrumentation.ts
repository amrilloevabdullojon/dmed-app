/**
 * Next.js Instrumentation Hook
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * This file runs once when the server starts (both dev and production).
 * Perfect for initializing monitoring tools like Sentry.
 */

export async function register() {
  // Only run on server-side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize Sentry if configured
    const { initSentry } = await import('./lib/sentry')
    initSentry()

    // Log startup
    const { logger } = await import('./lib/logger.server')
    const { env, isProd, hasSentry, hasRedis, hasTelegram } = await import('./lib/env.validation')

    logger.info('application.startup', {
      environment: env.NODE_ENV,
      features: {
        sentry: hasSentry,
        redis: hasRedis,
        telegram: hasTelegram,
      },
    })

    if (isProd && !hasSentry) {
      logger.warn(
        'application.startup',
        'Sentry is not configured in production. Error tracking is disabled.'
      )
    }

    // Warm up critical connections
    if (hasRedis) {
      logger.info('application.startup', 'Redis configured, connection will be established on first use')
    }
  }
}

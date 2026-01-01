/**
 * Sentry integration for error tracking.
 *
 * To enable Sentry:
 * 1. Install: npm install @sentry/nextjs
 * 2. Set SENTRY_DSN environment variable
 * 3. Run: npx @sentry/wizard@latest -i nextjs
 *
 * This file provides a wrapper that works with or without Sentry installed.
 */

interface SentryUser {
  id?: string
  email?: string
  username?: string
}

interface SentryContext {
  [key: string]: unknown
}

interface SentryBreadcrumb {
  category?: string
  message: string
  level?: 'debug' | 'info' | 'warning' | 'error'
  data?: Record<string, unknown>
}

// Check if Sentry is available
const isSentryAvailable = (): boolean => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@sentry/nextjs')
    return true
  } catch {
    return false
  }
}

// Get Sentry module if available
const getSentry = () => {
  if (!isSentryAvailable()) return null
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@sentry/nextjs')
}

/**
 * Initialize Sentry (call this in instrumentation.ts or _app.tsx)
 */
export function initSentry() {
  const Sentry = getSentry()
  if (!Sentry || !process.env.SENTRY_DSN) return

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    debug: process.env.NODE_ENV === 'development',
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
  })
}

/**
 * Capture an exception and send to Sentry.
 */
export function captureException(error: Error, context?: SentryContext) {
  const Sentry = getSentry()

  if (Sentry) {
    if (context) {
      Sentry.withScope((scope: { setContext: (key: string, value: unknown) => void }) => {
        scope.setContext('additional', context)
        Sentry.captureException(error)
      })
    } else {
      Sentry.captureException(error)
    }
  }

  // Always log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('[Sentry]', error, context)
  }
}

/**
 * Capture a message and send to Sentry.
 */
export function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  context?: SentryContext
) {
  const Sentry = getSentry()

  if (Sentry) {
    if (context) {
      Sentry.withScope((scope: { setContext: (key: string, value: unknown) => void }) => {
        scope.setContext('additional', context)
        Sentry.captureMessage(message, level)
      })
    } else {
      Sentry.captureMessage(message, level)
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Sentry:${level}]`, message, context)
  }
}

/**
 * Set user context for Sentry.
 */
export function setUser(user: SentryUser | null) {
  const Sentry = getSentry()
  if (Sentry) {
    Sentry.setUser(user)
  }
}

/**
 * Add a breadcrumb for debugging.
 */
export function addBreadcrumb(breadcrumb: SentryBreadcrumb) {
  const Sentry = getSentry()
  if (Sentry) {
    Sentry.addBreadcrumb(breadcrumb)
  }
}

/**
 * Set a tag for filtering in Sentry dashboard.
 */
export function setTag(key: string, value: string) {
  const Sentry = getSentry()
  if (Sentry) {
    Sentry.setTag(key, value)
  }
}

/**
 * Start a performance transaction.
 */
export function startTransaction(name: string, op: string) {
  const Sentry = getSentry()
  if (Sentry) {
    return Sentry.startTransaction({ name, op })
  }
  return null
}

/**
 * Wrap an async function with error capturing.
 */
export async function withErrorCapture<T>(
  fn: () => Promise<T>,
  context?: SentryContext
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    captureException(error instanceof Error ? error : new Error(String(error)), context)
    throw error
  }
}

/**
 * Create an error boundary handler for React.
 */
export function createErrorBoundaryHandler(componentName: string) {
  return (error: Error, errorInfo: { componentStack: string }) => {
    captureException(error, {
      componentName,
      componentStack: errorInfo.componentStack,
    })
  }
}

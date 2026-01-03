type LogLevel = 'debug' | 'info' | 'warn' | 'error'

import { getRequestContext } from '@/lib/request-context'

interface LogEntry {
  level: LogLevel
  context: string
  message: string
  timestamp: string
  stack?: string
  meta?: Record<string, unknown>
}

function formatLog(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
    `[${entry.context}]`,
    entry.message,
  ]

  if (entry.meta && Object.keys(entry.meta).length > 0) {
    parts.push(JSON.stringify(entry.meta))
  }

  if (entry.stack) {
    parts.push('\n' + entry.stack)
  }

  return parts.join(' ')
}

function createLogEntry(
  level: LogLevel,
  context: string,
  messageOrError: string | unknown,
  meta?: Record<string, unknown>
): LogEntry {
  let message: string
  let stack: string | undefined

  if (messageOrError instanceof Error) {
    message = messageOrError.message
    stack = messageOrError.stack
  } else if (typeof messageOrError === 'string') {
    message = messageOrError
  } else {
    message = String(messageOrError)
  }

  const requestContext = getRequestContext()
  const mergedMeta = {
    ...(meta || {}),
    ...(requestContext?.requestId && !meta?.requestId
      ? { requestId: requestContext.requestId }
      : {}),
  }

  return {
    level,
    context,
    message,
    timestamp: new Date().toISOString(),
    stack,
    meta: Object.keys(mergedMeta).length > 0 ? mergedMeta : undefined,
  }
}

const isDev = process.env.NODE_ENV === 'development'

/**
 * Centralized logger for the application.
 *
 * @example
 * ```typescript
 * // Basic usage
 * logger.info('API', 'User logged in', { userId: '123' })
 *
 * // Error logging
 * try {
 *   // ...
 * } catch (error) {
 *   logger.error('PaymentService', error, { orderId: '456' })
 * }
 * ```
 */
/* eslint-disable no-console */
export const logger = {
  debug: (context: string, message: string, meta?: Record<string, unknown>) => {
    if (!isDev) return

    const entry = createLogEntry('debug', context, message, meta)
    console.debug(formatLog(entry))
  },

  info: (context: string, message: string, meta?: Record<string, unknown>) => {
    const entry = createLogEntry('info', context, message, meta)
    console.info(formatLog(entry))
  },

  warn: (context: string, message: string, meta?: Record<string, unknown>) => {
    const entry = createLogEntry('warn', context, message, meta)
    console.warn(formatLog(entry))
  },

  error: (context: string, error: unknown, meta?: Record<string, unknown>) => {
    const entry = createLogEntry('error', context, error, meta)
    console.error(formatLog(entry))
  },
}
/* eslint-enable no-console */

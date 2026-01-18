import { z } from 'zod'

/**
 * Environment variables validation schema
 *
 * This schema validates all required and optional environment variables
 * at application startup to fail fast if misconfigured.
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().describe('PostgreSQL connection string'),

  // Next.js
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXTAUTH_URL: z.string().url().describe('Application base URL'),
  NEXTAUTH_SECRET: z.string().min(32).describe('NextAuth JWT secret (min 32 chars)'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1).describe('Google OAuth Client ID'),
  GOOGLE_CLIENT_SECRET: z.string().min(1).describe('Google OAuth Client Secret'),

  // Google Sheets API
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email().describe('Service account email'),
  GOOGLE_PRIVATE_KEY: z
    .string()
    .min(1)
    .refine(
      (key) => key.includes('-----BEGIN PRIVATE KEY-----'),
      'Must be a valid private key'
    )
    .describe('Service account private key'),
  GOOGLE_SPREADSHEET_ID: z.string().min(1).describe('Google Sheets document ID'),
  GOOGLE_SHEET_NAME: z.string().optional().describe('Sheet name (optional)'),

  // Google Drive
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional().describe('Drive folder for profile assets'),
  GOOGLE_DRIVE_ATTACHMENTS_FOLDER_ID: z.string().optional().describe('Drive folder for attachments'),
  GOOGLE_DRIVE_SHARE_MODE: z.enum(['public', 'private', 'domain']).optional().default('private'),
  GOOGLE_DRIVE_SHARE_DOMAIN: z.string().optional(),

  // Telegram Bot (optional)
  TELEGRAM_BOT_TOKEN: z.string().optional().describe('Telegram bot token'),
  TELEGRAM_ADMIN_CHAT_ID: z.string().optional().describe('Admin chat ID for notifications'),

  // Gemini AI (optional)
  GEMINI_API_KEY: z.string().optional().describe('Google Gemini API key for AI parsing'),

  // File Upload
  FILE_UPLOAD_STRATEGY: z.enum(['sync', 'async']).optional().default('async'),
  FILE_SYNC_ASYNC: z
    .string()
    .optional()
    .transform((val) => val === 'true')
    .pipe(z.boolean())
    .default(true),
  LOCAL_UPLOADS_DIR: z.string().optional(),

  // Cloudflare Turnstile
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),

  // Redis/Upstash (optional, falls back to in-memory)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Sentry (optional)
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),

  // Feature flags
  PRISMA_LOG_QUERIES: z
    .string()
    .optional()
    .transform((val) => val === 'true')
    .pipe(z.boolean())
    .default(false),
})

// Type-safe environment variables
export type Env = z.infer<typeof envSchema>

// Validate and export environment
let env: Env

try {
  env = envSchema.parse(process.env)
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid environment variables:')
    console.error(error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`).join('\n'))
    console.error('\n💡 Check your .env file and ensure all required variables are set')
    console.error('📝 See .env.example for reference\n')
  }
  throw new Error('Environment validation failed')
}

export { env }

/**
 * Helper to check if we're in production
 */
export const isProd = env.NODE_ENV === 'production'

/**
 * Helper to check if we're in development
 */
export const isDev = env.NODE_ENV === 'development'

/**
 * Helper to check if Redis is configured
 */
export const hasRedis = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN)

/**
 * Helper to check if Sentry is configured
 */
export const hasSentry = Boolean(env.SENTRY_DSN)

/**
 * Helper to check if Telegram is configured
 */
export const hasTelegram = Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ADMIN_CHAT_ID)

/**
 * Helper to check if Gemini AI is configured
 */
export const hasGemini = Boolean(env.GEMINI_API_KEY)

# DMED App - Architecture Documentation

## Table of Contents

- [System Overview](#system-overview)
- [Technology Stack](#technology-stack)
- [Architecture Layers](#architecture-layers)
- [Data Flow](#data-flow)
- [Database Schema](#database-schema)
- [API Design](#api-design)
- [Authentication & Authorization](#authentication--authorization)
- [File Storage & Sync](#file-storage--sync)
- [Notification System](#notification-system)
- [Performance Optimizations](#performance-optimizations)
- [Security](#security)
- [Monitoring & Observability](#monitoring--observability)
- [Deployment Architecture](#deployment-architecture)

---

## System Overview

DMED App is a full-stack document management and letter tracking system built with modern web technologies. The application follows a three-tier architecture:

```
┌─────────────────────────────────────────────────┐
│             Client (Browser)                    │
│  Next.js Frontend + React 19 + TanStack Query   │
└─────────────────┬───────────────────────────────┘
                  │ HTTPS
                  ▼
┌─────────────────────────────────────────────────┐
│          Application Server (Vercel)            │
│   Next.js 16 App Router + API Routes + tRPC    │
│   ┌──────────────┐  ┌────────────────────────┐ │
│   │ API Layer    │  │  Service Layer         │ │
│   │ - REST       │  │  - letter.service      │ │
│   │ - tRPC       │  │  - notification.service│ │
│   │ - Middleware │  │  - file.service        │ │
│   └──────┬───────┘  └────────┬───────────────┘ │
└──────────┼──────────────────┼──────────────────┘
           │                  │
           ▼                  ▼
┌────────────────────┐  ┌─────────────────────────┐
│  PostgreSQL DB     │  │  External Services      │
│  (Railway/Neon)    │  │  - Google Sheets/Drive  │
│  - Prisma ORM      │  │  - Telegram Bot         │
│  - Connection Pool │  │  - Gemini AI            │
└────────────────────┘  │  - Sentry               │
                        │  - Redis (Upstash)      │
                        └─────────────────────────┘
```

### Key Design Principles

1. **Separation of Concerns**: Clear boundaries between presentation, business logic, and data layers
2. **Type Safety**: End-to-end TypeScript with strict mode enabled
3. **Performance First**: N+1 query prevention, pagination, caching
4. **Security by Default**: CSRF protection, rate limiting, role-based access
5. **Observability**: Comprehensive logging, error tracking, health checks
6. **Scalability**: Stateless design, horizontal scaling support

---

## Technology Stack

### Frontend Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Framework | Next.js | 16.1.1 | Server & client rendering |
| UI Library | React | 19.2.3 | Component library |
| Language | TypeScript | 5.3.0 | Type safety |
| Styling | Tailwind CSS | 3.4.1 | Utility-first CSS |
| Components | Radix UI | Latest | Accessible primitives |
| State Management | TanStack Query | 5.90.16 | Server state |
| Forms | React Hook Form | 7.55.0 | Form management |
| Validation | Zod | 3.24.1 | Schema validation |
| Tables | TanStack Table | 8.21.3 | Data tables |

### Backend Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Runtime | Node.js | 20+ | JavaScript runtime |
| Framework | Next.js | 16.1.1 | API routes |
| Database | PostgreSQL | 14+ | Primary database |
| ORM | Prisma | 5.22.0 | Database access |
| Auth | NextAuth.js | 4.24.0 | Authentication |
| API | tRPC | 11.8.1 | Type-safe API |
| Validation | Zod | 3.24.1 | Input validation |
| Logging | Custom | - | Structured logging |

### Infrastructure

| Service | Provider | Purpose |
|---------|----------|---------|
| Hosting | Vercel | Application hosting |
| Database | Railway/Neon | PostgreSQL hosting |
| Caching | Upstash Redis | Session & rate limiting |
| Storage | Google Drive | File storage |
| Monitoring | Sentry | Error tracking |
| CI/CD | GitHub Actions | Automated testing |

---

## Architecture Layers

### 1. Presentation Layer (`src/app/`, `src/components/`)

**Responsibilities:**
- Rendering UI components
- Handling user interactions
- Client-side state management
- Form validation and submission

**Key Components:**
```
src/
├── app/
│   ├── (auth)/           # Protected routes
│   │   ├── dashboard/
│   │   ├── letters/
│   │   └── settings/
│   └── layout.tsx        # Root layout
├── components/
│   ├── ui/               # Reusable UI (buttons, modals)
│   ├── forms/            # Form components
│   ├── tables/           # Data tables
│   └── features/         # Feature-specific components
```

**Data Flow:**
```
User Action → Component → TanStack Query → API Call → Server
     ↑                                                    │
     └────────────────── Response ←──────────────────────┘
```

### 2. API Layer (`src/app/api/`, `src/lib/api-handler.ts`)

**Responsibilities:**
- Request validation
- Authentication & authorization
- Rate limiting
- CSRF protection
- Error handling
- Response formatting

**Handler Architecture:**

```typescript
// src/lib/create-handler.ts - Unified API handler wrapper
export function createHandler(config) {
  return withAuth(async (req, session) => {
    // 1. Validate request body (Zod schema)
    // 2. Check authentication
    // 3. Verify CSRF token
    // 4. Apply rate limiting
    // 5. Call business logic (service layer)
    // 6. Format & return response
  }, config)
}
```

**Example Usage:**
```typescript
// src/app/api/letters/[id]/route.ts
export const GET = createHandler({
  auth: 'required',
  rateLimit: 'default',
  handler: async ({ session, query }) => {
    const letter = await LetterService.getById(query.id)
    return NextResponse.json(letter)
  }
})
```

### 3. Service Layer (`src/services/`)

**Responsibilities:**
- Business logic encapsulation
- Database operations
- External API calls
- Data transformation
- Transaction management

**Service Pattern:**

```typescript
// src/services/letter.service.ts
export class LetterService {
  static async getById(id: string): Promise<Letter> {
    // 1. Validate input
    // 2. Check permissions
    // 3. Query database (via Prisma)
    // 4. Transform data
    // 5. Return result
  }
}
```

**Available Services:**
- `letter.service.ts` - Letter CRUD operations
- `notification.service.ts` - Notification management
- `file.service.ts` - File upload/download
- `user.service.ts` - User management

### 4. Data Layer (`prisma/`, `src/lib/prisma.ts`)

**Responsibilities:**
- Database schema definition
- Data access via Prisma ORM
- Query optimization
- Connection pooling

**Prisma Client Configuration:**

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.PRISMA_LOG_QUERIES ? ['query'] : [],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

---

## Data Flow

### Request Flow (Letter Creation Example)

```
┌─────────────┐
│   Client    │
│  Component  │
└──────┬──────┘
       │ 1. POST /api/letters
       │    { number, org, content }
       ▼
┌─────────────────────┐
│   API Handler       │
│  createHandler()    │
├─────────────────────┤
│ 2. Validate Schema  │ (Zod)
│ 3. Check Auth       │ (NextAuth session)
│ 4. Verify CSRF      │ (CSRF token)
│ 5. Rate Limit       │ (Redis/In-memory)
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Service Layer      │
│  LetterService      │
├─────────────────────┤
│ 6. Business Logic   │
│    - Sanitize input │
│    - Check duplicate│
│    - Set defaults   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│   Prisma ORM        │
├─────────────────────┤
│ 7. Transaction      │
│    - Insert Letter  │
│    - Create History │
│    - Auto-watch     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  PostgreSQL DB      │
├─────────────────────┤
│ 8. Store Data       │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Background Jobs    │
├─────────────────────┤
│ 9. Async Tasks      │
│    - Sync to Sheets │
│    - Send Notifs    │
│    - Index search   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Response           │
│  { success, letter }│
└─────────────────────┘
```

### Notification Flow

```
Event Trigger → dispatchNotification()
                      ↓
            ┌─────────┴─────────┐
            │  Get User Prefs   │ (from DB)
            └─────────┬─────────┘
                      ↓
            ┌─────────┴─────────┐
            │ Filter by Settings│ (quiet hours, channels)
            └─────────┬─────────┘
                      ↓
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
  ┌─────────┐  ┌──────────┐  ┌──────────┐
  │ In-App  │  │ Telegram │  │  Email   │
  │ (DB)    │  │  (API)   │  │ (SMTP)   │
  └─────────┘  └──────────┘  └──────────┘
```

---

## Database Schema

### Core Entities

```prisma
// Letter - Main document entity
model Letter {
  id           String   @id @default(cuid())
  number       String   @unique  // Letter number
  org          String               // Organization
  content      String?  @db.Text
  status       LetterStatus
  priority     Int      @default(0)

  // Relations
  owner        User     @relation("OwnedLetters")
  files        File[]
  comments     Comment[]
  watchers     Watcher[]
  history      History[]

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  deletedAt    DateTime? // Soft delete
}

// User - System user
model User {
  id                String   @id @default(cuid())
  email             String   @unique
  name              String?
  role              Role     @default(USER)
  tokenVersion      Int      @default(0) // For token invalidation

  // Notification settings
  notifyEmail       Boolean  @default(true)
  notifyTelegram    Boolean  @default(false)
  digestFrequency   DigestFrequency @default(INSTANT)

  // Relations
  ownedLetters      Letter[] @relation("OwnedLetters")
  comments          Comment[]
  notifications     Notification[]
}

// Comment - Threaded comments
model Comment {
  id        String   @id @default(cuid())
  text      String   @db.Text
  letterId  String
  authorId  String
  parentId  String?  // For nested replies

  letter    Letter   @relation(...)
  author    User     @relation(...)
  parent    Comment? @relation("CommentReplies")
  replies   Comment[] @relation("CommentReplies")

  createdAt DateTime @default(now())
}

// Notification - Multi-channel notifications
model Notification {
  id        String    @id @default(cuid())
  userId    String
  event     NotificationEventType
  title     String
  body      String?
  channel   NotificationChannel
  priority  NotificationPriority
  read      Boolean   @default(false)
  readAt    DateTime?
  letterId  String?
  actorId   String?   // Who triggered the notification
  metadata  Json?

  user      User      @relation(...)
  actor     User?     @relation(...)
  letter    Letter?   @relation(...)

  createdAt DateTime  @default(now())
}
```

### Enums

```prisma
enum Role {
  USER
  MODERATOR
  ADMIN
  SUPERADMIN
}

enum LetterStatus {
  NEW
  IN_PROGRESS
  PENDING
  COMPLETED
  ARCHIVED
}

enum NotificationChannel {
  IN_APP
  EMAIL
  TELEGRAM
  SMS
}

enum NotificationPriority {
  LOW
  NORMAL
  HIGH
  CRITICAL
}
```

### Database Indexes

```prisma
@@index([userId, read])      // Fast unread count
@@index([letterId, createdAt]) // Letter timeline
@@index([status, deletedAt])   // Active letters by status
@@index([ownerId, createdAt])  // User's letters
```

---

## API Design

### REST API Conventions

**URL Structure:**
```
/api/{resource}/{id?}/{action?}
```

**Examples:**
- `GET /api/letters` - List letters
- `GET /api/letters/abc123` - Get specific letter
- `POST /api/letters` - Create letter
- `PATCH /api/letters/abc123` - Update letter
- `GET /api/letters/abc123/comments` - Get letter comments

**Response Format:**

Success:
```json
{
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "hasMore": true
  }
}
```

Error:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "statusCode": 400
}
```

### tRPC API

**Router Structure:**

```typescript
// src/server/routers/_app.ts
export const appRouter = router({
  letter: letterRouter,
  notification: notificationRouter,
  user: userRouter,
})

// src/server/routers/letter.ts
export const letterRouter = router({
  list: protectedProcedure
    .input(z.object({ page: z.number(), limit: z.number() }))
    .query(async ({ input }) => {
      return LetterService.list(input)
    }),

  getById: protectedProcedure
    .input(z.string())
    .query(async ({ input }) => {
      return LetterService.getById(input)
    }),
})
```

**Benefits:**
- End-to-end type safety
- Automatic client generation
- No manual API documentation needed
- Built-in input validation

---

## Authentication & Authorization

### NextAuth.js Configuration

```typescript
// src/lib/auth.ts
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      // Add custom fields to session
      session.user.id = token.sub!
      session.user.role = await getUserRole(token.sub!)
      return session
    },
    async jwt({ token, user }) {
      // Validate token version
      const dbUser = await prisma.user.findUnique({
        where: { id: token.sub },
        select: { tokenVersion: true },
      })

      if (token.version < dbUser.tokenVersion) {
        // Token invalidated - force re-login
        return null
      }

      return token
    },
  },
}
```

### Role-Based Access Control (RBAC)

**Permission Matrix:**

| Permission | USER | MODERATOR | ADMIN | SUPERADMIN |
|-----------|------|-----------|-------|------------|
| VIEW_LETTERS | ✓ | ✓ | ✓ | ✓ |
| CREATE_LETTERS | ✓ | ✓ | ✓ | ✓ |
| EDIT_OWN_LETTERS | ✓ | ✓ | ✓ | ✓ |
| EDIT_ALL_LETTERS | ✗ | ✓ | ✓ | ✓ |
| DELETE_LETTERS | ✗ | ✗ | ✓ | ✓ |
| MANAGE_USERS | ✗ | ✗ | ✓ | ✓ |
| MANAGE_ROLES | ✗ | ✗ | ✗ | ✓ |

**Implementation:**

```typescript
// src/lib/permissions.ts
export function hasPermission(role: Role, action: string): boolean {
  return PERMISSIONS[role]?.includes(action) ?? false
}

// Usage in API
export const DELETE = createHandler({
  auth: 'required',
  minRole: 'ADMIN',
  handler: async ({ session }) => {
    // Only ADMIN and SUPERADMIN can access
  }
})
```

### Token Invalidation

**Force logout from all devices:**

```typescript
// Increment tokenVersion in database
await prisma.user.update({
  where: { id: userId },
  data: { tokenVersion: { increment: 1 } }
})

// Next request with old token will fail
```

---

## File Storage & Sync

### Upload Flow

```
┌──────────────┐
│   Client     │
│  File Upload │
└──────┬───────┘
       │ 1. POST /api/upload
       │    FormData: file, letterId
       ▼
┌──────────────────┐
│  File Validation │
├──────────────────┤
│ - Check size     │ (< 10MB)
│ - Check type     │ (PDF, DOC, IMG)
│ - Check auth     │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Local Storage   │
├──────────────────┤
│ - Save to disk   │ (./uploads/)
│ - Generate ID    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Database Record │
├──────────────────┤
│ - Create File    │
│ - Status: PENDING│
└──────┬───────────┘
       │
       ├─── Sync Strategy ───┐
       │                     │
       ▼                     ▼
┌──────────────┐    ┌────────────────┐
│ Async Upload │    │  Sync Upload   │
│ (Background) │    │  (Immediate)   │
└──────┬───────┘    └────────┬───────┘
       │                     │
       └──────────┬──────────┘
                  │
                  ▼
       ┌──────────────────┐
       │  Google Drive    │
       │  Upload API      │
       └──────┬───────────┘
              │
              ▼
       ┌──────────────────┐
       │ Update Status    │
       │ SYNCED / FAILED  │
       └──────────────────┘
```

### Storage Providers

```typescript
enum FileStorageProvider {
  LOCAL      // Temporary local storage
  DRIVE      // Google Drive (primary)
}

enum FileStatus {
  PENDING_SYNC   // Uploaded locally, queued for Drive
  SYNCED         // Successfully synced to Drive
  SYNC_FAILED    // Drive upload failed
}
```

### Retry Logic

```typescript
// src/lib/file-sync.ts
export async function syncFileToDrive(fileId: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const driveUrl = await uploadToDrive(fileId)
      await updateFileStatus(fileId, 'SYNCED', driveUrl)
      return
    } catch (error) {
      if (i === retries - 1) {
        await updateFileStatus(fileId, 'SYNC_FAILED')
        throw error
      }
      await sleep(1000 * Math.pow(2, i)) // Exponential backoff
    }
  }
}
```

---

## Notification System

### Multi-Channel Dispatcher

```typescript
// src/lib/notification-dispatcher.ts
export async function dispatchNotification(input) {
  // 1. Get user preferences
  const settings = await getUserNotificationSettings(input.userId)

  // 2. Check quiet hours
  if (isWithinQuietHours(settings)) {
    await queueForDigest(input)
    return
  }

  // 3. Dispatch to enabled channels
  const channels = getEnabledChannels(settings, input.event)

  await Promise.all([
    channels.includes('IN_APP') && createInAppNotification(input),
    channels.includes('EMAIL') && sendEmail(input),
    channels.includes('TELEGRAM') && sendTelegram(input),
    channels.includes('SMS') && sendSMS(input),
  ])
}
```

### Notification Settings

```typescript
interface NotificationSettings {
  // Channel toggles
  inAppNotifications: boolean
  emailNotifications: boolean
  telegramNotifications: boolean
  smsNotifications: boolean

  // Event-specific settings
  notifyOnNewLetter: boolean
  notifyOnComment: boolean
  notifyOnStatusChange: boolean
  notifyOnAssignment: boolean
  notifyOnDeadline: boolean

  // Quiet hours
  quietHoursEnabled: boolean
  quietHoursStart: string // "22:00"
  quietHoursEnd: string   // "08:00"

  // Digest settings
  emailDigest: 'instant' | 'daily' | 'weekly'
}
```

### Deduplication

Prevent duplicate notifications:

```typescript
const dedupeKey = `${event}:${letterId}:${userId}`
const existing = await redis.get(dedupeKey)

if (existing) {
  return // Skip duplicate
}

await redis.set(dedupeKey, '1', 'EX', 300) // 5 min window
await sendNotification(...)
```

---

## Performance Optimizations

### 1. N+1 Query Prevention

**Before:**
```typescript
// ❌ N+1 Problem - 1 + N queries
const letters = await prisma.letter.findMany()
for (const letter of letters) {
  letter.owner = await prisma.user.findUnique({
    where: { id: letter.ownerId }
  })
}
```

**After:**
```typescript
// ✅ Single query with join
const letters = await prisma.letter.findMany({
  include: {
    owner: true
  }
})
```

### 2. Pagination

All list endpoints use cursor or offset pagination:

```typescript
export const GET = createHandler({
  querySchema: z.object({
    page: z.number().default(1),
    limit: z.number().max(100).default(20),
  }),
  handler: async ({ query }) => {
    const skip = (query.page - 1) * query.limit

    const [items, total] = await Promise.all([
      prisma.letter.findMany({
        take: query.limit,
        skip,
      }),
      prisma.letter.count(),
    ])

    return { items, total, hasMore: skip + items.length < total }
  }
})
```

### 3. Database Indexes

Strategic indexes for common queries:

```prisma
model Letter {
  @@index([status, deletedAt])      // Filter active by status
  @@index([ownerId, createdAt])     // User's recent letters
  @@index([createdAt(sort: Desc)])  // Recent letters
}

model Notification {
  @@index([userId, read, createdAt]) // Unread notifications
}
```

### 4. Caching Strategy

**Session Caching (Redis):**
```typescript
// Store session in Redis for fast lookup
await redis.set(`session:${sessionId}`, JSON.stringify(session), 'EX', 3600)
```

**Rate Limit Caching:**
```typescript
// Track API calls per user
const key = `ratelimit:${userId}:${endpoint}`
const count = await redis.incr(key)
if (count === 1) await redis.expire(key, 900) // 15 min window
if (count > limit) throw new RateLimitError()
```

### 5. Query Optimization

**Select only needed fields:**
```typescript
// ❌ Fetches all fields
const user = await prisma.user.findUnique({ where: { id } })

// ✅ Fetch only needed fields
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, name: true, email: true }
})
```

---

## Security

### 1. CSRF Protection

```typescript
// src/lib/security.ts
export function csrfGuard(req: NextRequest) {
  const token = req.headers.get('x-csrf-token')
  const sessionToken = await getSessionToken(req)

  if (!token || token !== sessionToken) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
  }
}
```

### 2. Rate Limiting

```typescript
const RATE_LIMITS = {
  default: { requests: 100, window: 900 },    // 100/15min
  strict: { requests: 10, window: 900 },      // 10/15min
  generous: { requests: 1000, window: 900 },  // 1000/15min
}

export const rateLimit = async (userId: string, tier: keyof typeof RATE_LIMITS) => {
  const { requests, window } = RATE_LIMITS[tier]
  const key = `ratelimit:${userId}`

  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, window)

  if (count > requests) {
    throw new RateLimitError()
  }
}
```

### 3. Input Sanitization

```typescript
// src/lib/utils.ts
export function sanitizeInput(input: string, maxLength: number): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove HTML tags
}
```

### 4. SQL Injection Prevention

**Prisma ORM** automatically prevents SQL injection by using parameterized queries.

**Manual validation for dynamic fields:**
```typescript
const ALLOWED_FIELDS = ['status', 'priority', 'owner'] as const
if (!ALLOWED_FIELDS.includes(field)) {
  throw new Error('Invalid field')
}
```

### 5. Environment Variable Validation

```typescript
// src/lib/env.validation.ts
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  // ... all required vars
})

export const env = envSchema.parse(process.env)
```

---

## Monitoring & Observability

### 1. Structured Logging

```typescript
// src/lib/logger.server.ts
logger.info('letter.created', {
  letterId: letter.id,
  userId: session.user.id,
  duration: Date.now() - startTime,
})

logger.error('database.query.failed', error, {
  query: 'findUnique',
  table: 'Letter',
  id: letterId,
})
```

### 2. Performance Tracking

```typescript
const startTime = logger.startTimer()
const result = await performOperation()
logger.performance('operation.name', 'Operation completed', startTime, {
  metadata: { ... }
})
```

### 3. Health Checks

```typescript
// GET /api/health
export async function GET(request: Request) {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    memory: checkMemory(),
    externalServices: await checkExternal(),
  }

  const status = Object.values(checks).every(c => c.status === 'ok')
    ? 'healthy'
    : 'degraded'

  return NextResponse.json({ status, checks, timestamp: new Date() })
}
```

### 4. Sentry Integration

```typescript
// src/instrumentation.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  tracesSampleRate: 1.0,
  integrations: [
    new Sentry.Integrations.Prisma({ client: prisma }),
  ],
})
```

### 5. Metrics to Monitor

- **Application Metrics:**
  - Request rate (requests/sec)
  - Error rate (errors/sec)
  - Response time (p50, p95, p99)
  - Active users

- **Database Metrics:**
  - Query duration
  - Connection pool usage
  - Slow query count

- **Business Metrics:**
  - Letters created/day
  - Active letters by status
  - User engagement (comments, views)

---

## Deployment Architecture

### Production Stack

```
                    ┌──────────────┐
                    │   Cloudflare │
                    │   CDN + DNS  │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │    Vercel    │
                    │   Edge/CDN   │
                    └──────┬───────┘
                           │
                ┌──────────┼──────────┐
                ▼          ▼          ▼
         ┌──────────┐ ┌────────┐ ┌────────┐
         │ Next.js  │ │ Next.js│ │Next.js │
         │ Instance │ │Instance│ │Instance│
         └────┬─────┘ └───┬────┘ └───┬────┘
              │           │           │
              └───────────┼───────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │PostgreSQL│   │  Upstash │   │  Google  │
    │ (Railway)│   │  Redis   │   │  APIs    │
    └──────────┘   └──────────┘   └──────────┘
```

### Environment Configuration

**Development:**
- Local PostgreSQL
- In-memory rate limiting
- Local file storage
- Debug logging enabled

**Staging:**
- Cloud PostgreSQL (Railway)
- Redis caching (Upstash)
- Google Drive storage
- Sentry error tracking
- Same as production config

**Production:**
- Cloud PostgreSQL with replicas
- Redis for caching & sessions
- Google Drive + CDN
- Sentry monitoring
- Strict rate limiting
- Automated backups

### Scaling Strategy

**Horizontal Scaling:**
- Vercel automatically scales instances
- Stateless design (no in-memory sessions)
- Database connection pooling

**Database Scaling:**
- Read replicas for heavy read operations
- Connection pooling (max 10-20 per instance)
- Query optimization & indexing

**Caching Strategy:**
- Redis for sessions (1 hour TTL)
- CDN for static assets
- API response caching for public endpoints

### Backup Strategy

**Database Backups:**
- Daily automated backups (Railway)
- 30-day retention
- Point-in-time recovery enabled

**File Backups:**
- Files stored in Google Drive (redundant)
- Local copies retained for 7 days
- Failed syncs retried automatically

---

## Future Improvements

### Planned Enhancements

1. **Microservices Migration**
   - Extract notification service
   - Separate file processing service
   - Event-driven architecture (Kafka/RabbitMQ)

2. **Advanced Search**
   - Full-text search (Elasticsearch/Algolia)
   - Faceted filtering
   - Search analytics

3. **Real-time Features**
   - WebSocket for live updates
   - Collaborative editing
   - Live presence indicators

4. **Analytics Dashboard**
   - Usage metrics
   - Performance trends
   - Business intelligence

5. **Mobile Application**
   - React Native app
   - Push notifications
   - Offline support

---

**Last Updated**: January 2026
**Version**: 1.0.0
**Maintainers**: DMED Development Team

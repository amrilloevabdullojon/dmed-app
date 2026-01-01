# Анализ и рекомендации по улучшению DMED Letters

## Обзор проекта

**DMED Letters** — полноценное приложение для управления документами/письмами на Next.js 14 с TypeScript, Prisma ORM и PostgreSQL. Проект хорошо структурирован, но есть области для улучшения.

---

## 🔴 Критические улучшения (Безопасность)

### 1. Отсутствие rate limiting на API маршрутах

**Проблема:** Rate limiting реализован только для авторизации (`src/lib/auth.ts:26-43`), но отсутствует на других API endpoints.

**Решение:**
```typescript
// src/lib/rate-limit.ts
import { LRUCache } from 'lru-cache'

type Options = {
  uniqueTokenPerInterval?: number
  interval?: number
}

export function rateLimit(options?: Options) {
  const tokenCache = new LRUCache({
    max: options?.uniqueTokenPerInterval || 500,
    ttl: options?.interval || 60000,
  })

  return {
    check: (limit: number, token: string) =>
      new Promise<void>((resolve, reject) => {
        const tokenCount = (tokenCache.get(token) as number[]) || [0]
        if (tokenCount[0] === 0) {
          tokenCache.set(token, [1])
        }
        tokenCount[0] += 1

        const currentUsage = tokenCount[0]
        const isRateLimited = currentUsage >= limit
        if (isRateLimited) reject()
        else resolve()
      }),
  }
}
```

### 2. Типизация `any` в API маршрутах

**Проблема:** В `src/app/api/letters/route.ts:83` используется `any` для фильтров.

**Решение:**
```typescript
// Заменить:
const where: any = { deletedAt: null }

// На:
import type { Prisma } from '@prisma/client'
const where: Prisma.LetterWhereInput = { deletedAt: null }
```

### 3. Валидация токенов портала

**Проблема:** Токены портала (`applicantAccessToken`) не валидируются на истечение срока в middleware.

**Решение:** Добавить проверку `applicantAccessTokenExpiresAt` перед предоставлением доступа к порталу.

---

## 🟠 Важные улучшения (Производительность)

### 4. N+1 проблема в сессии

**Проблема:** В `src/lib/auth.ts:89-107` выполняется дополнительный запрос к БД при каждом запросе сессии.

**Решение:** Кэшировать роль и аватар в JWT токене или использовать Redis для кэширования.

```typescript
// Использовать JWT стратегию вместо database
session: {
  strategy: 'jwt',
},
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, profile: { select: { avatarUrl: true } } },
      })
      token.role = dbUser?.role
      token.avatarUrl = dbUser?.profile?.avatarUrl
    }
    return token
  },
  async session({ session, token }) {
    session.user.role = token.role
    session.user.image = token.avatarUrl || session.user.image
    return session
  },
}
```

### 5. Отсутствует индекс для полнотекстового поиска

**Проблема:** Поиск в `src/app/api/letters/route.ts:118-128` использует `contains` по нескольким полям без индексов.

**Решение:** Добавить в `schema.prisma`:
```prisma
model Letter {
  // ... существующие поля

  @@index([number, org]) // Составной индекс для часто используемых полей
  // Или использовать PostgreSQL full-text search
}
```

### 6. Загрузка компонента Header

**Проблема:** В `src/components/Header.tsx` используется `useSession()` что вызывает re-render при каждом изменении сессии.

**Решение:**
```typescript
// Использовать selective subscription
const { data: session } = useSession({
  required: false,
  onUnauthenticated() {},
})

// Мемоизировать компоненты навигации
const MemoizedNav = useMemo(() => (
  <nav>...</nav>
), [pathname, session?.user?.role])
```

### 7. Отсутствует debounce для поиска

**Проблема:** При каждом изменении поискового запроса отправляется запрос к API.

**Решение:**
```typescript
// src/hooks/useDebounce.ts
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}
```

---

## 🟡 Улучшения кода (Качество)

### 8. Дублирование кода авторизации

**Проблема:** Проверка сессии повторяется в каждом API route:
```typescript
const session = await getServerSession(authOptions)
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

**Решение:** Создать middleware или wrapper:
```typescript
// src/lib/api-handler.ts
export function withAuth<T>(
  handler: (req: NextRequest, session: Session) => Promise<NextResponse<T>>
) {
  return async (req: NextRequest) => {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return handler(req, session)
  }
}

// Использование:
export const GET = withAuth(async (req, session) => {
  // логика
})
```

### 9. Магические числа и строки

**Проблема:** Хардкоженные значения разбросаны по коду:
- `src/app/api/letters/route.ts:243` — 90 дней для токена
- `src/lib/auth.ts:24` — 15 минут для rate limit
- `src/app/api/letters/route.ts:80` — лимит пагинации 50

**Решение:** Вынести в константы:
```typescript
// src/lib/constants.ts
export const PORTAL_TOKEN_EXPIRY_DAYS = 90
export const RATE_LIMIT_WINDOW_MINUTES = 15
export const DEFAULT_PAGE_LIMIT = 50
export const MAX_LOGIN_ATTEMPTS = 5
```

### 10. Обработка ошибок

**Проблема:** Ошибки логируются в консоль без структурирования:
```typescript
console.error('GET /api/letters error:', error)
```

**Решение:** Создать централизованный логгер:
```typescript
// src/lib/logger.ts
type LogLevel = 'info' | 'warn' | 'error'

export const logger = {
  error: (context: string, error: unknown, meta?: Record<string, unknown>) => {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined

    console.error(JSON.stringify({
      level: 'error',
      context,
      message,
      stack,
      timestamp: new Date().toISOString(),
      ...meta,
    }))
  },
  // ...
}
```

### 11. Отсутствуют unit тесты

**Проблема:** В проекте нет тестов.

**Решение:** Добавить Jest + React Testing Library:
```bash
npm install -D jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom
```

```typescript
// src/lib/__tests__/utils.test.ts
import { formatDate, getDaysUntilDeadline, sanitizeInput } from '../utils'

describe('formatDate', () => {
  it('formats ISO date correctly', () => {
    expect(formatDate('2024-01-15')).toBe('15.01.2024')
  })

  it('handles null', () => {
    expect(formatDate(null)).toBe('')
  })
})

describe('sanitizeInput', () => {
  it('escapes HTML', () => {
    expect(sanitizeInput('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    )
  })
})
```

---

## 🟢 Рекомендуемые улучшения (DX)

### 12. Добавить Prettier

**Решение:**
```bash
npm install -D prettier eslint-config-prettier
```

```json
// .prettierrc
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

### 13. Добавить pre-commit hooks

```bash
npm install -D husky lint-staged
npx husky install
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"]
  }
}
```

### 14. Docker для разработки

```dockerfile
# docker-compose.yml
version: '3.8'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: dmed
      POSTGRES_PASSWORD: dmed
      POSTGRES_DB: dmed_letters
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### 15. Миграции вместо db push

**Проблема:** Используется `prisma db push` вместо миграций.

**Решение:** Перейти на миграции для production:
```bash
npx prisma migrate dev --name init
```

---

## 🔧 Архитектурные улучшения

### 16. Разделение слоёв (Service Layer)

**Проблема:** Бизнес-логика смешана с API handlers.

**Решение:**
```typescript
// src/services/letter.service.ts
export class LetterService {
  static async create(data: CreateLetterDTO, userId: string): Promise<Letter> {
    // валидация
    // бизнес-логика
    // создание записи
    // уведомления
  }

  static async findById(id: string): Promise<Letter | null> {
    return prisma.letter.findUnique({
      where: { id },
      include: { owner: true, files: true },
    })
  }
}

// В API route:
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const data = await request.json()
  const letter = await LetterService.create(data, session.user.id)
  return NextResponse.json({ success: true, letter })
}
```

### 17. DTO и Response types

```typescript
// src/types/dto.ts
export interface CreateLetterDTO {
  number: string
  org: string
  date: string
  deadlineDate?: string
  type?: string
  content?: string
}

export interface LetterResponse {
  id: string
  number: string
  org: string
  status: LetterStatus
  owner: UserSummary | null
  // ...
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
```

### 18. Использование Zod схем повторно

```typescript
// src/schemas/letter.schema.ts
import { z } from 'zod'

export const createLetterSchema = z.object({
  number: z.string().min(1).max(50),
  org: z.string().min(1).max(500),
  date: z.string().transform((val) => new Date(val)),
  // ...
})

export const updateLetterSchema = createLetterSchema.partial()

export type CreateLetterInput = z.infer<typeof createLetterSchema>
export type UpdateLetterInput = z.infer<typeof updateLetterSchema>
```

---

## 📊 Приоритеты внедрения

| Приоритет | Улучшение | Сложность | Влияние |
|-----------|-----------|-----------|---------|
| 1 | Rate limiting для API | Средняя | Высокое |
| 2 | Типизация вместо `any` | Низкая | Среднее |
| 3 | Кэширование сессии | Средняя | Высокое |
| 4 | Unit тесты | Высокая | Высокое |
| 5 | Service Layer | Высокая | Высокое |
| 6 | Централизованная обработка ошибок | Низкая | Среднее |
| 7 | Константы вместо magic numbers | Низкая | Низкое |
| 8 | Prettier + Husky | Низкая | Среднее |

---

## Заключение

Проект имеет хорошую основу и структуру. Основные области для улучшения:

1. **Безопасность** — rate limiting, валидация токенов
2. **Производительность** — кэширование, индексы БД, debounce
3. **Качество кода** — типизация, тесты, service layer
4. **Developer Experience** — линтинг, форматирование, Docker

Рекомендую начать с критических улучшений безопасности, затем перейти к производительности и качеству кода.

# tRPC Integration Guide

## 🚀 Что такое tRPC?

tRPC - это фреймворк для создания type-safe API без кодогенерации. Он обеспечивает полную типобезопасность между клиентом и сервером.

## 📁 Структура файлов

```
src/
├── server/                         # Server-side код
│   ├── trpc.ts                    # Базовая конфигурация tRPC
│   └── routers/
│       ├── _app.ts                # Главный роутер
│       └── letters.ts             # Роутер для писем
├── app/
│   └── api/
│       └── trpc/
│           └── [trpc]/
│               └── route.ts       # Next.js API handler
└── lib/
    └── trpc/
        ├── index.ts               # Public exports
        ├── client.ts              # tRPC client
        └── Provider.tsx           # React Provider
```

## 🔧 Основные концепции

### 1. Процедуры (Procedures)

**Public Procedure** - доступна всем:
```typescript
export const publicProcedure = t.procedure
```

**Protected Procedure** - требует авторизации:
```typescript
export const protectedProcedure = t.procedure.use(isAuthed)
```

**Admin Procedure** - только для админов:
```typescript
export const adminProcedure = protectedProcedure.use(isAdmin)
```

### 2. Queries vs Mutations

**Query** - для чтения данных (GET):
```typescript
getAll: protectedProcedure
  .input(getLettersInputSchema)
  .query(async ({ ctx, input }) => {
    return await ctx.prisma.letter.findMany({ ... })
  })
```

**Mutation** - для изменения данных (POST/PUT/DELETE):
```typescript
create: protectedProcedure
  .input(createLetterInputSchema)
  .mutation(async ({ ctx, input }) => {
    return await ctx.prisma.letter.create({ ... })
  })
```

### 3. Валидация с Zod

```typescript
const inputSchema = z.object({
  number: z.string().min(1),
  org: z.string().min(1),
  status: z.enum(['NOT_REVIEWED', 'ACCEPTED', ...]),
})
```

## 💻 Использование на клиенте

### Setup - добавить Provider

В `src/app/layout.tsx`:
```tsx
import { TRPCProvider } from '@/lib/trpc'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <TRPCProvider>
          {children}
        </TRPCProvider>
      </body>
    </html>
  )
}
```

### Queries - получение данных

```tsx
'use client'
import { trpc } from '@/lib/trpc'

function MyComponent() {
  // Простой query
  const { data, isLoading, error } = trpc.letters.getAll.useQuery({
    status: 'IN_PROGRESS',
    limit: 10,
  })

  // С параметрами
  const { data: letter } = trpc.letters.getById.useQuery({
    id: 'letter-123'
  })

  // Условный query (enabled)
  const { data } = trpc.letters.getById.useQuery(
    { id: letterId },
    { enabled: !!letterId }
  )

  return <div>{/* ... */}</div>
}
```

### Mutations - изменение данных

```tsx
function CreateLetterForm() {
  const utils = trpc.useUtils()

  const createMutation = trpc.letters.create.useMutation({
    onSuccess: () => {
      // Инвалидировать кеш
      utils.letters.getAll.invalidate()

      // Или оптимистичное обновление
      utils.letters.getAll.setData(
        { status: 'IN_PROGRESS' },
        (oldData) => [...(oldData?.letters || []), newLetter]
      )
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = (data) => {
    createMutation.mutate(data)
  }

  return (
    <button
      onClick={() => handleSubmit(formData)}
      disabled={createMutation.isPending}
    >
      {createMutation.isPending ? 'Создание...' : 'Создать'}
    </button>
  )
}
```

### Инвалидация кеша

```tsx
const utils = trpc.useUtils()

// Инвалидировать все letters queries
utils.letters.invalidate()

// Инвалидировать конкретный query
utils.letters.getAll.invalidate()

// Инвалидировать с конкретными параметрами
utils.letters.getAll.invalidate({ status: 'IN_PROGRESS' })
```

## 🏗️ Добавление нового роутера

### 1. Создать роутер

```typescript
// src/server/routers/users.ts
import { z } from 'zod'
import { router, protectedProcedure, adminProcedure } from '../trpc'

export const usersRouter = router({
  getAll: adminProcedure.query(async ({ ctx }) => {
    return await ctx.prisma.user.findMany()
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.prisma.user.findUnique({
        where: { id: input.id }
      })
    }),

  update: adminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      email: z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      return await ctx.prisma.user.update({
        where: { id },
        data,
      })
    }),
})
```

### 2. Добавить в главный роутер

```typescript
// src/server/routers/_app.ts
import { usersRouter } from './users'

export const appRouter = router({
  letters: lettersRouter,
  users: usersRouter, // ← добавить
})
```

### 3. Использовать на клиенте

```tsx
const { data: users } = trpc.users.getAll.useQuery()
```

## 🎯 Best Practices

### 1. Использовать Zod схемы

Переиспользуйте схемы валидации:
```typescript
// lib/schemas.ts
export const letterSchema = z.object({
  number: z.string().min(1),
  org: z.string().min(1),
  // ...
})

// server/routers/letters.ts
import { letterSchema } from '@/lib/schemas'

create: protectedProcedure
  .input(letterSchema)
  .mutation(...)
```

### 2. Пагинация

```typescript
getAll: protectedProcedure
  .input(z.object({
    limit: z.number().min(1).max(100).default(50),
    cursor: z.string().optional(),
  }))
  .query(async ({ input }) => {
    const { limit, cursor } = input

    const items = await prisma.letter.findMany({
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
    })

    let nextCursor: string | undefined = undefined
    if (items.length > limit) {
      const next = items.pop()
      nextCursor = next!.id
    }

    return { items, nextCursor }
  })
```

Использование:
```tsx
const { data, fetchNextPage, hasNextPage } =
  trpc.letters.getAll.useInfiniteQuery(
    { limit: 20 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  )
```

### 3. Error Handling

```typescript
// Server
if (!letter) {
  throw new TRPCError({
    code: 'NOT_FOUND',
    message: 'Письмо не найдено',
  })
}

// Client
const mutation = trpc.letters.create.useMutation({
  onError: (error) => {
    if (error.data?.code === 'UNAUTHORIZED') {
      router.push('/login')
    } else {
      toast.error(error.message)
    }
  }
})
```

### 4. Optimistic Updates

```tsx
const utils = trpc.useUtils()

const deleteMutation = trpc.letters.delete.useMutation({
  onMutate: async ({ id }) => {
    // Отменить outgoing refetches
    await utils.letters.getAll.cancel()

    // Snapshot предыдущего значения
    const previousData = utils.letters.getAll.getData()

    // Optimistically update
    utils.letters.getAll.setData(undefined, (old) => ({
      ...old,
      letters: old?.letters.filter(l => l.id !== id) || []
    }))

    return { previousData }
  },
  onError: (err, variables, context) => {
    // Откатить при ошибке
    utils.letters.getAll.setData(undefined, context?.previousData)
  },
  onSettled: () => {
    // Refetch после success или error
    utils.letters.getAll.invalidate()
  },
})
```

## 📚 Дополнительные ресурсы

- [tRPC Docs](https://trpc.io)
- [React Query Docs](https://tanstack.com/query)
- [Zod Docs](https://zod.dev)

## 🔍 Troubleshooting

### Типы не обновляются

1. Перезапустите TypeScript сервер в IDE
2. Проверьте, что `AppRouter` экспортирован правильно
3. Убедитесь что `trpc.createClient` вызывается с правильным типом

### CORS ошибки

Добавьте headers в `httpBatchLink`:
```typescript
httpBatchLink({
  url: '/api/trpc',
  headers: {
    'x-trpc-source': 'client',
  },
})
```

### "Cannot read property of undefined"

Убедитесь что `TRPCProvider` обернул ваше приложение в layout.tsx

/**
 * tRPC Server Configuration
 *
 * Базовая настройка tRPC сервера с:
 * - Context для доступа к сессии и Prisma
 * - Middleware для авторизации
 * - Публичные и защищенные процедуры
 */

import { initTRPC, TRPCError } from '@trpc/server'
import { type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import superjson from 'superjson'
import type { Session } from 'next-auth'

/**
 * Создание контекста для каждого запроса
 */
export async function createContext(opts: { req: NextRequest }) {
  const session = await getServerSession(authOptions)

  return {
    session,
    prisma,
    req: opts.req,
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>

/**
 * Инициализация tRPC
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson, // Поддержка Date, Map, Set, etc.
  errorFormatter({ shape }) {
    return shape
  },
})

/**
 * Экспорт базовых строительных блоков
 */
export const router = t.router
export const middleware = t.middleware
export const publicProcedure = t.procedure

/**
 * Middleware для проверки авторизации
 */
const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  return next({
    ctx: {
      ...ctx,
      session: { ...ctx.session, user: ctx.session.user },
    },
  })
})

/**
 * Middleware для проверки прав доступа
 */
const hasPermission = (permission: string) =>
  middleware(async ({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }

    // Проверка прав (упрощенная версия, адаптируйте под вашу систему)
    const userRole = ctx.session.user.role
    // TODO: Добавить полноценную проверку через hasPermission из @/lib/permissions

    return next({
      ctx: {
        ...ctx,
        session: ctx.session,
      },
    })
  })

/**
 * Защищенная процедура (требует авторизации)
 */
export const protectedProcedure = t.procedure.use(isAuthed)

/**
 * Процедура с проверкой прав администратора
 */
export const adminProcedure = protectedProcedure.use(
  middleware(async ({ ctx, next }) => {
    // ctx.session гарантированно определена после protectedProcedure
    if (!ctx.session?.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }

    if (ctx.session.user.role !== 'ADMIN' && ctx.session.user.role !== 'SUPERADMIN') {
      throw new TRPCError({ code: 'FORBIDDEN' })
    }
    return next({ ctx })
  })
)

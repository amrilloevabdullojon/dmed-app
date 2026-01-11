/**
 * Users Router - tRPC роутер для управления пользователями
 */

import { z } from 'zod'
import { router, protectedProcedure, adminProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import type { Role } from '@prisma/client'

// Zod схемы
const getUsersInputSchema = z.object({
  role: z.enum(['SUPERADMIN', 'ADMIN', 'MANAGER', 'AUDITOR', 'EMPLOYEE', 'VIEWER']).optional(),
  search: z.string().optional(),
  canLogin: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
})

const updateUserInputSchema = z.object({
  id: z.string(),
  data: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    role: z.enum(['SUPERADMIN', 'ADMIN', 'MANAGER', 'AUDITOR', 'EMPLOYEE', 'VIEWER']).optional(),
    canLogin: z.boolean().optional(),
    notifyEmail: z.boolean().optional(),
    notifyTelegram: z.boolean().optional(),
    notifySms: z.boolean().optional(),
    notifyInApp: z.boolean().optional(),
  }),
})

const updateProfileInputSchema = z.object({
  userId: z.string(),
  data: z.object({
    bio: z.string().optional(),
    phone: z.string().optional(),
    position: z.string().optional(),
    department: z.string().optional(),
    location: z.string().optional(),
    timezone: z.string().optional(),
    skills: z.array(z.string()).optional(),
  }),
})

export const usersRouter = router({
  /**
   * Получить список пользователей (только для админов)
   */
  getAll: adminProcedure
    .input(getUsersInputSchema)
    .query(async ({ ctx, input }) => {
      const { role, search, canLogin, limit, cursor } = input

      const where: any = {}

      if (role) {
        where.role = role
      }

      if (canLogin !== undefined) {
        where.canLogin = canLogin
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ]
      }

      const users = await ctx.prisma.user.findMany({
        where,
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          canLogin: true,
          image: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              letters: true,
              comments: true,
            },
          },
        },
      })

      let nextCursor: string | undefined = undefined
      if (users.length > limit) {
        const nextItem = users.pop()
        nextCursor = nextItem!.id
      }

      return {
        users,
        nextCursor,
      }
    }),

  /**
   * Получить текущего пользователя
   */
  getCurrentUser: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }

    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      include: {
        profile: true,
        _count: {
          select: {
            letters: true,
            comments: true,
            watchers: true,
            favorites: true,
          },
        },
      },
    })

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Пользователь не найден',
      })
    }

    return user
  }),

  /**
   * Получить пользователя по ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.id },
        include: {
          profile: true,
          _count: {
            select: {
              letters: true,
              comments: true,
            },
          },
        },
      })

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Пользователь не найден',
        })
      }

      return user
    }),

  /**
   * Обновить пользователя (только админы)
   */
  update: adminProcedure
    .input(updateUserInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      const { id, data } = input

      // Проверить существование
      const existing = await ctx.prisma.user.findUnique({
        where: { id },
      })

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Пользователь не найден',
        })
      }

      // Нельзя понизить себя
      if (id === ctx.session.user.id && data.role && data.role !== existing.role) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Нельзя изменить свою роль',
        })
      }

      // Обновить
      const updated = await ctx.prisma.user.update({
        where: { id },
        data,
        include: {
          profile: true,
        },
      })

      // Записать в audit
      for (const [field, value] of Object.entries(data)) {
        if (value !== undefined) {
          await ctx.prisma.userAudit.create({
            data: {
              userId: id,
              actorId: ctx.session.user.id,
              action: 'UPDATE',
              field,
              oldValue: String((existing as any)[field] || ''),
              newValue: String(value),
            },
          })
        }
      }

      return updated
    }),

  /**
   * Обновить профиль пользователя
   */
  updateProfile: protectedProcedure
    .input(updateProfileInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      const { userId, data } = input

      // Можно редактировать только свой профиль или если админ
      const isAdmin = ctx.session.user.role === 'ADMIN' || ctx.session.user.role === 'SUPERADMIN'
      if (userId !== ctx.session.user.id && !isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Нельзя редактировать чужой профиль',
        })
      }

      // Upsert profile
      const profile = await ctx.prisma.userProfile.upsert({
        where: { userId },
        update: data,
        create: {
          userId,
          ...data,
        },
      })

      return profile
    }),

  /**
   * Получить статистику пользователей
   */
  stats: adminProcedure.query(async ({ ctx }) => {
    const [total, byRole, activeUsers] = await Promise.all([
      ctx.prisma.user.count(),
      ctx.prisma.user.groupBy({
        by: ['role'],
        _count: true,
      }),
      ctx.prisma.user.count({
        where: {
          canLogin: true,
        },
      }),
    ])

    const roleCounts = byRole.reduce((acc, item) => {
      acc[item.role] = item._count
      return acc
    }, {} as Record<Role, number>)

    return {
      total,
      activeUsers,
      byRole: roleCounts,
    }
  }),

  /**
   * Получить audit log пользователя
   */
  getAuditLog: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const audits = await ctx.prisma.userAudit.findMany({
        where: {
          userId: input.userId,
        },
        take: input.limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      return audits
    }),
})

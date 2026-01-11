/**
 * Letters Router - tRPC роутер для работы с письмами
 *
 * Демонстрация:
 * - Type-safe API queries и mutations
 * - Интеграция с Zod для валидации
 * - Prisma запросы
 * - Автоматический вывод типов
 */

import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import type { LetterStatus } from '@prisma/client'

// Zod схемы для валидации
const getLettersInputSchema = z.object({
  status: z.enum(['NOT_REVIEWED', 'ACCEPTED', 'IN_PROGRESS', 'CLARIFICATION', 'READY', 'DONE']).optional(),
  search: z.string().optional(),
  ownerId: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().optional(), // для пагинации
})

const createLetterInputSchema = z.object({
  number: z.string().min(1, 'Номер обязателен'),
  org: z.string().min(1, 'Организация обязательна'),
  date: z.date(),
  deadlineDate: z.date(),
  content: z.string().optional(),
  type: z.string().optional(),
  status: z.enum(['NOT_REVIEWED', 'ACCEPTED', 'IN_PROGRESS', 'CLARIFICATION', 'READY', 'DONE']).default('NOT_REVIEWED'),
  priority: z.number().min(0).max(100).default(50),
})

const updateLetterInputSchema = z.object({
  id: z.string(),
  data: z.object({
    number: z.string().optional(),
    org: z.string().optional(),
    content: z.string().optional(),
    status: z.enum(['NOT_REVIEWED', 'ACCEPTED', 'IN_PROGRESS', 'CLARIFICATION', 'READY', 'DONE']).optional(),
    priority: z.number().min(0).max(100).optional(),
    answer: z.string().optional(),
    ownerId: z.string().optional(),
  }),
})

export const lettersRouter = router({
  /**
   * Получить список писем с фильтрацией и пагинацией
   *
   * @example
   * const { data } = trpc.letters.getAll.useQuery({ status: 'IN_PROGRESS', limit: 10 })
   */
  getAll: protectedProcedure
    .input(getLettersInputSchema)
    .query(async ({ ctx, input }) => {
      const { status, search, ownerId, limit, cursor } = input

      const where: any = {
        deletedAt: null,
      }

      if (status) {
        where.status = status
      }

      if (ownerId) {
        where.ownerId = ownerId
      }

      if (search) {
        where.OR = [
          { number: { contains: search, mode: 'insensitive' } },
          { org: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
        ]
      }

      const letters = await ctx.prisma.letter.findMany({
        where,
        take: limit + 1, // +1 для определения hasMore
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              comments: true,
              files: true,
            },
          },
        },
      })

      let nextCursor: string | undefined = undefined
      if (letters.length > limit) {
        const nextItem = letters.pop()
        nextCursor = nextItem!.id
      }

      return {
        letters,
        nextCursor,
      }
    }),

  /**
   * Получить одно письмо по ID
   *
   * @example
   * const { data } = trpc.letters.getById.useQuery({ id: 'letter-123' })
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const letter = await ctx.prisma.letter.findFirst({
        where: {
          id: input.id,
          deletedAt: null,
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          files: true,
          tags: true,
          comments: {
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          watchers: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      })

      if (!letter) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Письмо не найдено',
        })
      }

      return letter
    }),

  /**
   * Создать новое письмо
   *
   * @example
   * const mutation = trpc.letters.create.useMutation()
   * mutation.mutate({ number: '123/2024', org: 'ООО Компания', ... })
   */
  create: protectedProcedure
    .input(createLetterInputSchema)
    .mutation(async ({ ctx, input }) => {
      const letter = await ctx.prisma.letter.create({
        data: {
          ...input,
          ownerId: ctx.session.user.id,
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      // Записать в историю
      await ctx.prisma.history.create({
        data: {
          letterId: letter.id,
          userId: ctx.session.user.id,
          field: 'created',
          newValue: `Письмо создано: ${letter.number}`,
        },
      })

      return letter
    }),

  /**
   * Обновить письмо
   *
   * @example
   * const mutation = trpc.letters.update.useMutation()
   * mutation.mutate({ id: 'letter-123', data: { status: 'DONE' } })
   */
  update: protectedProcedure
    .input(updateLetterInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, data } = input

      // Проверить существование
      const existing = await ctx.prisma.letter.findFirst({
        where: { id, deletedAt: null },
      })

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Письмо не найдено',
        })
      }

      // Обновить
      const updated = await ctx.prisma.letter.update({
        where: { id },
        data,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      // Записать изменения в историю
      for (const [field, value] of Object.entries(data)) {
        if (value !== undefined) {
          await ctx.prisma.history.create({
            data: {
              letterId: id,
              userId: ctx.session.user.id,
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
   * Удалить письмо (soft delete)
   *
   * @example
   * const mutation = trpc.letters.delete.useMutation()
   * mutation.mutate({ id: 'letter-123' })
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const letter = await ctx.prisma.letter.update({
        where: { id: input.id },
        data: {
          deletedAt: new Date(),
        },
      })

      await ctx.prisma.history.create({
        data: {
          letterId: input.id,
          userId: ctx.session.user.id,
          field: 'deleted',
          newValue: 'Письмо удалено',
        },
      })

      return { success: true }
    }),

  /**
   * Получить статистику по письмам
   *
   * @example
   * const { data } = trpc.letters.stats.useQuery()
   */
  stats: protectedProcedure.query(async ({ ctx }) => {
    const [total, byStatus] = await Promise.all([
      ctx.prisma.letter.count({
        where: { deletedAt: null },
      }),
      ctx.prisma.letter.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: true,
      }),
    ])

    const statusCounts = byStatus.reduce((acc, item) => {
      acc[item.status] = item._count
      return acc
    }, {} as Record<LetterStatus, number>)

    return {
      total,
      byStatus: statusCounts,
    }
  }),
})

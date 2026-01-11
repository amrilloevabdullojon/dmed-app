/**
 * Requests Router - tRPC роутер для системы заявок
 */

import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import type { RequestStatus, RequestPriority, RequestCategory } from '@prisma/client'

// Zod схемы
const getRequestsInputSchema = z.object({
  status: z.enum(['NEW', 'IN_REVIEW', 'DONE', 'SPAM', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  category: z.enum(['CONSULTATION', 'TECHNICAL', 'DOCUMENTATION', 'COMPLAINT', 'SUGGESTION', 'OTHER']).optional(),
  assignedToId: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
})

const createRequestInputSchema = z.object({
  organization: z.string().min(1, 'Организация обязательна'),
  contactName: z.string().min(1, 'Имя контакта обязательно'),
  contactEmail: z.string().email('Некорректный email'),
  contactPhone: z.string().min(1, 'Телефон обязателен'),
  contactTelegram: z.string(),
  description: z.string().min(10, 'Описание должно быть не менее 10 символов'),
  category: z.enum(['CONSULTATION', 'TECHNICAL', 'DOCUMENTATION', 'COMPLAINT', 'SUGGESTION', 'OTHER']).default('OTHER'),
  source: z.string().optional(),
})

const updateRequestInputSchema = z.object({
  id: z.string(),
  data: z.object({
    status: z.enum(['NEW', 'IN_REVIEW', 'DONE', 'SPAM', 'CANCELLED']).optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    category: z.enum(['CONSULTATION', 'TECHNICAL', 'DOCUMENTATION', 'COMPLAINT', 'SUGGESTION', 'OTHER']).optional(),
    assignedToId: z.string().nullable().optional(),
  }),
})

const addCommentInputSchema = z.object({
  requestId: z.string(),
  text: z.string().min(1, 'Комментарий не может быть пустым'),
})

export const requestsRouter = router({
  /**
   * Получить список заявок
   */
  getAll: protectedProcedure
    .input(getRequestsInputSchema)
    .query(async ({ ctx, input }) => {
      const { status, priority, category, assignedToId, search, limit, cursor } = input

      const where: any = {
        deletedAt: null,
      }

      if (status) {
        where.status = status
      }

      if (priority) {
        where.priority = priority
      }

      if (category) {
        where.category = category
      }

      if (assignedToId) {
        where.assignedToId = assignedToId
      }

      if (search) {
        where.OR = [
          { organization: { contains: search, mode: 'insensitive' } },
          { contactName: { contains: search, mode: 'insensitive' } },
          { contactEmail: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ]
      }

      const requests = await ctx.prisma.request.findMany({
        where,
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        include: {
          assignedTo: {
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
      if (requests.length > limit) {
        const nextItem = requests.pop()
        nextCursor = nextItem!.id
      }

      return {
        requests,
        nextCursor,
      }
    }),

  /**
   * Получить заявку по ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const request = await ctx.prisma.request.findFirst({
        where: {
          id: input.id,
          deletedAt: null,
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          files: true,
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
          history: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 20,
          },
        },
      })

      if (!request) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Заявка не найдена',
        })
      }

      return request
    }),

  /**
   * Создать заявку (публичный endpoint)
   */
  create: publicProcedure
    .input(createRequestInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Создать заявку
      const request = await ctx.prisma.request.create({
        data: {
          ...input,
          status: 'NEW',
          priority: 'NORMAL',
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      // TODO: Отправить уведомления админам

      return request
    }),

  /**
   * Обновить заявку
   */
  update: protectedProcedure
    .input(updateRequestInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      const { id, data } = input

      // Проверить существование
      const existing = await ctx.prisma.request.findFirst({
        where: { id, deletedAt: null },
      })

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Заявка не найдена',
        })
      }

      // Обновить
      const updated = await ctx.prisma.request.update({
        where: { id },
        data,
        include: {
          assignedTo: {
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
          await ctx.prisma.requestHistory.create({
            data: {
              requestId: id,
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
   * Добавить комментарий к заявке
   */
  addComment: protectedProcedure
    .input(addCommentInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      const { requestId, text } = input

      // Проверить существование заявки
      const request = await ctx.prisma.request.findFirst({
        where: { id: requestId, deletedAt: null },
      })

      if (!request) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Заявка не найдена',
        })
      }

      // Создать комментарий
      const comment = await ctx.prisma.requestComment.create({
        data: {
          requestId,
          authorId: ctx.session.user.id,
          text,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      })

      // TODO: Отправить уведомления

      return comment
    }),

  /**
   * Удалить заявку (soft delete)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      const request = await ctx.prisma.request.update({
        where: { id: input.id },
        data: {
          deletedAt: new Date(),
        },
      })

      await ctx.prisma.requestHistory.create({
        data: {
          requestId: input.id,
          userId: ctx.session.user.id,
          field: 'deleted',
          newValue: 'Заявка удалена',
        },
      })

      return { success: true }
    }),

  /**
   * Получить статистику по заявкам
   */
  stats: protectedProcedure.query(async ({ ctx }) => {
    const [total, byStatus, byPriority, byCategory] = await Promise.all([
      ctx.prisma.request.count({
        where: { deletedAt: null },
      }),
      ctx.prisma.request.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: true,
      }),
      ctx.prisma.request.groupBy({
        by: ['priority'],
        where: { deletedAt: null },
        _count: true,
      }),
      ctx.prisma.request.groupBy({
        by: ['category'],
        where: { deletedAt: null },
        _count: true,
      }),
    ])

    const statusCounts = byStatus.reduce((acc, item) => {
      acc[item.status] = item._count
      return acc
    }, {} as Record<RequestStatus, number>)

    const priorityCounts = byPriority.reduce((acc, item) => {
      acc[item.priority] = item._count
      return acc
    }, {} as Record<RequestPriority, number>)

    const categoryCounts = byCategory.reduce((acc, item) => {
      acc[item.category] = item._count
      return acc
    }, {} as Record<RequestCategory, number>)

    return {
      total,
      byStatus: statusCounts,
      byPriority: priorityCounts,
      byCategory: categoryCounts,
    }
  }),
})

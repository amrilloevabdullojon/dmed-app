import { prisma } from '@/lib/prisma'
import { dispatchNotification } from '@/lib/notification-dispatcher'
import { logger } from '@/lib/logger.server'
import type {
  Notification,
  NotificationChannel,
  NotificationPriority,
  Prisma,
} from '@prisma/client'
import type { NotificationEventType } from '@/lib/notification-settings'

/**
 * Notification Service - Централизованный сервис для работы с уведомлениями
 *
 * Функции:
 * - Создание и отправка уведомлений
 * - Управление настройками уведомлений
 * - Получение списка уведомлений пользователя
 * - Отметка уведомлений как прочитанных
 */

export class NotificationServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'NotificationServiceError'
  }
}

export type CreateNotificationInput = {
  event: NotificationEventType
  title: string
  body?: string | null
  letterId?: string | null
  actorId?: string | null
  userIds?: string[]
  metadata?: Record<string, unknown>
  priority?: NotificationPriority
  dedupeKey?: string
  dedupeWindowMinutes?: number
}

export type NotificationFilters = {
  userId: string
  read?: boolean
  channel?: NotificationChannel
  priority?: NotificationPriority
  letterId?: string
  fromDate?: Date
  toDate?: Date
}

export type PaginationParams = {
  page?: number
  limit?: number
  orderBy?: 'createdAt' | 'priority'
  order?: 'asc' | 'desc'
}

export class NotificationService {
  /**
   * Создать и отправить уведомление
   *
   * @example
   * await NotificationService.send({
   *   event: 'COMMENT',
   *   title: 'Новый комментарий',
   *   body: 'Текст комментария',
   *   letterId: 'abc123',
   *   actorId: 'user1',
   *   userIds: ['user2', 'user3']
   * })
   */
  static async send(input: CreateNotificationInput): Promise<void> {
    const startTime = logger.startTimer()

    try {
      await dispatchNotification({
        event: input.event,
        title: input.title,
        body: input.body,
        letterId: input.letterId,
        actorId: input.actorId,
        userIds: input.userIds,
        metadata: input.metadata,
        dedupeKey: input.dedupeKey,
        dedupeWindowMinutes: input.dedupeWindowMinutes,
      })

      logger.performance(
        'notification.service',
        'Notification sent',
        startTime,
        {
          event: input.event,
          userCount: input.userIds?.length || 0,
        }
      )
    } catch (error) {
      logger.error('notification.service', error, {
        event: input.event,
        userIds: input.userIds,
      })
      throw new NotificationServiceError(
        'Ошибка при отправке уведомления',
        'SEND_FAILED',
        500
      )
    }
  }

  /**
   * Получить уведомления пользователя с пагинацией
   *
   * @example
   * const { notifications, total } = await NotificationService.getForUser({
   *   userId: 'user1',
   *   read: false
   * }, { page: 1, limit: 20 })
   */
  static async getForUser(
    filters: NotificationFilters,
    pagination: PaginationParams = {}
  ): Promise<{
    notifications: Array<
      Notification & {
        actor?: { id: string; name: string | null; email: string | null } | null
        letter?: { id: string; number: string; org: string } | null
      }
    >
    total: number
    page: number
    limit: number
    hasMore: boolean
  }> {
    const page = Math.max(1, pagination.page || 1)
    const limit = Math.min(100, Math.max(1, pagination.limit || 20))
    const skip = (page - 1) * limit

    const where: Prisma.NotificationWhereInput = {
      userId: filters.userId,
      ...(filters.read !== undefined && { read: filters.read }),
      ...(filters.channel && { channel: filters.channel }),
      ...(filters.priority && { priority: filters.priority }),
      ...(filters.letterId && { letterId: filters.letterId }),
      ...(filters.fromDate && {
        createdAt: { gte: filters.fromDate },
      }),
      ...(filters.toDate && {
        createdAt: { lte: filters.toDate },
      }),
    }

    const orderByField = pagination.orderBy || 'createdAt'
    const orderDirection = pagination.order || 'desc'

    try {
      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          include: {
            actor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            letter: {
              select: {
                id: true,
                number: true,
                org: true,
              },
            },
          },
          orderBy:
            orderByField === 'priority'
              ? [{ priority: orderDirection }, { createdAt: 'desc' }]
              : { createdAt: orderDirection },
          take: limit,
          skip,
        }),
        prisma.notification.count({ where }),
      ])

      return {
        notifications,
        total,
        page,
        limit,
        hasMore: skip + notifications.length < total,
      }
    } catch (error) {
      logger.error('notification.service', error, { filters })
      throw new NotificationServiceError(
        'Ошибка при получении уведомлений',
        'FETCH_FAILED',
        500
      )
    }
  }

  /**
   * Отметить уведомление как прочитанное
   *
   * @example
   * await NotificationService.markAsRead('notif1', 'user1')
   */
  static async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
        select: { userId: true, read: true },
      })

      if (!notification) {
        throw new NotificationServiceError(
          'Уведомление не найдено',
          'NOT_FOUND',
          404
        )
      }

      if (notification.userId !== userId) {
        throw new NotificationServiceError(
          'Доступ запрещен',
          'FORBIDDEN',
          403
        )
      }

      if (notification.read) {
        return // Already read, no-op
      }

      await prisma.notification.update({
        where: { id: notificationId },
        data: { read: true, readAt: new Date() },
      })

      logger.info('notification.service', 'Notification marked as read', {
        notificationId,
        userId,
      })
    } catch (error) {
      if (error instanceof NotificationServiceError) {
        throw error
      }
      logger.error('notification.service', error, { notificationId, userId })
      throw new NotificationServiceError(
        'Ошибка при обновлении уведомления',
        'UPDATE_FAILED',
        500
      )
    }
  }

  /**
   * Отметить все уведомления пользователя как прочитанные
   *
   * @example
   * const count = await NotificationService.markAllAsRead('user1')
   */
  static async markAllAsRead(userId: string, filters?: { letterId?: string }): Promise<number> {
    try {
      const where: Prisma.NotificationWhereInput = {
        userId,
        read: false,
        ...(filters?.letterId && { letterId: filters.letterId }),
      }

      const result = await prisma.notification.updateMany({
        where,
        data: { read: true, readAt: new Date() },
      })

      logger.info('notification.service', 'Notifications marked as read', {
        userId,
        count: result.count,
        filters,
      })

      return result.count
    } catch (error) {
      logger.error('notification.service', error, { userId, filters })
      throw new NotificationServiceError(
        'Ошибка при обновлении уведомлений',
        'UPDATE_FAILED',
        500
      )
    }
  }

  /**
   * Удалить уведомление
   *
   * @example
   * await NotificationService.delete('notif1', 'user1')
   */
  static async delete(notificationId: string, userId: string): Promise<void> {
    try {
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
        select: { userId: true },
      })

      if (!notification) {
        throw new NotificationServiceError(
          'Уведомление не найдено',
          'NOT_FOUND',
          404
        )
      }

      if (notification.userId !== userId) {
        throw new NotificationServiceError(
          'Доступ запрещен',
          'FORBIDDEN',
          403
        )
      }

      await prisma.notification.delete({
        where: { id: notificationId },
      })

      logger.info('notification.service', 'Notification deleted', {
        notificationId,
        userId,
      })
    } catch (error) {
      if (error instanceof NotificationServiceError) {
        throw error
      }
      logger.error('notification.service', error, { notificationId, userId })
      throw new NotificationServiceError(
        'Ошибка при удалении уведомления',
        'DELETE_FAILED',
        500
      )
    }
  }

  /**
   * Получить количество непрочитанных уведомлений
   *
   * @example
   * const unreadCount = await NotificationService.getUnreadCount('user1')
   */
  static async getUnreadCount(userId: string, filters?: { letterId?: string }): Promise<number> {
    try {
      const where: Prisma.NotificationWhereInput = {
        userId,
        read: false,
        ...(filters?.letterId && { letterId: filters.letterId }),
      }

      return await prisma.notification.count({ where })
    } catch (error) {
      logger.error('notification.service', error, { userId, filters })
      throw new NotificationServiceError(
        'Ошибка при подсчете уведомлений',
        'COUNT_FAILED',
        500
      )
    }
  }

  /**
   * Удалить старые прочитанные уведомления (для очистки БД)
   *
   * @example
   * // Удалить прочитанные уведомления старше 30 дней
   * const deleted = await NotificationService.cleanupOld(30)
   */
  static async cleanupOld(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysOld)

      const result = await prisma.notification.deleteMany({
        where: {
          read: true,
          readAt: {
            lte: cutoffDate,
          },
        },
      })

      logger.info('notification.service', 'Old notifications cleaned up', {
        daysOld,
        count: result.count,
      })

      return result.count
    } catch (error) {
      logger.error('notification.service', error, { daysOld })
      throw new NotificationServiceError(
        'Ошибка при очистке уведомлений',
        'CLEANUP_FAILED',
        500
      )
    }
  }
}

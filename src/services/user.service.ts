import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger.server'
import type { User, Role, DigestFrequency, Prisma } from '@prisma/client'

/**
 * User Service - Централизованный сервис для работы с пользователями
 *
 * Функции:
 * - Получение пользователей
 * - Обновление профиля
 * - Управление настройками уведомлений
 * - Управление ролями
 */

export class UserServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'UserServiceError'
  }
}

export type UpdateProfileInput = {
  name?: string
  image?: string
  telegramChatId?: string | null
  phone?: string | null
}

export type UpdateNotificationSettingsInput = {
  notifyEmail?: boolean
  notifyTelegram?: boolean
  notifySms?: boolean
  notifyInApp?: boolean
  quietHoursStart?: string | null
  quietHoursEnd?: string | null
  digestFrequency?: DigestFrequency
}

export type UserListFilters = {
  role?: Role
  search?: string
  active?: boolean
}

export type PaginationParams = {
  page?: number
  limit?: number
  orderBy?: 'name' | 'email' | 'createdAt'
  order?: 'asc' | 'desc'
}

export type UserWithStats = User & {
  _count: {
    ownedLetters: number
    watchedLetters: number
    comments: number
  }
}

export class UserService {
  /**
   * Получить пользователя по ID
   *
   * @example
   * const user = await UserService.getById('user1')
   */
  static async getById(userId: string, includeStats = false): Promise<UserWithStats | User | null> {
    try {
      return await prisma.user.findUnique({
        where: { id: userId },
        ...(includeStats && {
          include: {
            _count: {
              select: {
                ownedLetters: true,
                watchedLetters: true,
                comments: true,
              },
            },
          },
        }),
      })
    } catch (error) {
      logger.error('user.service', error, { userId })
      throw new UserServiceError(
        'Ошибка при получении пользователя',
        'FETCH_FAILED',
        500
      )
    }
  }

  /**
   * Получить пользователя по email
   *
   * @example
   * const user = await UserService.getByEmail('user@example.com')
   */
  static async getByEmail(email: string): Promise<User | null> {
    try {
      return await prisma.user.findUnique({
        where: { email },
      })
    } catch (error) {
      logger.error('user.service', error, { email })
      throw new UserServiceError(
        'Ошибка при получении пользователя',
        'FETCH_FAILED',
        500
      )
    }
  }

  /**
   * Получить список пользователей с пагинацией
   *
   * @example
   * const { users, total } = await UserService.list({ role: 'USER' }, { page: 1, limit: 20 })
   */
  static async list(
    filters: UserListFilters = {},
    pagination: PaginationParams = {}
  ): Promise<{
    users: UserWithStats[]
    total: number
    page: number
    limit: number
    hasMore: boolean
  }> {
    const page = Math.max(1, pagination.page || 1)
    const limit = Math.min(100, Math.max(1, pagination.limit || 20))
    const skip = (page - 1) * limit

    const where: Prisma.UserWhereInput = {
      ...(filters.role && { role: filters.role }),
      ...(filters.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    }

    const orderByField = pagination.orderBy || 'name'
    const orderDirection = pagination.order || 'asc'

    try {
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          include: {
            _count: {
              select: {
                ownedLetters: true,
                watchedLetters: true,
                comments: true,
              },
            },
          },
          orderBy: { [orderByField]: orderDirection },
          take: limit,
          skip,
        }),
        prisma.user.count({ where }),
      ])

      return {
        users,
        total,
        page,
        limit,
        hasMore: skip + users.length < total,
      }
    } catch (error) {
      logger.error('user.service', error, { filters })
      throw new UserServiceError(
        'Ошибка при получении списка пользователей',
        'LIST_FAILED',
        500
      )
    }
  }

  /**
   * Обновить профиль пользователя
   *
   * @example
   * const user = await UserService.updateProfile('user1', {
   *   name: 'John Doe',
   *   telegramChatId: '123456'
   * })
   */
  static async updateProfile(
    userId: string,
    updates: UpdateProfileInput
  ): Promise<User> {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: updates,
      })

      logger.info('user.service', 'Profile updated', {
        userId,
        fields: Object.keys(updates),
      })

      return user
    } catch (error) {
      logger.error('user.service', error, { userId, updates })
      throw new UserServiceError(
        'Ошибка при обновлении профиля',
        'UPDATE_FAILED',
        500
      )
    }
  }

  /**
   * Обновить настройки уведомлений пользователя
   *
   * @example
   * await UserService.updateNotificationSettings('user1', {
   *   notifyEmail: true,
   *   digestFrequency: 'DAILY'
   * })
   */
  static async updateNotificationSettings(
    userId: string,
    settings: UpdateNotificationSettingsInput
  ): Promise<User> {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: settings,
      })

      logger.info('user.service', 'Notification settings updated', {
        userId,
        settings: Object.keys(settings),
      })

      return user
    } catch (error) {
      logger.error('user.service', error, { userId, settings })
      throw new UserServiceError(
        'Ошибка при обновлении настроек уведомлений',
        'UPDATE_FAILED',
        500
      )
    }
  }

  /**
   * Обновить роль пользователя (только для администраторов)
   *
   * @example
   * await UserService.updateRole('user1', 'ADMIN', 'admin1')
   */
  static async updateRole(
    userId: string,
    newRole: Role,
    adminUserId: string
  ): Promise<User> {
    try {
      // Verify admin permissions
      const admin = await prisma.user.findUnique({
        where: { id: adminUserId },
        select: { role: true },
      })

      if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'SUPERADMIN')) {
        throw new UserServiceError(
          'Недостаточно прав для изменения роли',
          'FORBIDDEN',
          403
        )
      }

      // Prevent non-superadmin from creating/modifying superadmins
      if (newRole === 'SUPERADMIN' && admin.role !== 'SUPERADMIN') {
        throw new UserServiceError(
          'Только SUPERADMIN может управлять SUPERADMIN ролями',
          'FORBIDDEN',
          403
        )
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: { role: newRole },
      })

      logger.info('user.service', 'User role updated', {
        userId,
        newRole,
        adminUserId,
      })

      return user
    } catch (error) {
      if (error instanceof UserServiceError) {
        throw error
      }
      logger.error('user.service', error, { userId, newRole, adminUserId })
      throw new UserServiceError(
        'Ошибка при обновлении роли',
        'UPDATE_FAILED',
        500
      )
    }
  }

  /**
   * Получить статистику пользователя
   *
   * @example
   * const stats = await UserService.getStats('user1')
   */
  static async getStats(userId: string): Promise<{
    ownedLetters: {
      total: number
      byStatus: Record<string, number>
    }
    watchedLetters: number
    comments: number
    notifications: {
      unread: number
      total: number
    }
  }> {
    try {
      const [letters, watchedCount, commentsCount, notifications] = await Promise.all([
        prisma.letter.groupBy({
          by: ['status'],
          where: {
            ownerId: userId,
            deletedAt: null,
          },
          _count: true,
        }),
        prisma.watcher.count({
          where: { userId },
        }),
        prisma.comment.count({
          where: { authorId: userId },
        }),
        prisma.notification.aggregate({
          where: { userId },
          _count: {
            _all: true,
          },
        }),
        prisma.notification.count({
          where: {
            userId,
            read: false,
          },
        }),
      ])

      const byStatus: Record<string, number> = {}
      let totalLetters = 0
      letters.forEach((group) => {
        byStatus[group.status] = group._count
        totalLetters += group._count
      })

      return {
        ownedLetters: {
          total: totalLetters,
          byStatus,
        },
        watchedLetters: watchedCount,
        comments: commentsCount,
        notifications: {
          unread: notifications[4] as number,
          total: notifications[3]._count._all,
        },
      }
    } catch (error) {
      logger.error('user.service', error, { userId })
      throw new UserServiceError(
        'Ошибка при получении статистики',
        'STATS_FAILED',
        500
      )
    }
  }

  /**
   * Инвалидировать все токены пользователя (logout со всех устройств)
   *
   * @example
   * await UserService.invalidateAllTokens('user1')
   */
  static async invalidateAllTokens(userId: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { tokenVersion: true },
      })

      if (!user) {
        throw new UserServiceError('Пользователь не найден', 'NOT_FOUND', 404)
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          tokenVersion: (user.tokenVersion || 0) + 1,
        },
      })

      logger.info('user.service', 'All tokens invalidated', { userId })
    } catch (error) {
      if (error instanceof UserServiceError) {
        throw error
      }
      logger.error('user.service', error, { userId })
      throw new UserServiceError(
        'Ошибка при инвалидации токенов',
        'INVALIDATE_FAILED',
        500
      )
    }
  }

  /**
   * Удалить пользователя (только для администраторов)
   *
   * @example
   * await UserService.delete('user1', 'admin1')
   */
  static async delete(userId: string, adminUserId: string): Promise<void> {
    try {
      // Verify admin permissions
      const admin = await prisma.user.findUnique({
        where: { id: adminUserId },
        select: { role: true },
      })

      if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'SUPERADMIN')) {
        throw new UserServiceError(
          'Недостаточно прав для удаления пользователя',
          'FORBIDDEN',
          403
        )
      }

      // Prevent deleting yourself
      if (userId === adminUserId) {
        throw new UserServiceError(
          'Нельзя удалить самого себя',
          'FORBIDDEN',
          403
        )
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      })

      if (!user) {
        throw new UserServiceError('Пользователь не найден', 'NOT_FOUND', 404)
      }

      // Prevent non-superadmin from deleting superadmins
      if (user.role === 'SUPERADMIN' && admin.role !== 'SUPERADMIN') {
        throw new UserServiceError(
          'Только SUPERADMIN может удалять SUPERADMIN',
          'FORBIDDEN',
          403
        )
      }

      await prisma.user.delete({
        where: { id: userId },
      })

      logger.info('user.service', 'User deleted', {
        userId,
        adminUserId,
      })
    } catch (error) {
      if (error instanceof UserServiceError) {
        throw error
      }
      logger.error('user.service', error, { userId, adminUserId })
      throw new UserServiceError(
        'Ошибка при удалении пользователя',
        'DELETE_FAILED',
        500
      )
    }
  }
}

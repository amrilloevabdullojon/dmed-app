import { Prisma } from '@prisma/client'

/**
 * Типизированный построитель запросов для Prisma.
 * Облегчает создание сложных фильтров и сортировок.
 */

/**
 * Направление сортировки
 */
export type SortOrder = 'asc' | 'desc'

export const LETTER_SORT_FIELDS = [
  'created',
  'deadline',
  'date',
  'number',
  'org',
  'status',
  'priority',
] as const

export type LetterSortField = (typeof LETTER_SORT_FIELDS)[number]

/**
 * Опции пагинации
 */
export interface PaginationOptions {
  page: number
  limit: number
}

/**
 * Результат пагинации
 */
export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

/**
 * Построитель запросов для Letter модели
 */
export class LetterQueryBuilder {
  private where: Prisma.LetterWhereInput = {}
  private orderBy: Prisma.LetterOrderByWithRelationInput[] = []
  private includes: Prisma.LetterInclude = {}
  private pagination?: PaginationOptions

  /**
   * Фильтр по статусу
   */
  status(status: string | string[]): this {
    if (Array.isArray(status)) {
      this.where.status = {
        in: status as (
          | 'NOT_REVIEWED'
          | 'ACCEPTED'
          | 'IN_PROGRESS'
          | 'CLARIFICATION'
          | 'READY'
          | 'DONE'
        )[],
      }
    } else if (status !== 'all') {
      this.where.status = status as
        | 'NOT_REVIEWED'
        | 'ACCEPTED'
        | 'IN_PROGRESS'
        | 'CLARIFICATION'
        | 'READY'
        | 'DONE'
    }
    return this
  }

  /**
   * Фильтр по владельцу
   */
  owner(ownerId: string | null): this {
    if (ownerId === null) {
      this.where.ownerId = null
    } else if (ownerId) {
      this.where.ownerId = ownerId
    }
    return this
  }

  /**
   * Фильтр по типу письма
   */
  type(type: string | null): this {
    if (type) {
      this.where.type = type
    }
    return this
  }

  /**
   * Поиск по тексту (номер, организация, содержание)
   */
  search(query: string | null): this {
    if (query && query.trim()) {
      const searchTerm = query.trim()
      this.where.OR = [
        { number: { contains: searchTerm, mode: 'insensitive' } },
        { org: { contains: searchTerm, mode: 'insensitive' } },
        { content: { contains: searchTerm, mode: 'insensitive' } },
        { jiraLink: { contains: searchTerm, mode: 'insensitive' } },
        { answer: { contains: searchTerm, mode: 'insensitive' } },
        { zordoc: { contains: searchTerm, mode: 'insensitive' } },
        { comment: { contains: searchTerm, mode: 'insensitive' } },
        { applicantName: { contains: searchTerm, mode: 'insensitive' } },
      ]
    }
    return this
  }

  /**
   * Фильтр по дате создания
   */
  createdBetween(from?: Date, to?: Date): this {
    if (from || to) {
      this.where.createdAt = {}
      if (from) this.where.createdAt.gte = from
      if (to) this.where.createdAt.lte = to
    }
    return this
  }

  /**
   * Фильтр по дедлайну
   */
  deadlineBetween(from?: Date, to?: Date): this {
    if (from || to) {
      this.where.deadlineDate = {}
      if (from) this.where.deadlineDate.gte = from
      if (to) this.where.deadlineDate.lte = to
    }
    return this
  }

  /**
   * Фильтр просроченных писем
   */
  overdue(): this {
    this.where.deadlineDate = { lt: new Date() }
    this.where.status = { notIn: ['DONE', 'READY'] }
    return this
  }

  /**
   * Фильтр срочных писем (дедлайн в ближайшие N дней)
   */
  urgent(days: number = 3): this {
    const now = new Date()
    const deadline = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    this.where.deadlineDate = { gte: now, lte: deadline }
    this.where.status = { notIn: ['DONE', 'READY'] }
    return this
  }

  /**
   * Исключить удалённые (soft delete)
   */
  notDeleted(): this {
    this.where.deletedAt = null
    return this
  }

  /**
   * Только удалённые
   */
  onlyDeleted(): this {
    this.where.deletedAt = { not: null }
    return this
  }

  /**
   * Фильтр по избранным
   */
  favorites(userId: string): this {
    this.where.favorites = {
      some: { userId },
    }
    return this
  }

  /**
   * Сортировка
   */
  sortBy(field: LetterSortField, order: SortOrder = 'desc'): this {
    const sortMapping: Record<string, Prisma.LetterOrderByWithRelationInput> = {
      created: { createdAt: order },
      deadline: { deadlineDate: order },
      date: { date: order },
      number: { number: order },
      org: { org: order },
      status: { status: order },
      priority: { priority: order },
    }

    if (sortMapping[field]) {
      this.orderBy.push(sortMapping[field])
    }

    return this
  }

  /**
   * Включить связанные данные
   */
  include(relations: {
    owner?: boolean
    files?: boolean
    comments?: boolean
    favorites?: boolean
  }): this {
    if (relations.owner) this.includes.owner = true
    if (relations.files) this.includes.files = true
    if (relations.comments) {
      this.includes.comments = {
        include: { author: true },
        orderBy: { createdAt: 'desc' as const },
      }
    }
    if (relations.favorites) this.includes.favorites = true
    return this
  }

  /**
   * Пагинация
   */
  paginate(page: number, limit: number): this {
    this.pagination = { page, limit }
    return this
  }

  /**
   * Построить объект запроса для findMany
   */
  build(): {
    where: Prisma.LetterWhereInput
    orderBy: Prisma.LetterOrderByWithRelationInput[]
    include: Prisma.LetterInclude
    skip?: number
    take?: number
  } {
    const result: ReturnType<LetterQueryBuilder['build']> = {
      where: this.where,
      orderBy: this.orderBy.length > 0 ? this.orderBy : [{ createdAt: 'desc' }],
      include: Object.keys(this.includes).length > 0 ? this.includes : undefined!,
    }

    if (this.pagination) {
      result.skip = (this.pagination.page - 1) * this.pagination.limit
      result.take = this.pagination.limit
    }

    return result
  }

  /**
   * Получить только where условие (для count)
   */
  buildWhere(): Prisma.LetterWhereInput {
    return this.where
  }
}

/**
 * Фабрика для создания построителя запросов
 */
export function letterQuery(): LetterQueryBuilder {
  return new LetterQueryBuilder()
}

/**
 * Утилита для создания пагинированного результата
 */
export function paginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit)
  return {
    items,
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}

/**
 * Построитель запросов для User модели
 */
export class UserQueryBuilder {
  private where: Prisma.UserWhereInput = {}
  private orderBy: Prisma.UserOrderByWithRelationInput[] = []

  /**
   * Фильтр по роли
   */
  role(role: string | string[]): this {
    type RoleType = 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'EMPLOYEE' | 'VIEWER'
    if (Array.isArray(role)) {
      this.where.role = { in: role as RoleType[] }
    } else {
      this.where.role = role as RoleType
    }
    return this
  }

  /**
   * Только активные пользователи
   */
  active(): this {
    this.where.canLogin = true
    return this
  }

  /**
   * Поиск по имени или email
   */
  search(query: string | null): this {
    if (query && query.trim()) {
      const searchTerm = query.trim()
      this.where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
      ]
    }
    return this
  }

  /**
   * Сортировка
   */
  sortBy(field: 'name' | 'email' | 'createdAt' | 'lastLogin', order: SortOrder = 'asc'): this {
    this.orderBy.push({ [field]: order })
    return this
  }

  /**
   * Построить объект запроса
   */
  build(): {
    where: Prisma.UserWhereInput
    orderBy: Prisma.UserOrderByWithRelationInput[]
  } {
    return {
      where: this.where,
      orderBy: this.orderBy.length > 0 ? this.orderBy : [{ name: 'asc' }],
    }
  }
}

/**
 * Фабрика для создания построителя запросов пользователей
 */
export function userQuery(): UserQueryBuilder {
  return new UserQueryBuilder()
}

import { prisma } from '@/lib/prisma'
import { addWorkingDays, sanitizeInput } from '@/lib/utils'
import { buildApplicantPortalLink, sendMultiChannelNotification } from '@/lib/notifications'
import { dispatchNotification } from '@/lib/notification-dispatcher'
import { logger } from '@/lib/logger.server'
import { PAGE_SIZE, PORTAL_TOKEN_EXPIRY_DAYS, DEFAULT_DEADLINE_WORKING_DAYS } from '@/lib/constants'
import { randomUUID } from 'crypto'
import type { LetterStatus, Prisma } from '@prisma/client'
import { letterQuery, type SortOrder } from '@/lib/query-builder'
import type {
  CreateLetterDTO,
  LetterFilters,
  LetterSummary,
  LetterDetail,
  PaginationParams,
  PaginatedResponse,
} from '@/types/dto'

/**
 * Service layer for letter-related business logic.
 * Separates business logic from API route handlers.
 */
export class LetterService {
  /**
   * Find letters with filtering, pagination, and sorting.
   */
  static async findMany(
    filters: LetterFilters,
    pagination: PaginationParams,
    userId: string
  ): Promise<PaginatedResponse<LetterSummary>> {
    const page = pagination.page || 1
    const limit = pagination.limit || PAGE_SIZE

    const builder = letterQuery().notDeleted()

    if (filters.status && filters.status !== 'all') {
      builder.status(filters.status)
    }

    if (filters.filter === 'overdue') {
      builder.overdue()
    } else if (filters.filter === 'urgent') {
      builder.urgent()
    } else if (filters.filter === 'done') {
      builder.status(['READY', 'DONE'])
    } else if (filters.filter === 'active') {
      builder.status(['NOT_REVIEWED', 'ACCEPTED', 'IN_PROGRESS', 'CLARIFICATION'])
    } else if (filters.filter === 'favorites') {
      builder.favorites(userId)
    } else if (filters.filter === 'unassigned') {
      builder.owner(null)
    } else if (filters.filter === 'mine') {
      builder.owner(userId)
    }

    if (filters.owner) {
      builder.owner(filters.owner)
    }

    if (filters.type) {
      builder.type(filters.type)
    }

    if (filters.search) {
      builder.search(filters.search)
    }

    const sortBy = filters.sortBy || 'created'
    const sortOrder = filters.sortOrder || 'desc'
    const effectiveOrder =
      sortBy === 'priority' ? (sortOrder === 'asc' ? 'desc' : 'asc') : sortOrder

    builder.sortBy(sortBy, effectiveOrder as SortOrder).paginate(page, limit)

    const query = builder.build()

    const [letters, total] = await Promise.all([
      prisma.letter.findMany({
        where: query.where,
        select: {
          id: true,
          number: true,
          org: true,
          date: true,
          deadlineDate: true,
          status: true,
          type: true,
          content: true,
          priority: true,
          owner: {
            select: { id: true, name: true, email: true, image: true },
          },
          _count: {
            select: { comments: true, watchers: true },
          },
        },
        orderBy: query.orderBy,
        skip: query.skip,
        take: query.take,
      }),
      prisma.letter.count({ where: builder.buildWhere() }),
    ])

    return {
      data: letters.map((letter) => ({
        ...letter,
        content: letter.content ? letter.content.slice(0, 240) : null,
      })) as LetterSummary[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Find a single letter by ID with all details.
   */
  static async findById(id: string, userId: string): Promise<LetterDetail | null> {
    const letter = await prisma.letter.findFirst({
      where: { id, deletedAt: null },
      include: {
        owner: {
          select: { id: true, name: true, email: true, image: true },
        },
        files: {
          select: {
            id: true,
            name: true,
            url: true,
            size: true,
            mimeType: true,
            status: true,
            uploadError: true,
          },
        },
        comments: {
          where: { parentId: null },
          orderBy: { createdAt: 'desc' },
          include: {
            author: { select: { id: true, name: true, email: true } },
            replies: {
              orderBy: { createdAt: 'asc' },
              include: {
                author: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
        history: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        watchers: {
          where: { userId },
          select: { id: true },
        },
        favorites: {
          where: { userId },
          select: { id: true },
        },
      },
    })

    if (!letter) return null

    return {
      ...letter,
      isWatching: letter.watchers.length > 0,
      isFavorite: letter.favorites.length > 0,
    } as unknown as LetterDetail
  }

  /**
   * Create a new letter.
   */
  static async create(data: CreateLetterDTO, creatorId: string): Promise<{ id: string }> {
    // Sanitize inputs
    const sanitized = {
      number: sanitizeInput(data.number, 50),
      org: sanitizeInput(data.org, 500),
      content: data.content ? sanitizeInput(data.content, 10000) : undefined,
      comment: data.comment ? sanitizeInput(data.comment, 5000) : undefined,
      contacts: data.contacts ? sanitizeInput(data.contacts, 500) : undefined,
      jiraLink: data.jiraLink ? sanitizeInput(data.jiraLink, 500) : undefined,
      applicantName: data.applicantName ? sanitizeInput(data.applicantName, 200) : undefined,
      applicantEmail: data.applicantEmail ? sanitizeInput(data.applicantEmail, 320) : undefined,
      applicantPhone: data.applicantPhone ? sanitizeInput(data.applicantPhone, 50) : undefined,
      applicantTelegramChatId: data.applicantTelegramChatId
        ? sanitizeInput(data.applicantTelegramChatId, 50)
        : undefined,
    }

    // Check for duplicate
    const existing = await prisma.letter.findFirst({
      where: {
        number: { equals: sanitized.number, mode: 'insensitive' },
        deletedAt: null,
      },
      select: { id: true },
    })

    if (existing) {
      throw new LetterServiceError('Письмо с таким номером уже существует', 'DUPLICATE')
    }

    // Resolve owner
    const ownerId = data.ownerId || (await this.resolveAutoOwnerId())

    // Calculate deadline
    const deadlineDate =
      data.deadlineDate || addWorkingDays(data.date, DEFAULT_DEADLINE_WORKING_DAYS)

    // Generate portal token if applicant contact provided
    const hasApplicantContact = !!(
      sanitized.applicantEmail ||
      sanitized.applicantPhone ||
      sanitized.applicantTelegramChatId
    )
    const applicantAccessToken = hasApplicantContact ? randomUUID() : null
    const applicantAccessTokenExpiresAt = hasApplicantContact
      ? new Date(Date.now() + 1000 * 60 * 60 * 24 * PORTAL_TOKEN_EXPIRY_DAYS)
      : null

    // Create letter
    const letter = await prisma.letter.create({
      data: {
        number: sanitized.number,
        org: sanitized.org,
        date: data.date,
        deadlineDate,
        type: data.type,
        content: sanitized.content,
        comment: sanitized.comment,
        contacts: sanitized.contacts,
        jiraLink: sanitized.jiraLink,
        applicantName: sanitized.applicantName,
        applicantEmail: sanitized.applicantEmail,
        applicantPhone: sanitized.applicantPhone,
        applicantTelegramChatId: sanitized.applicantTelegramChatId,
        applicantAccessToken,
        applicantAccessTokenExpiresAt,
        ownerId,
        status: 'NOT_REVIEWED',
        priority: 50,
      },
    })

    // Record history
    await prisma.history.create({
      data: {
        letterId: letter.id,
        userId: creatorId,
        field: 'created',
        newValue: JSON.stringify({ number: letter.number, org: letter.org }),
      },
    })

    // Auto-subscribe creator and owner
    const watcherIds = new Set<string>([creatorId])
    if (ownerId) watcherIds.add(ownerId)

    await prisma.watcher.createMany({
      data: Array.from(watcherIds).map((userId) => ({
        letterId: letter.id,
        userId,
      })),
      skipDuplicates: true,
    })

    // Notify owner if different from creator
    if (ownerId && ownerId !== creatorId) {
      await dispatchNotification({
        event: 'ASSIGNMENT',
        title: `\u041d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u043e \u043f\u0438\u0441\u044c\u043c\u043e \u2116-${letter.number}`,
        body: letter.org,
        letterId: letter.id,
        actorId: creatorId,
        userIds: [ownerId],
      })
    }

    // Send notification to applicant
    if (hasApplicantContact && applicantAccessToken) {
      await this.notifyApplicant(letter, applicantAccessToken)
    }

    logger.info('LetterService', 'Letter created', { letterId: letter.id, creatorId })

    return { id: letter.id }
  }

  /**
   * Update a letter field.
   */
  static async updateField(
    letterId: string,
    field: string,
    value: string | null,
    userId: string
  ): Promise<void> {
    // SECURITY: Whitelist of allowed fields to prevent SQL injection
    const ALLOWED_FIELDS = [
      'status',
      'ownerId',
      'deadlineDate',
      'priority',
      'category',
      'summary',
      'content',
      'incomingNumber',
      'incomingDate',
      'organization',
      'organizationAddress',
      'applicantName',
      'applicantContact',
    ] as const

    if (!ALLOWED_FIELDS.includes(field as any)) {
      throw new LetterServiceError(
        `Недопустимое поле для обновления: ${field}`,
        'INVALID_FIELD'
      )
    }

    const letter = await prisma.letter.findFirst({
      where: { id: letterId, deletedAt: null },
      select: { id: true, [field]: true },
    })

    if (!letter) {
      throw new LetterServiceError('Письмо не найдено', 'NOT_FOUND')
    }

    const oldValue = letter[field as keyof typeof letter]

    // Handle status change side effects
    if (field === 'status') {
      await this.handleStatusChange(letterId, value as LetterStatus)
    }

    await prisma.letter.update({
      where: { id: letterId },
      data: { [field]: value },
    })

    // Record history
    await prisma.history.create({
      data: {
        letterId,
        userId,
        field,
        oldValue: oldValue != null ? String(oldValue) : null,
        newValue: value,
      },
    })

    logger.info('LetterService', 'Letter updated', { letterId, field, userId })
  }

  /**
   * Soft delete a letter.
   */
  static async delete(letterId: string, userId: string): Promise<void> {
    const letter = await prisma.letter.findFirst({
      where: { id: letterId, deletedAt: null },
      select: { id: true },
    })

    if (!letter) {
      throw new LetterServiceError('Письмо не найдено', 'NOT_FOUND')
    }

    await prisma.letter.update({
      where: { id: letterId },
      data: { deletedAt: new Date() },
    })

    await prisma.history.create({
      data: {
        letterId,
        userId,
        field: 'deleted',
        newValue: 'true',
      },
    })

    logger.info('LetterService', 'Letter deleted', { letterId, userId })
  }

  // ==================== PRIVATE METHODS ====================

  private static buildWhereClause(filters: LetterFilters, userId: string): Prisma.LetterWhereInput {
    const where: Prisma.LetterWhereInput = {
      deletedAt: null,
    }

    if (filters.status && filters.status !== 'all') {
      where.status = filters.status
    }

    if (filters.owner) {
      where.ownerId = filters.owner
    }

    if (filters.type) {
      where.type = filters.type
    }

    // Special filters
    if (filters.filter === 'overdue') {
      where.deadlineDate = { lt: new Date() }
      where.status = { notIn: ['READY', 'DONE'] }
    } else if (filters.filter === 'urgent') {
      const threeDaysLater = new Date()
      threeDaysLater.setDate(threeDaysLater.getDate() + 3)
      where.deadlineDate = { lte: threeDaysLater, gte: new Date() }
      where.status = { notIn: ['READY', 'DONE'] }
    } else if (filters.filter === 'done') {
      where.status = { in: ['READY', 'DONE'] }
    } else if (filters.filter === 'active') {
      where.status = { notIn: ['READY', 'DONE'] }
    } else if (filters.filter === 'favorites') {
      where.favorites = { some: { userId } }
    } else if (filters.filter === 'unassigned') {
      where.ownerId = null
    } else if (filters.filter === 'mine') {
      where.ownerId = userId
    }

    // Search
    if (filters.search) {
      where.OR = [
        { number: { contains: filters.search, mode: 'insensitive' } },
        { org: { contains: filters.search, mode: 'insensitive' } },
        { content: { contains: filters.search, mode: 'insensitive' } },
        { jiraLink: { contains: filters.search, mode: 'insensitive' } },
        { answer: { contains: filters.search, mode: 'insensitive' } },
        { zordoc: { contains: filters.search, mode: 'insensitive' } },
        { comment: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    return where
  }

  private static buildOrderBy(
    sortBy?: string,
    sortOrder?: string
  ): Prisma.LetterOrderByWithRelationInput {
    const order = sortOrder || 'desc'
    const orderByMap: Record<string, Prisma.LetterOrderByWithRelationInput> = {
      created: { createdAt: order as Prisma.SortOrder },
      deadline: { deadlineDate: order as Prisma.SortOrder },
      date: { date: order as Prisma.SortOrder },
      priority: { priority: order === 'asc' ? 'desc' : 'asc' },
      status: { status: order as Prisma.SortOrder },
      number: { number: order as Prisma.SortOrder },
      org: { org: order as Prisma.SortOrder },
    }

    return orderByMap[sortBy || 'created'] || { deadlineDate: 'asc' }
  }

  private static async resolveAutoOwnerId(): Promise<string | null> {
    const users = await prisma.user.findMany({
      where: { canLogin: true },
      select: { id: true },
    })

    if (users.length === 0) return null

    const userIds = users.map((user) => user.id)

    const counts = await prisma.letter.groupBy({
      by: ['ownerId'],
      where: {
        ownerId: { in: userIds },
        deletedAt: null,
        status: { notIn: ['READY', 'DONE'] },
      },
      _count: { _all: true },
    })

    const countByUser = new Map(counts.map((item) => [item.ownerId, item._count._all]))

    const sorted = [...userIds].sort((a, b) => {
      const countA = countByUser.get(a) || 0
      const countB = countByUser.get(b) || 0
      if (countA !== countB) return countA - countB
      return a.localeCompare(b)
    })

    return sorted[0] || null
  }

  private static async handleStatusChange(
    letterId: string,
    newStatus: LetterStatus
  ): Promise<void> {
    // Set close date when marking as done
    if (newStatus === 'DONE' || newStatus === 'READY') {
      await prisma.letter.update({
        where: { id: letterId },
        data: { closeDate: new Date() },
      })
    }
  }

  private static async notifyApplicant(
    letter: { id: string; number: string; org: string; deadlineDate: Date },
    token: string
  ): Promise<void> {
    const portalLink = buildApplicantPortalLink(token)
    const deadlineFormatted = letter.deadlineDate.toLocaleDateString('ru-RU')

    const subject = `Ваше обращение №${letter.number} зарегистрировано`
    const text = `Ваше обращение зарегистрировано.

Номер: ${letter.number}
Организация: ${letter.org}
Срок: ${deadlineFormatted}

Статус: ${portalLink}`

    const telegram = `
<b>Обращение зарегистрировано</b>

№${letter.number}
${letter.org}
Срок: ${deadlineFormatted}

<a href="${portalLink}">Открыть статус</a>`

    try {
      await sendMultiChannelNotification(
        {
          email: undefined, // Will be filled from letter data in notifications.ts
          phone: undefined,
          telegramChatId: undefined,
        },
        { subject, text, telegram }
      )
    } catch (error) {
      logger.error('LetterService', 'Failed to notify applicant', {
        letterId: letter.id,
        error,
      })
    }
  }
}

/**
 * Custom error class for LetterService.
 */
export class LetterServiceError extends Error {
  constructor(
    message: string,
    public code: 'NOT_FOUND' | 'DUPLICATE' | 'VALIDATION' | 'FORBIDDEN'
  ) {
    super(message)
    this.name = 'LetterServiceError'
  }
}

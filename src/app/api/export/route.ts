import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { STATUS_LABELS, formatDate } from '@/lib/utils'
import { logger } from '@/lib/logger.server'
import { withValidation } from '@/lib/api-handler'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Zod schema для валидации query параметров
const exportQuerySchema = z.object({
  status: z.string().optional(),
  filter: z.enum(['overdue', 'urgent', 'done', 'active', 'favorites', 'unassigned', 'mine']).optional(),
  owner: z.string().optional(),
  type: z.string().optional(),
  ids: z.string().optional(),
})

type ExportQuery = z.infer<typeof exportQuerySchema>

// GET /api/export - экспорт писем в CSV (совместимо с Excel)
export const GET = withValidation<any, never, ExportQuery>(
  async (request, session, { query }) => {
    try {
      const ids = query.ids?.split(',').filter(Boolean)

      // Построить фильтр с типизацией
      interface LetterWhereInput {
        id?: { in: string[] }
        status?: any
        ownerId?: string | null
        type?: string
        deadlineDate?: any
        favorites?: any
      }

      const where: LetterWhereInput = {}

      if (ids && ids.length > 0) {
        where.id = { in: ids }
      } else {
        if (query.status) {
          where.status = query.status
        }

        if (query.owner) {
          where.ownerId = query.owner
        }

        if (query.type) {
          where.type = query.type
        }

        if (query.filter === 'overdue') {
          where.deadlineDate = { lt: new Date() }
          where.status = { notIn: ['READY', 'DONE'] }
        } else if (query.filter === 'urgent') {
          const now = new Date()
          where.deadlineDate = {
            gte: now,
            lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
          }
          where.status = { notIn: ['READY', 'DONE'] }
        } else if (query.filter === 'done') {
          where.status = { in: ['READY', 'DONE'] }
        } else if (query.filter === 'active') {
          where.status = { notIn: ['READY', 'DONE'] }
        } else if (query.filter === 'favorites') {
          where.favorites = { some: { userId: session.user.id } }
        } else if (query.filter === 'unassigned') {
          where.ownerId = null
        } else if (query.filter === 'mine') {
          where.ownerId = session.user.id
        }
      }

    const letters = await prisma.letter.findMany({
      where,
      include: {
        owner: {
          select: { name: true, email: true },
        },
      },
      orderBy: { deadlineDate: 'asc' },
    })

    // Заголовки CSV
    const headers = [
      'Номер',
      'Организация',
      'Дата письма',
      'Дедлайн',
      'Статус',
      'Тип',
      'Содержание',
      'Ответственный',
      'Jira',
      'Ответ',
      'ZorDoc',
      'Статус отправки',
      'Комментарий',
      'Дата закрытия',
    ]

    // Строки данных
    const rows = letters.map((letter) => [
      letter.number,
      letter.org,
      formatDate(letter.date),
      formatDate(letter.deadlineDate),
      STATUS_LABELS[letter.status] || letter.status,
      letter.type || '',
      letter.content || '',
      letter.owner?.name || letter.owner?.email || '',
      letter.jiraLink || '',
      letter.answer || '',
      letter.zordoc || '',
      letter.sendStatus || '',
      letter.comment || '',
      letter.closeDate ? formatDate(letter.closeDate) : '',
    ])

    // Функция экранирования CSV
    const escapeCSV = (value: string) => {
      if (
        value.includes('"') ||
        value.includes(',') ||
        value.includes('\n') ||
        value.includes('\r')
      ) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }

    // Генерируем CSV с BOM для корректного открытия в Excel
    const BOM = '\uFEFF'
    const csv =
      BOM +
      [headers.map(escapeCSV).join(','), ...rows.map((row) => row.map(escapeCSV).join(','))].join(
        '\r\n'
      )

      // Отправляем файл
      const filename = `letters_${new Date().toISOString().split('T')[0]}.csv`

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } catch (error) {
      logger.error('GET /api/export', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  },
  {
    minRole: 'VIEWER', // Требуется минимум роль VIEWER для экспорта
    querySchema: exportQuerySchema,
    rateLimit: 'standard',
  }
)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { STATUS_LABELS, formatDate } from '@/lib/utils'
import { logger } from '@/lib/logger.server'

export const dynamic = 'force-dynamic'

// GET /api/export - экспорт писем в CSV (совместимо с Excel)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const filter = searchParams.get('filter')
    const owner = searchParams.get('owner')
    const type = searchParams.get('type')
    const ids = searchParams.get('ids')?.split(',').filter(Boolean)

    // Построить фильтр
    const where: any = {}

    if (ids && ids.length > 0) {
      where.id = { in: ids }
    } else {
      if (status) {
        where.status = status
      }

      if (owner) {
        where.ownerId = owner
      }

      if (type) {
        where.type = type
      }

      if (filter === 'overdue') {
        where.deadlineDate = { lt: new Date() }
        where.status = { notIn: ['READY', 'DONE'] }
      } else if (filter === 'urgent') {
        const now = new Date()
        where.deadlineDate = {
          gte: now,
          lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        }
        where.status = { notIn: ['READY', 'DONE'] }
      } else if (filter === 'done') {
        where.status = { in: ['READY', 'DONE'] }
      } else if (filter === 'active') {
        where.status = { notIn: ['READY', 'DONE'] }
      } else if (filter === 'favorites') {
        where.favorites = { some: { userId: session.user.id } }
      } else if (filter === 'unassigned') {
        where.ownerId = null
      } else if (filter === 'mine') {
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
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined
    const priority = searchParams.get('priority') || undefined
    const category = searchParams.get('category') || undefined
    const search = searchParams.get('search') || undefined

    // Построение фильтра
    const where: any = {
      deletedAt: null,
    }

    if (status) where.status = status
    if (priority) where.priority = priority
    if (category) where.category = category

    if (search) {
      where.OR = [
        { organization: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
        { contactPhone: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Получаем все заявки (с ограничением 1000 для безопасности)
    const requests = await prisma.request.findMany({
      where,
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    })

    // Создаём CSV
    const headers = [
      'ID',
      'Организация',
      'Контактное лицо',
      'Email',
      'Телефон',
      'Telegram',
      'Категория',
      'Приоритет',
      'Статус',
      'Описание',
      'Ответственный',
      'Дата создания',
      'Дата обновления',
    ]

    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return ''
      const str = String(value)
      // Экранируем кавычки и переносы строк
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const rows = requests.map((req) => [
      req.id,
      escapeCSV(req.organization),
      escapeCSV(req.contactName),
      escapeCSV(req.contactEmail),
      escapeCSV(req.contactPhone),
      escapeCSV(req.contactTelegram),
      escapeCSV(req.category),
      escapeCSV(req.priority),
      escapeCSV(req.status),
      escapeCSV(req.description),
      escapeCSV(req.assignedTo?.name || req.assignedTo?.email || ''),
      new Date(req.createdAt).toLocaleString('ru-RU'),
      new Date(req.updatedAt).toLocaleString('ru-RU'),
    ])

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')

    // BOM для корректного отображения кириллицы в Excel
    const bom = '\uFEFF'
    const csvWithBom = bom + csv

    return new NextResponse(csvWithBom, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="requests-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error('Failed to export requests:', error)
    return NextResponse.json(
      { error: 'Ошибка при экспорте данных' },
      { status: 500 }
    )
  }
}

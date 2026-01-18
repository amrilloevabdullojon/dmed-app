import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    // Параллельный запрос всех статистик
    const [total, newCount, inReview, done, urgent, recentRequests] = await Promise.all([
      prisma.request.count({ where: { deletedAt: null } }),
      prisma.request.count({ where: { deletedAt: null, status: 'NEW' } }),
      prisma.request.count({ where: { deletedAt: null, status: 'IN_REVIEW' } }),
      prisma.request.count({ where: { deletedAt: null, status: 'DONE' } }),
      prisma.request.count({ where: { deletedAt: null, priority: 'URGENT' } }),
      // Получаем последние 50 завершённых заявок для расчёта среднего времени
      prisma.request.findMany({
        where: {
          deletedAt: null,
          status: 'DONE',
          updatedAt: { not: null },
        },
        select: {
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
    ])

    // Вычисляем среднее время обработки в часах
    let avgResponseTime: number | null = null
    if (recentRequests.length > 0) {
      const totalHours = recentRequests.reduce((sum, req) => {
        const created = new Date(req.createdAt).getTime()
        const updated = new Date(req.updatedAt).getTime()
        const hours = (updated - created) / (1000 * 60 * 60)
        return sum + hours
      }, 0)
      avgResponseTime = totalHours / recentRequests.length
    }

    return NextResponse.json({
      total,
      new: newCount,
      inReview,
      done,
      urgent,
      avgResponseTime,
    })
  } catch (error) {
    console.error('Failed to load request stats:', error)
    return NextResponse.json(
      { error: 'Ошибка при загрузке статистики' },
      { status: 500 }
    )
  }
}

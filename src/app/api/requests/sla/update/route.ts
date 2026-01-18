import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger.server'
import { calculateSlaStatus } from '@/lib/request-sla'

// POST /api/requests/sla/update - обновить SLA статусы для всех активных заявок
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Получаем все активные заявки с SLA дедлайнами
    const requests = await prisma.request.findMany({
      where: {
        deletedAt: null,
        status: {
          notIn: ['DONE', 'CANCELLED', 'SPAM'],
        },
        slaDeadline: {
          not: null,
        },
      },
      select: {
        id: true,
        status: true,
        slaDeadline: true,
        resolvedAt: true,
        slaStatus: true,
      },
    })

    let updatedCount = 0

    // Обновляем статусы
    for (const req of requests) {
      const newStatus = calculateSlaStatus(
        req.slaDeadline,
        req.resolvedAt,
        req.status
      )

      if (newStatus !== req.slaStatus) {
        await prisma.request.update({
          where: { id: req.id },
          data: { slaStatus: newStatus },
        })
        updatedCount++
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      totalChecked: requests.length,
    })
  } catch (error) {
    logger.error('POST /api/requests/sla/update', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

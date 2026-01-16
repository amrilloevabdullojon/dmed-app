import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger.server'
import { generateAutomaticReminders } from '@/lib/letter-reminders'

/**
 * POST /api/letters/reminders/generate
 *
 * Генерирует автоматические напоминания для всех активных писем.
 * Анализирует письма и создаёт напоминания на основе правил:
 * - Приближающийся дедлайн
 * - Просроченный дедлайн
 * - Долго нет ответа
 * - Застопорившееся письмо
 * - Follow-up после отправки
 *
 * Запускается по cron-расписанию (например, каждый день в 9:00)
 */
export async function POST(request: NextRequest) {
  try {
    // Простая защита от несанкционированного доступа
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'dev-secret'

    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('POST /api/letters/reminders/generate', 'Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Получаем все активные письма (не удалённые, не завершённые)
    const activeLetters = await prisma.letter.findMany({
      where: {
        deletedAt: null,
        status: {
          not: 'DONE',
        },
      },
      orderBy: {
        deadlineDate: 'asc',
      },
    })

    logger.info('POST /api/letters/reminders/generate', `Generating reminders for ${activeLetters.length} letters`)

    let successCount = 0
    let errorCount = 0

    for (const letter of activeLetters) {
      try {
        await generateAutomaticReminders(letter)
        successCount++
      } catch (error) {
        errorCount++
        logger.error('POST /api/letters/reminders/generate', 'Error generating reminders', {
          letterId: letter.id,
          error,
        })
      }
    }

    logger.info('POST /api/letters/reminders/generate', `Generated reminders`, {
      success: successCount,
      errors: errorCount,
    })

    return NextResponse.json({
      success: true,
      processed: successCount,
      errors: errorCount,
      total: activeLetters.length,
    })
  } catch (error) {
    logger.error('POST /api/letters/reminders/generate', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

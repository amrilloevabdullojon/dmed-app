import { Letter, LetterStatus, LetterReminderType } from '@prisma/client'
import { prisma } from './prisma'
import { logger } from './logger.server'

/**
 * Настройки для автоматических напоминаний
 */
export const REMINDER_RULES = {
  // Напоминание за N дней до дедлайна
  DEADLINE_WARNING_DAYS: 3,

  // Напоминание если нет ответа больше N дней
  NO_RESPONSE_DAYS: 7,

  // Письмо считается застопорившимся если в работе больше N дней
  STALLED_DAYS: 14,

  // Follow-up через N дней после отправки ответа
  FOLLOW_UP_DAYS: 5,
}

type ReminderInput = {
  letterId: string
  type: LetterReminderType
  triggerDate: Date
  message: string
  createdById?: string
}

/**
 * Создаёт напоминание для письма
 */
export async function createReminder(input: ReminderInput) {
  try {
    // Проверяем, нет ли уже активного напоминания такого же типа для этого письма
    const existing = await prisma.letterReminder.findFirst({
      where: {
        letterId: input.letterId,
        type: input.type,
        isActive: true,
        isSent: false,
      },
    })

    if (existing) {
      // Обновляем существующее
      return await prisma.letterReminder.update({
        where: { id: existing.id },
        data: {
          triggerDate: input.triggerDate,
          message: input.message,
          updatedAt: new Date(),
        },
      })
    }

    // Создаём новое
    return await prisma.letterReminder.create({
      data: {
        letterId: input.letterId,
        type: input.type,
        triggerDate: input.triggerDate,
        message: input.message,
        createdById: input.createdById || null,
      },
    })
  } catch (error) {
    logger.error('createReminder', error)
    throw error
  }
}

/**
 * Деактивирует все напоминания определённого типа для письма
 */
export async function deactivateReminders(letterId: string, type?: LetterReminderType) {
  try {
    await prisma.letterReminder.updateMany({
      where: {
        letterId,
        ...(type ? { type } : {}),
        isActive: true,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    })
  } catch (error) {
    logger.error('deactivateReminders', error)
    throw error
  }
}

/**
 * Генерирует автоматические напоминания для письма
 */
export async function generateAutomaticReminders(letter: Letter) {
  try {
    const now = new Date()

    // 1. Напоминание о приближающемся дедлайне
    if (letter.status !== 'DONE' && letter.deadlineDate) {
      const deadlineDate = new Date(letter.deadlineDate)
      const daysUntilDeadline = Math.ceil(
        (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (
        daysUntilDeadline > 0 &&
        daysUntilDeadline <= REMINDER_RULES.DEADLINE_WARNING_DAYS
      ) {
        const triggerDate = new Date(deadlineDate)
        triggerDate.setDate(triggerDate.getDate() - REMINDER_RULES.DEADLINE_WARNING_DAYS)

        await createReminder({
          letterId: letter.id,
          type: 'DEADLINE_APPROACHING',
          triggerDate,
          message: `Письмо ${letter.number} - дедлайн через ${daysUntilDeadline} дн. (${deadlineDate.toLocaleDateString('ru-RU')})`,
        })
      }

      // 2. Напоминание о просроченном дедлайне
      if (daysUntilDeadline < 0) {
        await createReminder({
          letterId: letter.id,
          type: 'DEADLINE_OVERDUE',
          triggerDate: now,
          message: `Письмо ${letter.number} - просрочен дедлайн на ${Math.abs(daysUntilDeadline)} дн.`,
        })
      }
    }

    // 3. Напоминание если долго нет ответа (письмо в работе, но answer пустой)
    if (
      letter.status === 'IN_PROGRESS' &&
      !letter.answer &&
      letter.ownerId
    ) {
      const daysSinceCreated = Math.floor(
        (now.getTime() - new Date(letter.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysSinceCreated >= REMINDER_RULES.NO_RESPONSE_DAYS) {
        const triggerDate = new Date(letter.createdAt)
        triggerDate.setDate(triggerDate.getDate() + REMINDER_RULES.NO_RESPONSE_DAYS)

        await createReminder({
          letterId: letter.id,
          type: 'NO_RESPONSE',
          triggerDate,
          message: `Письмо ${letter.number} в работе ${daysSinceCreated} дн. без ответа`,
        })
      }
    }

    // 4. Напоминание о застопорившемся письме
    if (
      (letter.status === 'IN_PROGRESS' || letter.status === 'CLARIFICATION') &&
      letter.updatedAt
    ) {
      const daysSinceUpdate = Math.floor(
        (now.getTime() - new Date(letter.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysSinceUpdate >= REMINDER_RULES.STALLED_DAYS) {
        const triggerDate = new Date(letter.updatedAt)
        triggerDate.setDate(triggerDate.getDate() + REMINDER_RULES.STALLED_DAYS)

        await createReminder({
          letterId: letter.id,
          type: 'STALLED',
          triggerDate,
          message: `Письмо ${letter.number} застопорилось - нет активности ${daysSinceUpdate} дн.`,
        })
      }
    }

    // 5. Follow-up после отправки (если есть ответ и статус READY)
    if (letter.status === 'READY' && letter.answer && letter.ijroDate) {
      const daysSinceIjro = Math.floor(
        (now.getTime() - new Date(letter.ijroDate).getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysSinceIjro >= REMINDER_RULES.FOLLOW_UP_DAYS) {
        const triggerDate = new Date(letter.ijroDate)
        triggerDate.setDate(triggerDate.getDate() + REMINDER_RULES.FOLLOW_UP_DAYS)

        await createReminder({
          letterId: letter.id,
          type: 'FOLLOW_UP',
          triggerDate,
          message: `Письмо ${letter.number} - время для follow-up (отправлено ${daysSinceIjro} дн. назад)`,
        })
      }
    }

    // Деактивируем неактуальные напоминания
    await cleanupReminders(letter)
  } catch (error) {
    logger.error('generateAutomaticReminders', error)
    throw error
  }
}

/**
 * Очищает неактуальные напоминания для письма
 */
async function cleanupReminders(letter: Letter) {
  try {
    // Если письмо завершено - деактивируем все напоминания
    if (letter.status === 'DONE') {
      await deactivateReminders(letter.id)
      return
    }

    // Если дедлайн прошёл - деактивируем DEADLINE_APPROACHING
    if (letter.deadlineDate && new Date(letter.deadlineDate) < new Date()) {
      await deactivateReminders(letter.id, 'DEADLINE_APPROACHING')
    }

    // Если появился ответ - деактивируем NO_RESPONSE
    if (letter.answer) {
      await deactivateReminders(letter.id, 'NO_RESPONSE')
    }

    // Если письмо обновлялось недавно - деактивируем STALLED
    const daysSinceUpdate = Math.floor(
      (new Date().getTime() - new Date(letter.updatedAt).getTime()) /
        (1000 * 60 * 60 * 24)
    )
    if (daysSinceUpdate < REMINDER_RULES.STALLED_DAYS) {
      await deactivateReminders(letter.id, 'STALLED')
    }
  } catch (error) {
    logger.error('cleanupReminders', error)
  }
}

/**
 * Получает все просроченные напоминания, которые нужно отправить
 */
export async function getPendingReminders() {
  try {
    const now = new Date()

    return await prisma.letterReminder.findMany({
      where: {
        isActive: true,
        isSent: false,
        triggerDate: {
          lte: now,
        },
      },
      include: {
        letter: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
                notifyEmail: true,
                notifyTelegram: true,
                notifyInApp: true,
                telegramChatId: true,
              },
            },
          },
        },
      },
      orderBy: {
        triggerDate: 'asc',
      },
    })
  } catch (error) {
    logger.error('getPendingReminders', error)
    return []
  }
}

/**
 * Отмечает напоминание как отправленное
 */
export async function markReminderAsSent(reminderId: string) {
  try {
    await prisma.letterReminder.update({
      where: { id: reminderId },
      data: {
        isSent: true,
        sentAt: new Date(),
      },
    })
  } catch (error) {
    logger.error('markReminderAsSent', error)
    throw error
  }
}

/**
 * Получает статистику по напоминаниям
 */
export async function getReminderStats(userId?: string) {
  try {
    const where = userId
      ? {
          letter: {
            ownerId: userId,
          },
        }
      : {}

    const [total, active, sent, pending] = await Promise.all([
      prisma.letterReminder.count({ where }),
      prisma.letterReminder.count({ where: { ...where, isActive: true } }),
      prisma.letterReminder.count({ where: { ...where, isSent: true } }),
      prisma.letterReminder.count({
        where: {
          ...where,
          isActive: true,
          isSent: false,
          triggerDate: { lte: new Date() },
        },
      }),
    ])

    return { total, active, sent, pending }
  } catch (error) {
    logger.error('getReminderStats', error)
    return { total: 0, active: 0, sent: 0, pending: 0 }
  }
}

/**
 * Типы напоминаний на русском
 */
export const REMINDER_TYPE_LABELS: Record<LetterReminderType, string> = {
  DEADLINE_APPROACHING: 'Приближается дедлайн',
  DEADLINE_OVERDUE: 'Просрочен дедлайн',
  NO_RESPONSE: 'Долго нет ответа',
  STALLED: 'Письмо застопорилось',
  FOLLOW_UP: 'Время для follow-up',
  CUSTOM: 'Пользовательское',
}

/**
 * Иконки для типов напоминаний
 */
export const REMINDER_TYPE_ICONS: Record<LetterReminderType, string> = {
  DEADLINE_APPROACHING: '⚠️',
  DEADLINE_OVERDUE: '🚨',
  NO_RESPONSE: '⏰',
  STALLED: '⛔',
  FOLLOW_UP: '📬',
  CUSTOM: '🔔',
}

/**
 * Цвета для типов напоминаний
 */
export const REMINDER_TYPE_COLORS: Record<LetterReminderType, string> = {
  DEADLINE_APPROACHING: '#F59E0B', // amber
  DEADLINE_OVERDUE: '#EF4444', // red
  NO_RESPONSE: '#3B82F6', // blue
  STALLED: '#6B7280', // gray
  FOLLOW_UP: '#10B981', // green
  CUSTOM: '#8B5CF6', // purple
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger.server'
import {
  getPendingReminders,
  markReminderAsSent,
  REMINDER_TYPE_LABELS,
} from '@/lib/letter-reminders'
import { sendEmail } from '@/lib/email'

/**
 * POST /api/letters/reminders/process
 *
 * Обрабатывает все просроченные напоминания:
 * - Отправляет уведомления владельцам писем
 * - Создаёт in-app уведомления
 * - Отмечает напоминания как отправленные
 *
 * Запускается по cron-расписанию (например, каждые 15 минут)
 */
export async function POST(request: NextRequest) {
  try {
    // Простая защита от несанкционированного доступа
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'dev-secret'

    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('POST /api/letters/reminders/process', 'Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pendingReminders = await getPendingReminders()

    if (pendingReminders.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No pending reminders',
      })
    }

    logger.info('POST /api/letters/reminders/process', `Processing ${pendingReminders.length} reminders`)

    let successCount = 0
    let errorCount = 0

    for (const reminder of pendingReminders) {
      try {
        const { letter } = reminder
        const owner = letter.owner

        if (!owner) {
          logger.warn('POST /api/letters/reminders/process', 'Letter has no owner', {
            letterId: letter.id,
            reminderId: reminder.id,
          })
          await markReminderAsSent(reminder.id)
          continue
        }

        // 1. Создаём in-app уведомление
        if (owner.notifyInApp) {
          await prisma.notification.create({
            data: {
              userId: owner.id,
              letterId: letter.id,
              type: 'REMINDER',
              title: REMINDER_TYPE_LABELS[reminder.type],
              body: reminder.message,
            },
          })
        }

        // 2. Отправляем email уведомление
        if (owner.notifyEmail && owner.email) {
          const letterUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/letters/${letter.id}`

          await sendEmail(
            owner.email,
            `Напоминание: ${REMINDER_TYPE_LABELS[reminder.type]}`,
            `${reminder.message}\n\nПисьмо: ${letter.number}\nОрганизация: ${letter.org}\n\nПосмотреть: ${letterUrl}`,
            `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0;">
                  <h1 style="color: white; margin: 0;">🔔 Напоминание</h1>
                </div>
                <div style="background: #f7fafc; padding: 30px; border-radius: 0 0 10px 10px;">
                  <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #667eea;">
                    <h2 style="margin-top: 0; color: #2d3748;">${REMINDER_TYPE_LABELS[reminder.type]}</h2>
                    <p style="color: #4a5568; font-size: 16px; line-height: 1.5;">${reminder.message}</p>
                  </div>

                  <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 5px 0; color: #4a5568;">
                      <strong>Письмо:</strong> ${letter.number}
                    </p>
                    <p style="margin: 5px 0; color: #4a5568;">
                      <strong>Организация:</strong> ${letter.org}
                    </p>
                    <p style="margin: 5px 0; color: #4a5568;">
                      <strong>Дедлайн:</strong> ${new Date(letter.deadlineDate).toLocaleDateString('ru-RU')}
                    </p>
                  </div>

                  <a href="${letterUrl}"
                     style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px;
                            font-weight: bold;">
                    Открыть письмо
                  </a>

                  <p style="color: #718096; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                    Это автоматическое напоминание из системы управления письмами
                  </p>
                </div>
              </div>
            `
          ).catch((err) => {
            logger.error('POST /api/letters/reminders/process', 'Failed to send email', {
              reminderId: reminder.id,
              email: owner.email,
              error: err,
            })
          })
        }

        // 3. TODO: Отправка в Telegram (если нужно)
        // if (owner.notifyTelegram && owner.telegramChatId) {
        //   await sendTelegramMessage(owner.telegramChatId, reminder.message)
        // }

        // Отмечаем как отправленное
        await markReminderAsSent(reminder.id)
        successCount++

        logger.info('POST /api/letters/reminders/process', 'Reminder processed', {
          reminderId: reminder.id,
          letterId: letter.id,
          type: reminder.type,
        })
      } catch (error) {
        errorCount++
        logger.error('POST /api/letters/reminders/process', 'Error processing reminder', {
          reminderId: reminder.id,
          error,
        })
      }
    }

    return NextResponse.json({
      success: true,
      processed: successCount,
      errors: errorCount,
      total: pendingReminders.length,
    })
  } catch (error) {
    logger.error('POST /api/letters/reminders/process', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

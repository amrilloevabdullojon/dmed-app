import type { LetterReminderType } from '@prisma/client'

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

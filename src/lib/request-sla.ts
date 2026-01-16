import { RequestPriority, SlaStatus } from '@prisma/client'

// SLA правила по приоритетам (в часах)
const SLA_RULES = {
  URGENT: {
    firstResponse: 1, // 1 час на первый ответ
    resolution: 4, // 4 часа на решение
  },
  HIGH: {
    firstResponse: 4, // 4 часа на первый ответ
    resolution: 24, // 24 часа на решение
  },
  NORMAL: {
    firstResponse: 24, // 24 часа на первый ответ
    resolution: 72, // 72 часа (3 дня) на решение
  },
  LOW: {
    firstResponse: 48, // 48 часов на первый ответ
    resolution: 168, // 168 часов (7 дней) на решение
  },
}

/**
 * Рассчитывает дедлайн SLA на основе приоритета
 */
export function calculateSlaDeadline(
  createdAt: Date,
  priority: RequestPriority
): Date {
  const rules = SLA_RULES[priority]
  const deadline = new Date(createdAt)
  deadline.setHours(deadline.getHours() + rules.resolution)
  return deadline
}

/**
 * Рассчитывает время для первого ответа
 */
export function calculateFirstResponseDeadline(
  createdAt: Date,
  priority: RequestPriority
): Date {
  const rules = SLA_RULES[priority]
  const deadline = new Date(createdAt)
  deadline.setHours(deadline.getHours() + rules.firstResponse)
  return deadline
}

/**
 * Определяет статус SLA
 */
export function calculateSlaStatus(
  slaDeadline: Date | null,
  resolvedAt: Date | null,
  status: string
): SlaStatus {
  if (!slaDeadline) return 'ON_TIME'

  const now = new Date()
  const deadline = new Date(slaDeadline)

  // Если заявка завершена
  if (status === 'DONE' || resolvedAt) {
    const resolutionTime = resolvedAt || now
    return resolutionTime <= deadline ? 'ON_TIME' : 'BREACHED'
  }

  // Если заявка еще в работе
  const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)

  if (now > deadline) {
    return 'BREACHED'
  } else if (hoursUntilDeadline <= 2) {
    // Менее 2 часов до дедлайна - под угрозой
    return 'AT_RISK'
  } else {
    return 'ON_TIME'
  }
}

/**
 * Получает время, оставшееся до дедлайна (в часах)
 */
export function getTimeUntilDeadline(slaDeadline: Date | null): number | null {
  if (!slaDeadline) return null

  const now = new Date()
  const deadline = new Date(slaDeadline)
  const hours = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)

  return Math.round(hours * 10) / 10 // Округление до 1 знака
}

/**
 * Форматирует оставшееся время в читаемый вид
 */
export function formatTimeRemaining(slaDeadline: Date | null): string {
  const hours = getTimeUntilDeadline(slaDeadline)

  if (hours === null) return '—'

  if (hours < 0) {
    const absHours = Math.abs(hours)
    if (absHours < 24) {
      return `Просрочено на ${absHours.toFixed(1)} ч`
    } else {
      const days = Math.floor(absHours / 24)
      return `Просрочено на ${days} д`
    }
  }

  if (hours < 1) {
    const minutes = Math.round(hours * 60)
    return `${minutes} мин`
  } else if (hours < 24) {
    return `${hours.toFixed(1)} ч`
  } else {
    const days = Math.floor(hours / 24)
    const remainingHours = Math.round(hours % 24)
    return `${days} д ${remainingHours} ч`
  }
}

/**
 * Получает цвет статуса SLA
 */
export function getSlaStatusColor(status: SlaStatus): string {
  switch (status) {
    case 'ON_TIME':
      return '#10B981' // green
    case 'AT_RISK':
      return '#F59E0B' // amber
    case 'BREACHED':
      return '#EF4444' // red
    default:
      return '#6B7280' // gray
  }
}

/**
 * Получает метку статуса SLA
 */
export function getSlaStatusLabel(status: SlaStatus): string {
  switch (status) {
    case 'ON_TIME':
      return 'В срок'
    case 'AT_RISK':
      return 'Под угрозой'
    case 'BREACHED':
      return 'Нарушен'
    default:
      return '—'
  }
}

/**
 * Проверяет, нужно ли обновить SLA статус
 */
export function shouldUpdateSlaStatus(
  currentStatus: SlaStatus,
  slaDeadline: Date | null,
  resolvedAt: Date | null,
  requestStatus: string
): boolean {
  if (!slaDeadline) return false

  const newStatus = calculateSlaStatus(slaDeadline, resolvedAt, requestStatus)
  return currentStatus !== newStatus
}

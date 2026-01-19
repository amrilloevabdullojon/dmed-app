import { z } from 'zod'

export type NotificationDigest = 'instant' | 'daily' | 'weekly' | 'never'

export type QuietMode = 'all' | 'important'

export type NotificationChannel = 'inApp' | 'email' | 'telegram' | 'sms' | 'push'

export type NotificationEventType =
  | 'NEW_LETTER'
  | 'COMMENT'
  | 'STATUS'
  | 'ASSIGNMENT'
  | 'DEADLINE_URGENT'
  | 'DEADLINE_OVERDUE'
  | 'SYSTEM'

export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical'

export interface NotificationMatrixItem {
  event: NotificationEventType
  channels: Record<NotificationChannel, boolean>
  priority: NotificationPriority
}

export type NotificationSubscriptionScope = 'role' | 'user' | 'all'

export type NotificationSubscriptionEvent = NotificationEventType | 'ALL'

export interface NotificationSubscription {
  event: NotificationSubscriptionEvent
  scope: NotificationSubscriptionScope
  value?: string
}

export interface NotificationSettings {
  inAppNotifications: boolean
  emailNotifications: boolean
  telegramNotifications: boolean
  smsNotifications: boolean
  emailDigest: NotificationDigest
  soundNotifications: boolean
  pushNotifications: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  quietMode: QuietMode
  groupSimilar: boolean
  showPreviews: boolean
  showOrganizations: boolean
  notifyOnNewLetter: boolean
  notifyOnStatusChange: boolean
  notifyOnComment: boolean
  notifyOnAssignment: boolean
  notifyOnDeadline: boolean
  notifyOnSystem: boolean
  matrix: NotificationMatrixItem[]
  subscriptions: NotificationSubscription[]
}

// ==================== ZOD VALIDATION SCHEMAS ====================

/**
 * Валидация времени в формате HH:MM
 */
export const timeStringSchema = z
  .string()
  .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Время должно быть в формате HH:MM (00:00-23:59)')

/**
 * Валидация event type - только разрешённые значения
 */
export const notificationEventSchema = z.enum([
  'NEW_LETTER',
  'COMMENT',
  'STATUS',
  'ASSIGNMENT',
  'DEADLINE_URGENT',
  'DEADLINE_OVERDUE',
  'SYSTEM',
])

/**
 * Валидация приоритета
 */
export const notificationPrioritySchema = z.enum(['low', 'normal', 'high', 'critical'])

/**
 * Валидация каналов уведомлений
 * Требование: хотя бы один канал должен быть включён
 */
export const notificationChannelsSchema = z
  .object({
    inApp: z.boolean(),
    email: z.boolean(),
    telegram: z.boolean(),
    sms: z.boolean(),
    push: z.boolean(),
  })
  .refine((channels) => Object.values(channels).some((enabled) => enabled === true), {
    message: 'Хотя бы один канал уведомлений должен быть включён',
  })

/**
 * Валидация одного элемента матрицы уведомлений
 */
export const notificationMatrixItemSchema = z.object({
  event: notificationEventSchema,
  channels: notificationChannelsSchema,
  priority: notificationPrioritySchema,
})

/**
 * Валидация матрицы уведомлений
 * Требование: должны быть все обязательные события
 */
export const notificationMatrixSchema = z.array(notificationMatrixItemSchema).refine(
  (matrix) => {
    const events = new Set(matrix.map((item) => item.event))
    const requiredEvents: NotificationEventType[] = [
      'NEW_LETTER',
      'COMMENT',
      'STATUS',
      'ASSIGNMENT',
      'DEADLINE_URGENT',
      'DEADLINE_OVERDUE',
      'SYSTEM',
    ]
    return requiredEvents.every((event) => events.has(event))
  },
  {
    message: 'Матрица уведомлений должна содержать все типы событий',
  }
)

/**
 * Валидация подписки на уведомления
 */
export const notificationSubscriptionSchema = z.object({
  event: z.union([z.literal('ALL'), notificationEventSchema]),
  scope: z.enum(['role', 'user', 'all']),
  value: z.string().optional(),
})

/**
 * Валидация полных настроек уведомлений
 */

const quietHoursMismatchMessage = 'Время начала и окончания тихих часов не может быть одинаковым'

const notificationSettingsBaseSchema = z
  .object({
    // Channel toggles
    inAppNotifications: z.boolean(),
    emailNotifications: z.boolean(),
    telegramNotifications: z.boolean(),
    smsNotifications: z.boolean(),
    pushNotifications: z.boolean(),

    // Email settings
    emailDigest: z.enum(['instant', 'daily', 'weekly', 'never']),

    // Sound
    soundNotifications: z.boolean(),

    // Quiet hours
    quietHoursEnabled: z.boolean(),
    quietHoursStart: timeStringSchema,
    quietHoursEnd: timeStringSchema,
    quietMode: z.enum(['all', 'important']),

    // Display preferences
    groupSimilar: z.boolean(),
    showPreviews: z.boolean(),
    showOrganizations: z.boolean(),

    // Event toggles
    notifyOnNewLetter: z.boolean(),
    notifyOnStatusChange: z.boolean(),
    notifyOnComment: z.boolean(),
    notifyOnAssignment: z.boolean(),
    notifyOnDeadline: z.boolean(),
    notifyOnSystem: z.boolean(),

    // Matrix and subscriptions
    matrix: notificationMatrixSchema,
    subscriptions: z.array(notificationSubscriptionSchema),
  })
  .strict() // Не позволять дополнительные поля

export const notificationSettingsSchema = notificationSettingsBaseSchema.refine(
  (settings) => {
    if (settings.quietHoursEnabled) {
      return settings.quietHoursStart !== settings.quietHoursEnd
    }
    return true
  },
  {
    message: quietHoursMismatchMessage,
    path: ['quietHoursEnabled'],
  }
)

/**
 * Валидация частичных обновлений настроек
 * Все поля опциональны, но если указаны - должны быть валидны
 */

export const notificationSettingsUpdateSchema = notificationSettingsBaseSchema
  .partial()
  .superRefine((settings, ctx) => {
    if (!settings.quietHoursEnabled) return
    if (!settings.quietHoursStart || !settings.quietHoursEnd) return
    if (settings.quietHoursStart === settings.quietHoursEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: quietHoursMismatchMessage,
        path: ['quietHoursEnabled'],
      })
    }
  })

const defaultMatrix: NotificationMatrixItem[] = [
  {
    event: 'NEW_LETTER',
    channels: { inApp: true, email: true, telegram: false, sms: false, push: false },
    priority: 'normal',
  },
  {
    event: 'COMMENT',
    channels: { inApp: true, email: true, telegram: false, sms: false, push: false },
    priority: 'normal',
  },
  {
    event: 'STATUS',
    channels: { inApp: true, email: false, telegram: false, sms: false, push: false },
    priority: 'normal',
  },
  {
    event: 'ASSIGNMENT',
    channels: { inApp: true, email: true, telegram: true, sms: false, push: false },
    priority: 'high',
  },
  {
    event: 'DEADLINE_URGENT',
    channels: { inApp: true, email: true, telegram: true, sms: false, push: false },
    priority: 'high',
  },
  {
    event: 'DEADLINE_OVERDUE',
    channels: { inApp: true, email: true, telegram: true, sms: true, push: false },
    priority: 'critical',
  },
  {
    event: 'SYSTEM',
    channels: { inApp: true, email: false, telegram: false, sms: false, push: false },
    priority: 'low',
  },
]

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  inAppNotifications: true,
  emailNotifications: true,
  telegramNotifications: false,
  smsNotifications: false,
  emailDigest: 'instant',
  soundNotifications: true,
  pushNotifications: false,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  quietMode: 'important',
  groupSimilar: true,
  showPreviews: true,
  showOrganizations: true,
  notifyOnNewLetter: true,
  notifyOnStatusChange: true,
  notifyOnComment: true,
  notifyOnAssignment: true,
  notifyOnDeadline: true,
  notifyOnSystem: true,
  matrix: defaultMatrix,
  subscriptions: [],
}

const parseTime = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

export const isWithinQuietHours = (date: Date, start: string, end: string) => {
  const startMinutes = parseTime(start)
  const endMinutes = parseTime(end)
  if (startMinutes === null || endMinutes === null) return false

  const currentMinutes = date.getHours() * 60 + date.getMinutes()
  if (startMinutes === endMinutes) return true
  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes
}

export const normalizeNotificationSettings = (
  settings?: Partial<NotificationSettings> | null
): NotificationSettings => {
  if (!settings) return DEFAULT_NOTIFICATION_SETTINGS
  const matrixMap = new Map(DEFAULT_NOTIFICATION_SETTINGS.matrix.map((item) => [item.event, item]))
  if (settings.matrix && settings.matrix.length > 0) {
    settings.matrix.forEach((item) => {
      matrixMap.set(item.event, item)
    })
  }
  const mergedMatrix = Array.from(matrixMap.values())
  const subscriptions = (settings.subscriptions ?? DEFAULT_NOTIFICATION_SETTINGS.subscriptions).map(
    (subscription) => ({
      ...subscription,
      event: subscription.event ?? 'ALL',
    })
  )
  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...settings,
    matrix: mergedMatrix,
    subscriptions,
  }
}

/**
 * Валидация и нормализация настроек уведомлений
 * Возвращает либо валидные настройки, либо выбрасывает ошибку валидации
 *
 * @example
 * try {
 *   const settings = validateAndNormalizeSettings({ emailNotifications: true })
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     console.error('Validation failed:', error.errors)
 *   }
 * }
 */
export const validateAndNormalizeSettings = (
  settings: Partial<NotificationSettings>
): NotificationSettings => {
  const normalized = normalizeNotificationSettings(settings)
  return notificationSettingsSchema.parse(normalized)
}

/**
 * Безопасная валидация настроек уведомлений
 * Возвращает результат валидации без выбрасывания ошибки
 *
 * @example
 * const result = safeValidateSettings({ emailNotifications: true })
 * if (result.success) {
 *   console.log('Valid settings:', result.data)
 * } else {
 *   console.error('Validation errors:', result.error.errors)
 * }
 */
export const safeValidateSettings = (settings: Partial<NotificationSettings>) => {
  const normalized = normalizeNotificationSettings(settings)
  return notificationSettingsSchema.safeParse(normalized)
}

/**
 * Валидация частичных обновлений настроек
 */
export const validateSettingsUpdate = (updates: Partial<NotificationSettings>) => {
  return notificationSettingsUpdateSchema.parse(updates)
}

/**
 * Безопасная валидация частичных обновлений
 */
export const safeValidateSettingsUpdate = (updates: Partial<NotificationSettings>) => {
  return notificationSettingsUpdateSchema.safeParse(updates)
}

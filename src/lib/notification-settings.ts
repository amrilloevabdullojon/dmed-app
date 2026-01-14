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

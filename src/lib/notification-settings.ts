export type NotificationDigest = 'instant' | 'daily' | 'weekly' | 'never'

export type QuietMode = 'all' | 'important'

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
}

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

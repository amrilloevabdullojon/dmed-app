// Types for Settings module

export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'EMPLOYEE' | 'VIEWER'
export type DigestFrequency = 'NONE' | 'DAILY' | 'WEEKLY'
export type SyncDirection = 'TO_SHEETS' | 'FROM_SHEETS'
export type SyncStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
export type ApprovalAction = 'DEMOTE_ADMIN' | 'DELETE_ADMIN'
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface User {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: UserRole
  canLogin: boolean
  telegramChatId: string | null
  notifyEmail: boolean
  notifyTelegram: boolean
  notifySms: boolean
  notifyInApp: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
  digestFrequency: DigestFrequency
  createdAt: string
  lastLoginAt: string | null
  _count: {
    letters: number
    comments: number
    sessions: number
  }
}

export interface UserEditData {
  name: string
  email: string
  role: UserRole
  telegramChatId: string
  canLogin: boolean
  notifyEmail: boolean
  notifyTelegram: boolean
  notifySms: boolean
  notifyInApp: boolean
  quietHoursStart: string
  quietHoursEnd: string
  digestFrequency: DigestFrequency
}

export interface UserCreateData {
  name: string
  email: string
  role: UserRole
  telegramChatId: string
}

export interface SyncLog {
  id: string
  direction: SyncDirection
  status: SyncStatus
  rowsAffected: number
  error: string | null
  startedAt: string
  finishedAt: string | null
}

export interface UserAuditEntry {
  id: string
  action: string
  field: string | null
  oldValue: string | null
  newValue: string | null
  createdAt: string
  actor: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  } | null
}

export interface AdminApproval {
  id: string
  action: ApprovalAction
  status: ApprovalStatus
  createdAt: string
  targetUser: {
    id: string
    name: string | null
    email: string | null
    role: UserRole
  }
  requestedBy: {
    id: string
    name: string | null
    email: string | null
  }
  payload: { newRole?: UserRole } | null
}

export interface LoginAuditEntry {
  id: string
  email: string
  success: boolean
  reason: string | null
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string | null
    role: UserRole
  } | null
}

export interface LoginAuditDaySummary {
  date: string
  success: number
  failure: number
}

export interface AuditFilters {
  action: string
  field: string
  query: string
  actor: string
}

// Constants
export const ROLE_LABELS: Record<UserRole, string> = {
  SUPERADMIN: 'Суперадмин',
  ADMIN: 'Админ',
  MANAGER: 'Менеджер',
  AUDITOR: 'Аудитор',
  EMPLOYEE: 'Сотрудник',
  VIEWER: 'Наблюдатель',
}

export const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  SUPERADMIN:
    'bg-gradient-to-r from-yellow-500/30 via-amber-400/30 to-yellow-600/30 text-yellow-100 border border-yellow-400/40 shadow-[0_0_12px_rgba(251,191,36,0.35)]',
  ADMIN: 'bg-amber-500/20 text-amber-300 border border-amber-400/30',
  MANAGER: 'bg-blue-500/20 text-blue-300 border border-blue-400/30',
  AUDITOR: 'bg-purple-500/20 text-purple-300 border border-purple-400/30',
  EMPLOYEE: 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30',
  VIEWER: 'bg-slate-500/20 text-slate-300 border border-slate-400/30',
}

export const ROLE_ORDER: UserRole[] = [
  'SUPERADMIN',
  'ADMIN',
  'MANAGER',
  'AUDITOR',
  'EMPLOYEE',
  'VIEWER',
]

export const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = ROLE_ORDER.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}))

export const DIGEST_LABELS: Record<DigestFrequency, string> = {
  NONE: 'Нет',
  DAILY: 'Ежедневно',
  WEEKLY: 'Еженедельно',
}

export const DIGEST_OPTIONS: Array<{ value: DigestFrequency; label: string }> = [
  { value: 'NONE', label: DIGEST_LABELS.NONE },
  { value: 'DAILY', label: DIGEST_LABELS.DAILY },
  { value: 'WEEKLY', label: DIGEST_LABELS.WEEKLY },
]

export const AUDIT_ACTION_OPTIONS = [
  { value: 'all', label: 'Все действия' },
  { value: 'CREATE', label: 'Создание' },
  { value: 'UPDATE', label: 'Обновления' },
  { value: 'ROLE', label: 'Роли' },
  { value: 'ACCESS', label: 'Доступ' },
  { value: 'DELETE', label: 'Удаление' },
]

export const AUDIT_FIELD_OPTIONS = [
  { value: 'all', label: 'Все поля' },
  { value: 'name', label: 'Имя' },
  { value: 'email', label: 'Email' },
  { value: 'role', label: 'Роль' },
  { value: 'canLogin', label: 'Доступ' },
  { value: 'telegramChatId', label: 'Telegram' },
  { value: 'notifyEmail', label: 'Email уведомления' },
  { value: 'notifyTelegram', label: 'Telegram уведомления' },
  { value: 'notifySms', label: 'SMS уведомления' },
  { value: 'notifyInApp', label: 'Внутри системы' },
  { value: 'quietHoursStart', label: 'Тихие часы (с)' },
  { value: 'quietHoursEnd', label: 'Тихие часы (до)' },
  { value: 'digestFrequency', label: 'Дайджест' },
]

export const AUDIT_ACTION_BADGES: Record<string, { label: string; className: string }> = {
  CREATE: { label: 'Создано', className: 'bg-emerald-500/20 text-emerald-300' },
  UPDATE: { label: 'Обновлено', className: 'bg-blue-500/20 text-blue-300' },
  ROLE: { label: 'Роль', className: 'bg-amber-500/20 text-amber-300' },
  ACCESS: { label: 'Доступ', className: 'bg-purple-500/20 text-purple-300' },
  DELETE: { label: 'Удалено', className: 'bg-red-500/20 text-red-300' },
}

export const LOGIN_STATUS_OPTIONS = [
  { value: 'all', label: 'Все попытки' },
  { value: 'success', label: 'Успешные' },
  { value: 'failure', label: 'Ошибки' },
]

export const INACTIVE_WARNING_DAYS = 7

// Form field styles
export const fieldBase =
  'rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-400 focus:outline-none focus:border-teal-400/80 focus:ring-1 focus:ring-teal-400/40'

export const fieldCompact =
  'rounded-lg border border-white/10 bg-white/5 text-white placeholder-slate-400 focus:outline-none focus:border-teal-400/80 focus:ring-1 focus:ring-teal-400/40'

// Helper functions
export function getInitialEditData(): UserEditData {
  return {
    name: '',
    email: '',
    role: 'EMPLOYEE',
    telegramChatId: '',
    canLogin: true,
    notifyEmail: true,
    notifyTelegram: false,
    notifySms: false,
    notifyInApp: true,
    quietHoursStart: '',
    quietHoursEnd: '',
    digestFrequency: 'NONE',
  }
}

export function getInitialCreateData(): UserCreateData {
  return {
    name: '',
    email: '',
    role: 'EMPLOYEE',
    telegramChatId: '',
  }
}

export function userToEditData(user: User): UserEditData {
  return {
    name: user.name || '',
    email: user.email || '',
    role: user.role,
    telegramChatId: user.telegramChatId || '',
    canLogin: user.canLogin,
    notifyEmail: user.notifyEmail,
    notifyTelegram: user.notifyTelegram,
    notifySms: user.notifySms,
    notifyInApp: user.notifyInApp,
    quietHoursStart: user.quietHoursStart || '',
    quietHoursEnd: user.quietHoursEnd || '',
    digestFrequency: user.digestFrequency,
  }
}

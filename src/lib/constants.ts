import type { LetterStatus } from '@prisma/client'

// ==================== СТАТУСЫ ====================

export const STATUSES: { value: LetterStatus | 'all'; label: string; color: string }[] = [
  { value: 'all', label: 'Все статусы', color: 'bg-gray-500' },
  { value: 'NOT_REVIEWED', label: 'Не рассмотрен', color: 'bg-gray-500' },
  { value: 'ACCEPTED', label: 'Принят', color: 'bg-blue-500' },
  { value: 'IN_PROGRESS', label: 'В работе', color: 'bg-yellow-500' },
  { value: 'CLARIFICATION', label: 'На уточнении', color: 'bg-purple-500' },
  { value: 'READY', label: 'Готово', color: 'bg-green-500' },
  { value: 'DONE', label: 'Сделано', color: 'bg-emerald-500' },
]

export const STATUS_OPTIONS = STATUSES.filter(s => s.value !== 'all')

// ==================== ПРИОРИТЕТЫ ====================

export const PRIORITY_THRESHOLDS = {
  HIGH: 70,
  MEDIUM: 40,
  LOW: 0,
} as const

export const PRIORITY_LABELS = {
  HIGH: { label: 'Высокий', color: 'text-red-600', bgColor: 'bg-red-500' },
  MEDIUM: { label: 'Средний', color: 'text-yellow-600', bgColor: 'bg-yellow-500' },
  LOW: { label: 'Низкий', color: 'text-green-600', bgColor: 'bg-green-500' },
} as const

// ==================== ВРЕМЕННЫЕ КОНСТАНТЫ ====================

export const URGENT_DAYS = 3 // Дней до дедлайна для "срочных"
export const OVERDUE_DAYS = 0 // Просроченные

// ==================== ПАГИНАЦИЯ ====================

export const PAGE_SIZE = 50
export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const

// ==================== ФАЙЛЫ ====================

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
export const MAX_FILE_SIZE_LABEL = '10 MB'

export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain',
] as const

export const ALLOWED_FILE_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt'

// ==================== ТИПЫ ПИСЕМ ====================

export const LETTER_TYPES = [
  { value: 'all', label: '\u0412\u0441\u0435 \u0442\u0438\u043f\u044b' },
  { value: '\u0411\u0430\u0433', label: '\u0411\u0430\u0433' },
  { value: '\u0417\u0430\u043a\u0440\u044b\u0442\u0438\u0435 \u0431\u043e\u043b\u044c\u043d\u0438\u0447\u043d\u043e\u0433\u043e \u043b\u0438\u0441\u0442\u0430', label: '\u0417\u0430\u043a\u0440\u044b\u0442\u0438\u0435 \u0431\u043e\u043b\u044c\u043d\u0438\u0447\u043d\u043e\u0433\u043e \u043b\u0438\u0441\u0442\u0430' },
  { value: '\u0417\u0430\u043f\u0440\u043e\u0441 \u043d\u0430 \u0432\u043d\u0435\u0434\u0440\u0435\u043d\u0438\u0435', label: '\u0417\u0430\u043f\u0440\u043e\u0441 \u043d\u0430 \u0432\u043d\u0435\u0434\u0440\u0435\u043d\u0438\u0435' },
  { value: '\u0417\u0430\u043f\u0440\u043e\u0441 \u043d\u0430 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044e', label: '\u0417\u0430\u043f\u0440\u043e\u0441 \u043d\u0430 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044e' },
  { value: '\u0417\u0430\u043f\u0440\u043e\u0441 \u043d\u0430 \u043e\u0431\u0443\u0447\u0435\u043d\u0438\u0435', label: '\u0417\u0430\u043f\u0440\u043e\u0441 \u043d\u0430 \u043e\u0431\u0443\u0447\u0435\u043d\u0438\u0435' },
  { value: '\u0417\u0430\u043f\u0440\u043e\u0441 \u043d\u0430 \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u0435 \u0434\u043e\u0441\u0442\u0443\u043f\u043e\u0432', label: '\u0417\u0430\u043f\u0440\u043e\u0441 \u043d\u0430 \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u0435 \u0434\u043e\u0441\u0442\u0443\u043f\u043e\u0432' },
  { value: '\u0417\u0430\u043f\u0440\u043e\u0441 \u043d\u0430 \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u0435 \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u0438', label: '\u0417\u0430\u043f\u0440\u043e\u0441 \u043d\u0430 \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u0435 \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u0438' },
  { value: '\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435 \u0434\u0430\u043d\u043d\u044b\u0445', label: '\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435 \u0434\u0430\u043d\u043d\u044b\u0445' },
  { value: '\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435 \u0434\u0430\u043d\u043d\u044b\u0445 \u0432 \u0438\u0441\u0442\u043e\u0440\u0438\u0438 \u0431\u043e\u043b\u0435\u0437\u043d\u0438', label: '\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435 \u0434\u0430\u043d\u043d\u044b\u0445 \u0432 \u0438\u0441\u0442\u043e\u0440\u0438\u0438 \u0431\u043e\u043b\u0435\u0437\u043d\u0438' },
  { value: '\u041e\u0442\u043a\u0440\u044b\u0442\u0438\u0435 \u0410\u043f\u0442\u0435\u043a', label: '\u041e\u0442\u043a\u0440\u044b\u0442\u0438\u0435 \u0410\u043f\u0442\u0435\u043a' },
  { value: '\u041e\u0447\u0438\u0441\u0442\u043a\u0430 \u0441\u043a\u043b\u0430\u0434\u0430', label: '\u041e\u0447\u0438\u0441\u0442\u043a\u0430 \u0441\u043a\u043b\u0430\u0434\u0430' },
  { value: '\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 PACS \u0438 \u041b\u0418\u0421', label: '\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 PACS \u0438 \u041b\u0418\u0421' },
  { value: '\u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 \u0447\u0430\u0441\u0442\u043d\u044b\u0445 \u043a\u043b\u0438\u043d\u0438\u043a', label: '\u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 \u0447\u0430\u0441\u0442\u043d\u044b\u0445 \u043a\u043b\u0438\u043d\u0438\u043a' },
  { value: '\u0422\u0438\u043a\u0435\u0442', label: '\u0422\u0438\u043a\u0435\u0442' },
  { value: '\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435 \u0414-\u0443\u0447\u0435\u0442\u0430', label: '\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435 \u0414-\u0443\u0447\u0435\u0442\u0430' },
  { value: '\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435 \u043e\u0441\u043c\u043e\u0442\u0440\u0430', label: '\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435 \u043e\u0441\u043c\u043e\u0442\u0440\u0430' },
  { value: '\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435 \u0441\u043a\u0440\u0438\u043d\u0438\u043d\u0433\u0430', label: '\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435 \u0441\u043a\u0440\u0438\u043d\u0438\u043d\u0433\u0430' },
  { value: '\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435 \u0441\u0447\u0435\u0442\u0430', label: '\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435 \u0441\u0447\u0435\u0442\u0430' },
  { value: '\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435 \u0443\u0447\u0451\u0442\u0430 \u043f\u043e \u0431\u0435\u0440\u0435\u043c\u0435\u043d\u043d\u043e\u0441\u0442\u0438', label: '\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435 \u0443\u0447\u0451\u0442\u0430 \u043f\u043e \u0431\u0435\u0440\u0435\u043c\u0435\u043d\u043d\u043e\u0441\u0442\u0438' },
  { value: '\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435/\u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435 \u0434\u0438\u0430\u0433\u043d\u043e\u0437\u0430', label: '\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435/\u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435 \u0434\u0438\u0430\u0433\u043d\u043e\u0437\u0430' },
  { value: '\u0424\u0438\u043a\u0441 \u0431\u0430\u0433\u043e\u0432 \u041c\u0435\u0434\u043a\u0430\u0440\u0442\u044b', label: '\u0424\u0438\u043a\u0441 \u0431\u0430\u0433\u043e\u0432 \u041c\u0435\u0434\u043a\u0430\u0440\u0442\u044b' },
] as const

// ==================== СОРТИРОВКА ====================

export const SORT_OPTIONS = [
  { value: 'date_desc', label: 'По дате (новые)' },
  { value: 'date_asc', label: 'По дате (старые)' },
  { value: 'deadline_asc', label: 'По дедлайну (ближайшие)' },
  { value: 'deadline_desc', label: 'По дедлайну (дальние)' },
  { value: 'priority_desc', label: 'По приоритету (высокий)' },
  { value: 'priority_asc', label: 'По приоритету (низкий)' },
  { value: 'number_asc', label: 'По номеру (↑)' },
  { value: 'number_desc', label: 'По номеру (↓)' },
] as const

// ==================== КАТЕГОРИИ ШАБЛОНОВ ====================

export const TEMPLATE_CATEGORIES = [
  { value: 'response', label: 'Ответы' },
  { value: 'request', label: 'Запросы' },
  { value: 'notification', label: 'Уведомления' },
  { value: 'other', label: 'Другое' },
] as const

// ==================== РОЛИ ====================

export const USER_ROLES = {
  ADMIN: { label: "Администратор", color: 'text-red-500' },
  MANAGER: { label: "Менеджер", color: 'text-amber-500' },
  AUDITOR: { label: "Аудитор", color: 'text-purple-500' },
  EMPLOYEE: { label: "Сотрудник", color: 'text-blue-500' },
  VIEWER: { label: "Наблюдатель", color: 'text-slate-500' },
} as const

// ==================== ДАТЫ ====================

export const DATE_FORMAT = 'dd.MM.yyyy'
export const DATETIME_FORMAT = 'dd.MM.yyyy HH:mm'
export const MONTHS_TO_SHOW = 12 // Для графиков

// ==================== API ====================

export const API_ENDPOINTS = {
  LETTERS: '/api/letters',
  STATS: '/api/stats',
  USERS: '/api/users',
  TEMPLATES: '/api/templates',
  FAVORITES: '/api/favorites',
  SYNC: '/api/sync',
  EXPORT: '/api/export',
} as const

import { Letter, User } from '@prisma/client'

/**
 * Доступные переменные для шаблонов писем
 */
export const LETTER_TEMPLATE_VARIABLES = {
  // Информация о письме
  'letter.number': 'Номер письма',
  'letter.org': 'Организация',
  'letter.date': 'Дата письма',
  'letter.deadlineDate': 'Дата дедлайна',
  'letter.status': 'Статус',
  'letter.type': 'Тип запроса',
  'letter.content': 'Содержание письма',
  'letter.zordoc': 'ZorDoc номер',
  'letter.jiraLink': 'Ссылка на Jira',

  // Информация о заявителе
  'applicant.name': 'Имя заявителя',
  'applicant.email': 'Email заявителя',
  'applicant.phone': 'Телефон заявителя',
  'applicant.contacts': 'Контакты заявителя',

  // Информация об ответственном
  'owner.name': 'Имя ответственного',
  'owner.email': 'Email ответственного',

  // Системные переменные
  'current.date': 'Текущая дата',
  'current.time': 'Текущее время',
  'current.datetime': 'Текущая дата и время',
}

/**
 * Тип для данных письма с owner (совместим с разными источниками)
 */
type LetterWithOwner = Letter & {
  owner?: User | null
}

/**
 * Минимальный тип для подстановки переменных
 */
type LetterForSubstitution = {
  number?: string | null
  org?: string | null
  date?: Date | string | null
  deadlineDate?: Date | string | null
  status?: string
  type?: string | null
  content?: string | null
  zordoc?: string | null
  jiraLink?: string | null
  applicantName?: string | null
  applicantEmail?: string | null
  applicantPhone?: string | null
  contacts?: string | null
  owner?: {
    name?: string | null
    email?: string | null
  } | null
  [key: string]: any
}

/**
 * Форматирует дату в удобочитаемый формат
 */
function formatDate(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Форматирует время в удобочитаемый формат
 */
function formatTime(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Форматирует дату и время
 */
function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return ''
  return `${formatDate(date)} ${formatTime(date)}`
}

/**
 * Статусы писем на русском языке
 */
const STATUS_LABELS: Record<string, string> = {
  NOT_REVIEWED: 'Не рассмотрен',
  ACCEPTED: 'Принят',
  IN_PROGRESS: 'В работе',
  CLARIFICATION: 'На уточнении',
  READY: 'Готово',
  DONE: 'Сделано',
}

/**
 * Заменяет переменные в тексте на реальные значения
 *
 * @param text - Текст шаблона с переменными вида {{variable.name}}
 * @param letter - Объект письма
 * @returns Текст с заменёнными переменными
 */
export function substituteLetterVariables(
  text: string,
  letter: LetterForSubstitution
): string {
  let result = text

  // Создаём карту замен
  const replacements: Record<string, string> = {
    // Информация о письме
    'letter.number': letter.number || '',
    'letter.org': letter.org || '',
    'letter.date': formatDate(letter.date),
    'letter.deadlineDate': formatDate(letter.deadlineDate),
    'letter.status': letter.status ? (STATUS_LABELS[letter.status] || letter.status) : '',
    'letter.type': letter.type || '',
    'letter.content': letter.content || '',
    'letter.zordoc': letter.zordoc || '',
    'letter.jiraLink': letter.jiraLink || '',

    // Информация о заявителе
    'applicant.name': letter.applicantName || '',
    'applicant.email': letter.applicantEmail || '',
    'applicant.phone': letter.applicantPhone || '',
    'applicant.contacts': letter.contacts || '',

    // Информация об ответственном
    'owner.name': letter.owner?.name || '',
    'owner.email': letter.owner?.email || '',

    // Системные переменные
    'current.date': formatDate(new Date()),
    'current.time': formatTime(new Date()),
    'current.datetime': formatDateTime(new Date()),
  }

  // Заменяем все переменные
  Object.entries(replacements).forEach(([key, value]) => {
    // Ищем переменные в формате {{key}} с учётом пробелов
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
    result = result.replace(regex, value)
  })

  return result
}

/**
 * Извлекает список используемых переменных из текста шаблона
 *
 * @param text - Текст шаблона
 * @returns Массив имён переменных
 */
export function extractTemplateVariables(text: string): string[] {
  const regex = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g
  const variables: string[] = []
  let match

  while ((match = regex.exec(text)) !== null) {
    const varName = match[1]
    if (varName && !variables.includes(varName)) {
      variables.push(varName)
    }
  }

  return variables
}

/**
 * Валидирует, что все переменные в тексте существуют
 *
 * @param text - Текст шаблона
 * @returns Объект с результатом валидации
 */
export function validateTemplateVariables(text: string): {
  valid: boolean
  unknownVariables: string[]
} {
  const usedVariables = extractTemplateVariables(text)
  const knownVariables = Object.keys(LETTER_TEMPLATE_VARIABLES)
  const unknownVariables = usedVariables.filter(
    (v) => !knownVariables.includes(v)
  )

  return {
    valid: unknownVariables.length === 0,
    unknownVariables,
  }
}

/**
 * Генерирует предпросмотр шаблона с примерными данными
 *
 * @param text - Текст шаблона
 * @returns Текст с заменёнными переменными на примерные значения
 */
export function previewTemplate(text: string): string {
  const mockLetter: LetterWithOwner = {
    id: 'sample-id',
    number: '№123/2026',
    org: 'ООО "Пример"',
    date: new Date(),
    deadlineDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'IN_PROGRESS',
    type: 'Консультация',
    content: 'Пример содержания письма...',
    zordoc: 'ZD-2026-001',
    answer: null,
    sendStatus: null,
    ijroDate: null,
    comment: null,
    contacts: '+998901234567',
    applicantName: 'Иван Иванов',
    applicantEmail: 'ivan@example.com',
    applicantPhone: '+998901234567',
    applicantTelegramChatId: null,
    applicantAccessToken: null,
    applicantAccessTokenExpiresAt: null,
    closeDate: null,
    jiraLink: 'https://jira.example.com/PROJ-123',
    priority: 50,
    attachmentsFolderId: null,
    ownerId: 'owner-id',
    owner: {
      id: 'owner-id',
      name: 'Мария Петрова',
      email: 'maria@example.com',
      emailVerified: null,
      image: null,
      role: 'MANAGER',
      canLogin: true,
      telegramChatId: null,
      notifyEmail: true,
      notifyTelegram: false,
      notifySms: false,
      notifyInApp: true,
      quietHoursStart: null,
      quietHoursEnd: null,
      digestFrequency: 'NONE',
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: new Date(),
    },
    sheetRowNum: null,
    lastSyncedAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  return substituteLetterVariables(text, mockLetter)
}

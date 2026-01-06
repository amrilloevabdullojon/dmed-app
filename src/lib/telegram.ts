import { logger } from '@/lib/logger'

// Telegram Bot API интеграция

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const APP_URL = process.env.NEXTAUTH_URL || process.env.APP_URL || ''

interface TelegramResponse {
  ok: boolean
  result?: unknown
  description?: string
}

// Отправить сообщение в Telegram
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  parseMode: 'HTML' | 'Markdown' = 'HTML'
): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN not configured')
    return false
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }),
    })

    const data: TelegramResponse = await response.json()

    if (!data.ok) {
      logger.error('Telegram', 'Telegram API error', { description: data.description })
      return false
    }

    return true
  } catch (error) {
    logger.error('Telegram', error)
    return false
  }
}

// Отправить уведомление нескольким пользователям
export async function sendTelegramToMany(chatIds: string[], text: string): Promise<number> {
  let sent = 0

  for (const chatId of chatIds) {
    const success = await sendTelegramMessage(chatId, text)
    if (success) sent++
  }

  return sent
}

// Уведомление о новом письме

const escapeTelegramHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function formatNewLetterMessage(letter: {
  number: string
  org: string
  deadline: string
  owner?: string
}): string {
  return `📬 <b>Новое письмо</b>

📋 №${letter.number}
🏢 ${letter.org}
📅 Дедлайн: ${letter.deadline}
👤 Ответственный: ${letter.owner || 'Не назначен'}

🔗 <a href="${process.env.NEXTAUTH_URL}">Открыть в системе</a>`
}

// Уведомление об изменении статуса
export function formatStatusChangeMessage(letter: {
  number: string
  org: string
  oldStatus: string
  newStatus: string
  changedBy: string
}): string {
  return `🔔 <b>Изменение статуса</b>

📋 Письмо №${letter.number} - ${letter.org}

📝 Статус:
Было: ${letter.oldStatus}
Стало: ${letter.newStatus}

👤 Изменил: ${letter.changedBy}`
}

// Уведомление о приближающемся дедлайне
export function formatDeadlineReminderMessage(letter: {
  number: string
  org: string
  deadline: string
  daysLeft: number
  owner?: string
}): string {
  const urgency =
    letter.daysLeft <= 0 ? '🔥 ПРОСРОЧЕНО' : letter.daysLeft === 1 ? '⚠️ СРОЧНО' : '⏰ НАПОМИНАНИЕ'

  return `${urgency}

📋 Письмо №${letter.number} - ${letter.org}

📅 Дедлайн: ${letter.deadline}
⏱️ ${letter.daysLeft <= 0 ? 'Просрочено на' : 'Осталось'}: ${Math.abs(letter.daysLeft)} дн.

👤 Ответственный: ${letter.owner || 'Не назначен'}`
}

// Уведомление о новом комментарии
export function formatNewCommentMessage(data: {
  letterNumber: string
  letterOrg: string
  author: string
  comment: string
  isMention: boolean
}): string {
  const title = data.isMention
    ? '💬 <b>Вас упомянули в комментарии</b>'
    : '💬 <b>Новый комментарий</b>'

  const preview = data.comment.length > 100 ? data.comment.substring(0, 100) + '...' : data.comment

  return `${title}

📋 Письмо №${data.letterNumber} - ${data.letterOrg}

👤 ${data.author}:
"${preview}"`
}

// ??????????? ? ????? ??????
export function formatNewRequestMessage(data: {
  id: string
  organization: string
  contactName: string
  contactEmail: string
  contactPhone: string
  contactTelegram: string
  description: string
  filesCount?: number
}): string {
  const preview =
    data.description.length > 200 ? `${data.description.slice(0, 200)}...` : data.description
  const safePreview = escapeTelegramHtml(preview)
  const safeOrg = escapeTelegramHtml(data.organization)
  const safeName = escapeTelegramHtml(data.contactName)
  const safeEmail = escapeTelegramHtml(data.contactEmail)
  const safePhone = escapeTelegramHtml(data.contactPhone)
  const safeTelegram = escapeTelegramHtml(data.contactTelegram)
  const baseUrl = APP_URL ? APP_URL.replace(/\/$/, '') : ''
  const link = baseUrl ? `${baseUrl}/requests/${data.id}` : `/requests/${data.id}`
  const filesInfo = data.filesCount
    ? `

Файлов: ${data.filesCount}`
    : ''

  return (
    `<b>Новая заявка</b>

` +
    `Организация: ${safeOrg}
` +
    `Контакт: ${safeName}
` +
    `Email: ${safeEmail}
` +
    `Телефон: ${safePhone}
` +
    `Telegram: ${safeTelegram}

` +
    `Описание: ${safePreview}${filesInfo}

` +
    `Открыть: <a href="${link}">${link}</a>`
  )
}

// Уведомление об изменении статуса заявки
export function formatRequestStatusChangeMessage(data: {
  id: string
  organization: string
  oldStatus: string
  newStatus: string
  changedBy: string
  assignedTo?: string | null
}): string {
  const safeOrg = escapeTelegramHtml(data.organization)
  const baseUrl = APP_URL ? APP_URL.replace(/\/$/, '') : ''
  const link = baseUrl ? `${baseUrl}/requests/${data.id}` : `/requests/${data.id}`

  const statusLabels: Record<string, string> = {
    NEW: 'Новая',
    IN_REVIEW: 'На рассмотрении',
    DONE: 'Завершена',
    SPAM: 'Спам',
  }

  const oldLabel = statusLabels[data.oldStatus] || data.oldStatus
  const newLabel = statusLabels[data.newStatus] || data.newStatus

  let message = `🔔 <b>Изменение статуса заявки</b>

🏢 ${safeOrg}

📝 Статус:
Было: ${oldLabel}
Стало: ${newLabel}

👤 Изменил: ${escapeTelegramHtml(data.changedBy)}`

  if (data.assignedTo) {
    message += `\n📋 Назначено: ${escapeTelegramHtml(data.assignedTo)}`
  }

  message += `\n\n🔗 <a href="${link}">Открыть заявку</a>`

  return message
}

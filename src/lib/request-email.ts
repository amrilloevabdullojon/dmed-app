import { sendEmail } from '@/lib/notifications'

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'

/**
 * Отправляет email уведомление о создании заявки
 */
export async function sendRequestCreatedEmail(request: {
  id: string
  organization: string
  contactName: string
  contactEmail: string
  description: string
}) {
  const trackingUrl = `${BASE_URL}/track/${request.id}`

  const subject = `Ваша заявка #${request.id.slice(0, 8)} получена`

  const text = `
Здравствуйте, ${request.contactName}!

Ваша заявка успешно получена и будет рассмотрена в ближайшее время.

Информация о заявке:
- Организация: ${request.organization}
- Описание: ${request.description.slice(0, 200)}${request.description.length > 200 ? '...' : ''}

Вы можете отследить статус заявки по ссылке:
${trackingUrl}

С уважением,
Команда поддержки
`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #10B981; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .info { background: white; padding: 15px; border-left: 4px solid #10B981; margin: 15px 0; }
    .button { display: inline-block; padding: 12px 24px; background: #10B981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Заявка получена</h1>
    </div>
    <div class="content">
      <p>Здравствуйте, ${request.contactName}!</p>
      <p>Ваша заявка успешно получена и будет рассмотрена в ближайшее время.</p>

      <div class="info">
        <p><strong>Информация о заявке:</strong></p>
        <p><strong>ID:</strong> #${request.id.slice(0, 8)}</p>
        <p><strong>Организация:</strong> ${request.organization}</p>
        <p><strong>Описание:</strong> ${request.description.slice(0, 200)}${request.description.length > 200 ? '...' : ''}</p>
      </div>

      <p>Вы можете отследить статус заявки:</p>
      <a href="${trackingUrl}" class="button">Отследить заявку</a>

      <p style="font-size: 14px; color: #6b7280;">Или скопируйте ссылку: ${trackingUrl}</p>
    </div>
    <div class="footer">
      <p>Это автоматическое уведомление, пожалуйста, не отвечайте на это письмо.</p>
    </div>
  </div>
</body>
</html>
`

  try {
    await sendEmail(request.contactEmail, subject, text, html)
  } catch (error) {
    console.error('Failed to send request created email:', error)
    // Не бросаем ошибку, чтобы не прерывать создание заявки
  }
}

/**
 * Отправляет email уведомление об изменении статуса заявки
 */
export async function sendRequestStatusUpdateEmail(request: {
  id: string
  organization: string
  contactName: string
  contactEmail: string
  status: string
}) {
  const trackingUrl = `${BASE_URL}/track/${request.id}`

  const statusLabels: Record<string, string> = {
    NEW: 'Новая',
    IN_REVIEW: 'В работе',
    DONE: 'Завершена',
    SPAM: 'Спам',
    CANCELLED: 'Отменена',
  }

  const statusLabel = statusLabels[request.status] || request.status

  const subject = `Обновление заявки #${request.id.slice(0, 8)}: ${statusLabel}`

  const text = `
Здравствуйте, ${request.contactName}!

Статус вашей заявки изменен на: ${statusLabel}

Вы можете отследить заявку по ссылке:
${trackingUrl}

С уважением,
Команда поддержки
`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #3B82F6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .status { background: white; padding: 15px; border-left: 4px solid #3B82F6; margin: 15px 0; font-size: 18px; font-weight: bold; }
    .button { display: inline-block; padding: 12px 24px; background: #3B82F6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Обновление статуса заявки</h1>
    </div>
    <div class="content">
      <p>Здравствуйте, ${request.contactName}!</p>
      <p>Статус вашей заявки <strong>#${request.id.slice(0, 8)}</strong> (${request.organization}) изменен.</p>

      <div class="status">
        Новый статус: ${statusLabel}
      </div>

      <a href="${trackingUrl}" class="button">Отследить заявку</a>

      <p style="font-size: 14px; color: #6b7280;">Или скопируйте ссылку: ${trackingUrl}</p>
    </div>
    <div class="footer">
      <p>Это автоматическое уведомление, пожалуйста, не отвечайте на это письмо.</p>
    </div>
  </div>
</body>
</html>
`

  try {
    await sendEmail(request.contactEmail, subject, text, html)
  } catch (error) {
    console.error('Failed to send request status update email:', error)
  }
}

/**
 * Отправляет email уведомление о новом комментарии
 */
export async function sendRequestCommentEmail(request: {
  id: string
  organization: string
  contactName: string
  contactEmail: string
  commentText: string
  commentAuthor: string
}) {
  const trackingUrl = `${BASE_URL}/track/${request.id}`

  const subject = `Новый комментарий к заявке #${request.id.slice(0, 8)}`

  const text = `
Здравствуйте, ${request.contactName}!

К вашей заявке добавлен новый комментарий от ${request.commentAuthor}:

${request.commentText}

Вы можете посмотреть полную информацию по ссылке:
${trackingUrl}

С уважением,
Команда поддержки
`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #8B5CF6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .comment { background: white; padding: 15px; border-left: 4px solid #8B5CF6; margin: 15px 0; }
    .button { display: inline-block; padding: 12px 24px; background: #8B5CF6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Новый комментарий</h1>
    </div>
    <div class="content">
      <p>Здравствуйте, ${request.contactName}!</p>
      <p>К вашей заявке <strong>#${request.id.slice(0, 8)}</strong> (${request.organization}) добавлен новый комментарий.</p>

      <div class="comment">
        <p><strong>От:</strong> ${request.commentAuthor}</p>
        <p>${request.commentText}</p>
      </div>

      <a href="${trackingUrl}" class="button">Посмотреть заявку</a>

      <p style="font-size: 14px; color: #6b7280;">Или скопируйте ссылку: ${trackingUrl}</p>
    </div>
    <div class="footer">
      <p>Это автоматическое уведомление, пожалуйста, не отвечайте на это письмо.</p>
    </div>
  </div>
</body>
</html>
`

  try {
    await sendEmail(request.contactEmail, subject, text, html)
  } catch (error) {
    console.error('Failed to send request comment email:', error)
  }
}

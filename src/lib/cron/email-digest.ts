import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/notifications'
import { logger } from '@/lib/logger.server'

interface DigestNotification {
  id: string
  type: string
  title: string
  body: string | null
  createdAt: Date
  letter: {
    id: string
    number: string
    org: string
  } | null
}

const getDigestTimeframe = (frequency: 'DAILY' | 'WEEKLY'): Date => {
  const now = new Date()
  if (frequency === 'DAILY') {
    now.setDate(now.getDate() - 1)
  } else {
    now.setDate(now.getDate() - 7)
  }
  return now
}

const groupNotificationsByLetter = (notifications: DigestNotification[]) => {
  const grouped = new Map<string, DigestNotification[]>()

  notifications.forEach((notif) => {
    const key = notif.letter?.id || 'general'
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(notif)
  })

  return grouped
}

const buildDigestHtml = (
  notifications: DigestNotification[],
  frequency: 'DAILY' | 'WEEKLY'
): string => {
  const grouped = groupNotificationsByLetter(notifications)
  const period = frequency === 'DAILY' ? 'за вчера' : 'за последнюю неделю'

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 20px; }
    .notification-group { background: white; border-radius: 8px; padding: 15px; margin-bottom: 15px; border-left: 4px solid #667eea; }
    .notification-item { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .notification-item:last-child { border-bottom: none; }
    .notification-type { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-bottom: 5px; }
    .type-comment { background: #dbeafe; color: #1e40af; }
    .type-status { background: #d1fae5; color: #065f46; }
    .type-assignment { background: #e9d5ff; color: #6b21a8; }
    .type-system { background: #e5e7eb; color: #374151; }
    .letter-title { font-weight: bold; color: #667eea; margin-bottom: 10px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Дайджест уведомлений</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Сводка ${period}</p>
    </div>
    <div class="content">
      <p>У вас <strong>${notifications.length}</strong> ${notifications.length === 1 ? 'новое уведомление' : 'новых уведомлений'}.</p>
  `

  grouped.forEach((notifs, letterId) => {
    if (letterId === 'general') {
      html += '<div class="notification-group">'
      html += '<div class="letter-title">Общие уведомления</div>'
    } else {
      const firstNotif = notifs[0]
      html += '<div class="notification-group">'
      html += `<div class="letter-title">Письмо №${firstNotif.letter?.number} - ${firstNotif.letter?.org}</div>`
    }

    notifs.forEach((notif) => {
      const typeClass = `type-${notif.type.toLowerCase()}`
      const typeLabel =
        notif.type === 'COMMENT'
          ? 'Комментарий'
          : notif.type === 'STATUS'
            ? 'Статус'
            : notif.type === 'ASSIGNMENT'
              ? 'Назначение'
              : 'Системное'

      html += '<div class="notification-item">'
      html += `<span class="notification-type ${typeClass}">${typeLabel}</span>`
      html += `<div><strong>${notif.title}</strong></div>`
      if (notif.body) {
        const preview = notif.body.length > 150 ? notif.body.substring(0, 150) + '...' : notif.body
        html += `<div style="color: #6b7280; font-size: 14px; margin-top: 5px;">${preview}</div>`
      }
      html += `<div style="color: #9ca3af; font-size: 12px; margin-top: 5px;">${new Date(notif.createdAt).toLocaleString('ru-RU')}</div>`
      html += '</div>'
    })

    html += '</div>'
  })

  html += `
      <div style="text-align: center;">
        <a href="${process.env.APP_URL || process.env.NEXTAUTH_URL}" class="button">Перейти к уведомлениям</a>
      </div>
    </div>
    <div class="footer">
      <p>Это автоматическое письмо с дайджестом уведомлений.</p>
      <p>Вы можете изменить настройки частоты рассылки в настройках аккаунта.</p>
    </div>
  </div>
</body>
</html>
  `

  return html
}

export async function sendDailyDigests() {
  try {
    const users = await prisma.user.findMany({
      where: {
        digestFrequency: 'DAILY',
        notifyEmail: true,
        email: { not: null },
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    logger.info('Email Digest', `Processing daily digest for ${users.length} users`)

    let sent = 0
    let failed = 0

    for (const user of users) {
      if (!user.email) continue

      const since = getDigestTimeframe('DAILY')

      const notifications = await prisma.notification.findMany({
        where: {
          userId: user.id,
          createdAt: { gte: since },
        },
        include: {
          letter: {
            select: {
              id: true,
              number: true,
              org: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      if (notifications.length === 0) continue

      const html = buildDigestHtml(notifications, 'DAILY')
      const success = await sendEmail(
        user.email,
        `Дайджест уведомлений: ${notifications.length} новых`,
        `У вас ${notifications.length} новых уведомлений`,
        html
      )

      if (success) {
        sent++
      } else {
        failed++
      }
    }

    logger.info('Email Digest', `Daily digest completed: sent=${sent}, failed=${failed}`)
    return { sent, failed }
  } catch (error) {
    logger.error('Email Digest', 'Error sending daily digests', { error })
    return { sent: 0, failed: 0 }
  }
}

export async function sendWeeklyDigests() {
  try {
    const users = await prisma.user.findMany({
      where: {
        digestFrequency: 'WEEKLY',
        notifyEmail: true,
        email: { not: null },
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    logger.info('Email Digest', `Processing weekly digest for ${users.length} users`)

    let sent = 0
    let failed = 0

    for (const user of users) {
      if (!user.email) continue

      const since = getDigestTimeframe('WEEKLY')

      const notifications = await prisma.notification.findMany({
        where: {
          userId: user.id,
          createdAt: { gte: since },
        },
        include: {
          letter: {
            select: {
              id: true,
              number: true,
              org: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      if (notifications.length === 0) continue

      const html = buildDigestHtml(notifications, 'WEEKLY')
      const success = await sendEmail(
        user.email,
        `Еженедельный дайджест: ${notifications.length} новых уведомлений`,
        `У вас ${notifications.length} новых уведомлений за неделю`,
        html
      )

      if (success) {
        sent++
      } else {
        failed++
      }
    }

    logger.info('Email Digest', `Weekly digest completed: sent=${sent}, failed=${failed}`)
    return { sent, failed }
  } catch (error) {
    logger.error('Email Digest', 'Error sending weekly digests', { error })
    return { sent: 0, failed: 0 }
  }
}

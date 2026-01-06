import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { sanitizeInput, isDoneStatus, STATUS_LABELS } from '@/lib/utils'
import type { LetterStatus } from '@prisma/client'
import { sendTelegramMessage, formatStatusChangeMessage } from '@/lib/telegram'
import { sendMultiChannelNotification } from '@/lib/notifications'
import { hasPermission } from '@/lib/permissions'
import { requirePermission } from '@/lib/permission-guard'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger.server'

// GET /api/letters/[id] - получить письмо по ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const permissionError = requirePermission(session.user.role, 'VIEW_LETTERS')
    if (permissionError) {
      return permissionError
    }

    const letter = await prisma.letter.findUnique({
      where: { id: params.id },
      include: {
        owner: {
          select: { id: true, name: true, email: true, image: true },
        },
        files: true,
        tags: true,
        comments: {
          include: {
            author: {
              select: { id: true, name: true, email: true, image: true },
            },
            replies: {
              include: {
                author: {
                  select: { id: true, name: true, email: true, image: true },
                },
              },
            },
          },
          where: { parentId: null },
          orderBy: { createdAt: 'desc' },
        },
        watchers: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        favorites: {
          where: { userId: session.user.id },
        },
        history: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        linkedFrom: {
          include: {
            to: {
              select: { id: true, number: true, org: true },
            },
          },
        },
        linkedTo: {
          include: {
            from: {
              select: { id: true, number: true, org: true },
            },
          },
        },
      },
    })

    if (!letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 })
    }

    const canManageLetters = hasPermission(session.user.role, 'MANAGE_LETTERS')
    const isOwner = letter.ownerId === session.user.id
    if (!canManageLetters && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Проверить, подписан ли текущий пользователь
    const isWatching = letter.watchers.some((w) => w.userId === session.user.id)

    // Проверить, в избранном ли
    const isFavorite = letter.favorites.length > 0

    // Удалить массив favorites из ответа, чтобы не передавать лишние данные
    const sanitizedFiles = letter.files.map((file) => ({
      id: file.id,
      name: file.name,
      url: `/api/files/${file.id}`,
      size: file.size,
      mimeType: file.mimeType,
      status: file.status,
      uploadError: file.uploadError,
    }))

    const { favorites, files, ...letterData } = letter

    return NextResponse.json({
      ...letterData,
      files: sanitizedFiles,
      isWatching,
      isFavorite,
    })
  } catch (error) {
    logger.error('GET /api/letters/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/letters/[id] - обновить письмо
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    const body = await request.json()
    const { field, value } = body

    const letter = await prisma.letter.findUnique({
      where: { id: params.id },
      include: {
        owner: true,
        watchers: {
          include: {
            user: {
              select: { telegramChatId: true, email: true },
            },
          },
        },
      },
    })

    if (!letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 })
    }

    // Подготовить данные для обновления
    const updateData: any = {}
    let oldValue: string | null = null
    let newValue: string | null = null

    switch (field) {
      case 'status':
        const newStatus = value as LetterStatus
        oldValue = letter.status
        newValue = newStatus
        updateData.status = newStatus

        // Если статус "готово" или "сделано", установить дату закрытия
        if (isDoneStatus(newStatus) && !letter.closeDate) {
          updateData.closeDate = new Date()
        }
        break

      case 'owner':
        oldValue = letter.ownerId
        newValue = value
        updateData.ownerId = value

        // Автоподписать нового владельца
        if (value) {
          await prisma.watcher.upsert({
            where: {
              letterId_userId: {
                letterId: params.id,
                userId: value,
              },
            },
            create: {
              letterId: params.id,
              userId: value,
            },
            update: {},
          })
        }
        break

      case 'comment':
        oldValue = letter.comment
        newValue = sanitizeInput(value, 5000)
        updateData.comment = newValue
        break

      case 'priority':
        oldValue = String(letter.priority)
        newValue = String(value)
        updateData.priority = parseInt(value)
        break

      case 'answer':
        oldValue = letter.answer
        newValue = sanitizeInput(value, 10000)
        updateData.answer = newValue
        break

      case 'zordoc':
        oldValue = letter.zordoc
        newValue = sanitizeInput(value, 5000)
        updateData.zordoc = newValue
        break

      case 'jiraLink':
        oldValue = letter.jiraLink
        newValue = sanitizeInput(value, 500)
        updateData.jiraLink = newValue
        break

      case 'sendStatus':
        oldValue = letter.sendStatus
        newValue = sanitizeInput(value, 200)
        updateData.sendStatus = newValue
        break

      case 'content':
        oldValue = letter.content
        newValue = sanitizeInput(value, 10000)
        updateData.content = newValue
        break

      case 'contacts':
        oldValue = letter.contacts
        newValue = sanitizeInput(value, 500)
        updateData.contacts = newValue
        break

      case 'type':
        oldValue = letter.type
        {
          const sanitizedType = sanitizeInput(value, 200)
          newValue = sanitizedType || null
          updateData.type = newValue
        }
        break

      case 'applicantName':
        oldValue = letter.applicantName
        newValue = sanitizeInput(value, 200)
        updateData.applicantName = newValue
        break

      case 'applicantEmail':
        oldValue = letter.applicantEmail
        newValue = sanitizeInput(value, 320)
        updateData.applicantEmail = newValue
        break

      case 'applicantPhone':
        oldValue = letter.applicantPhone
        newValue = sanitizeInput(value, 50)
        updateData.applicantPhone = newValue
        break

      case 'applicantTelegramChatId':
        oldValue = letter.applicantTelegramChatId
        newValue = sanitizeInput(value, 50)
        updateData.applicantTelegramChatId = newValue
        break

      default:
        return NextResponse.json({ error: 'Invalid field' }, { status: 400 })
    }

    // Обновить письмо
    const updatedLetter = await prisma.letter.update({
      where: { id: params.id },
      data: updateData,
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    // Записать в историю
    await prisma.history.create({
      data: {
        letterId: params.id,
        userId: session.user.id,
        field,
        oldValue,
        newValue,
      },
    })

    if (field === 'owner' && newValue && newValue !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: newValue,
          letterId: letter.id,
          type: 'ASSIGNMENT',
          title: `Назначено письмо №${letter.number}`,
          body: letter.org,
        },
      })
    }

    // Уведомить watchers через Telegram

    if (field === 'status') {
      const watcherNotifyIds = letter.watchers
        .filter((watcher) => watcher.notifyOnChange && watcher.userId !== session.user.id)
        .map((watcher) => watcher.userId)

      if (watcherNotifyIds.length > 0) {
        await prisma.notification.createMany({
          data: watcherNotifyIds.map((userId) => ({
            userId,
            letterId: letter.id,
            type: 'STATUS',
            title: `?????? ?????? ?${letter.number} ???????`,
            body: `${STATUS_LABELS[letter.status]} -> ${STATUS_LABELS[newValue as LetterStatus]}`,
          })),
        })
      }

      const applicantHasContact = !!(
        letter.applicantEmail ||
        letter.applicantPhone ||
        letter.applicantTelegramChatId
      )

      if (applicantHasContact) {
        const oldStatusLabel = oldValue ? STATUS_LABELS[oldValue as LetterStatus] : ''
        const newStatusLabel = newValue ? STATUS_LABELS[newValue as LetterStatus] : ''

        const subject = `?????? ????????? ?${letter.number} ???????`
        const text = `?????? ?????? ????????? ???????.

?????: ${letter.number}
???????????: ${letter.org}
????: ${oldStatusLabel}
?????: ${newStatusLabel}`
        const telegram = `
<b>?????? ????????? ???????</b>

?${letter.number}
${letter.org}

????: ${oldStatusLabel}
?????: ${newStatusLabel}`

        await sendMultiChannelNotification(
          {
            email: letter.applicantEmail,
            phone: letter.applicantPhone,
            telegramChatId: letter.applicantTelegramChatId,
          },
          { subject, text, telegram }
        )
      }

      for (const watcher of letter.watchers) {
        if (
          watcher.notifyOnChange &&
          watcher.user.telegramChatId &&
          watcher.userId !== session.user.id
        ) {
          const message = formatStatusChangeMessage({
            number: letter.number,
            org: letter.org,
            oldStatus: oldValue || '',
            newStatus: newValue || '',
            changedBy: session.user.email || '',
          })
          await sendTelegramMessage(watcher.user.telegramChatId, message)
        }
      }
    }

    return NextResponse.json({ success: true, letter: updatedLetter })
  } catch (error) {
    logger.error('PATCH /api/letters/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/letters/[id] - удалить письмо (только админ, soft delete)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Только админ может удалять
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Soft delete - помечаем как удалённое
    await prisma.letter.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    })

    // Записать в историю
    await prisma.history.create({
      data: {
        letterId: params.id,
        userId: session.user.id,
        field: 'deleted',
        newValue: 'true',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('DELETE /api/letters/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

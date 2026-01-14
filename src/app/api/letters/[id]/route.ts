import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { sanitizeInput, isDoneStatus, parseDateValue, STATUS_LABELS } from '@/lib/utils'
import type { LetterStatus, Prisma } from '@prisma/client'
import { sendMultiChannelNotification } from '@/lib/notifications'
import { dispatchNotification } from '@/lib/notification-dispatcher'
import { hasPermission } from '@/lib/permissions'
import { requirePermission } from '@/lib/permission-guard'
import { csrfGuard } from '@/lib/security'
import { logger } from '@/lib/logger.server'

// GET /api/letters/[id] - получить письмо по ID
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const permissionError = requirePermission(session.user.role, 'VIEW_LETTERS')
    if (permissionError) {
      return permissionError
    }

    const letter = await prisma.letter.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true, image: true, telegramChatId: true },
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
    void favorites
    void files

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
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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
    const canEditIdentity = session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN'

    const letter = await prisma.letter.findUnique({
      where: { id },
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
    const updateData: Prisma.LetterUpdateInput = {}
    let oldValue: string | null = null
    let newValue: string | null = null

    switch (field) {
      case 'number': {
        if (!canEditIdentity) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        if (typeof value !== 'string') {
          return NextResponse.json({ error: 'Invalid number' }, { status: 400 })
        }
        const sanitizedNumber = sanitizeInput(value, 50)
        if (!sanitizedNumber) {
          return NextResponse.json({ error: 'Invalid number' }, { status: 400 })
        }
        const sameNumber = letter.number.trim().toLowerCase() === sanitizedNumber.toLowerCase()
        if (!sameNumber) {
          const existing = await prisma.letter.findFirst({
            where: {
              number: { equals: sanitizedNumber, mode: 'insensitive' },
              deletedAt: null,
              NOT: { id },
            },
            select: { id: true },
          })
          if (existing) {
            return NextResponse.json({ error: 'Letter number already exists' }, { status: 409 })
          }
        }
        oldValue = letter.number
        newValue = sanitizedNumber
        updateData.number = sanitizedNumber
        break
      }

      case 'org': {
        if (!canEditIdentity) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        if (typeof value !== 'string') {
          return NextResponse.json({ error: 'Invalid organization' }, { status: 400 })
        }
        const sanitizedOrg = sanitizeInput(value, 500)
        if (!sanitizedOrg) {
          return NextResponse.json({ error: 'Invalid organization' }, { status: 400 })
        }
        oldValue = letter.org
        newValue = sanitizedOrg
        updateData.org = sanitizedOrg
        break
      }

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
                letterId: id,
                userId: value,
              },
            },
            create: {
              letterId: id,
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

      case 'deadlineDate': {
        const parsed = parseDateValue(value)
        if (!parsed) {
          return NextResponse.json({ error: 'Invalid deadline date' }, { status: 400 })
        }
        oldValue = letter.deadlineDate ? letter.deadlineDate.toISOString() : null
        newValue = parsed.toISOString()
        updateData.deadlineDate = parsed
        break
      }

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
      where: { id },
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
        letterId: id,
        userId: session.user.id,
        field,
        oldValue,
        newValue,
      },
    })

    if (field === 'owner' && newValue && newValue !== session.user.id) {
      await dispatchNotification({
        event: 'ASSIGNMENT',
        title: `\u041d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u043e \u043f\u0438\u0441\u044c\u043c\u043e \u2116-${letter.number}`,
        body: letter.org,
        letterId: letter.id,
        actorId: session.user.id,
        userIds: [newValue],
      })
    }

    // Уведомить watchers через Telegram

    if (field === 'status') {
      const watcherNotifyIds = letter.watchers
        .filter((watcher) => watcher.notifyOnChange && watcher.userId !== session.user.id)
        .map((watcher) => watcher.userId)
      if (watcherNotifyIds.length > 0) {
        await dispatchNotification({
          event: 'STATUS',
          title: `\u0421\u0442\u0430\u0442\u0443\u0441 \u043f\u0438\u0441\u044c\u043c\u0430 \u2116-${letter.number} \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d`,
          body: `${STATUS_LABELS[letter.status]} -> ${STATUS_LABELS[newValue as LetterStatus]}`,
          letterId: letter.id,
          actorId: session.user.id,
          userIds: watcherNotifyIds,
          metadata: {
            oldStatus: letter.status,
            newStatus: newValue,
          },
          dedupeKey: `STATUS:${letter.id}:${newValue}`,
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

        const subject = `Статус письма №${letter.number} изменен`
        const text = `Статус письма изменен.

Номер: ${letter.number}
Организация: ${letter.org}
Было: ${oldStatusLabel}
Стало: ${newStatusLabel}`
        const telegram = `
<b>Статус письма изменен</b>

№${letter.number}
${letter.org}

Было: ${oldStatusLabel}
Стало: ${newStatusLabel}`

        await sendMultiChannelNotification(
          {
            email: letter.applicantEmail,
            phone: letter.applicantPhone,
            telegramChatId: letter.applicantTelegramChatId,
          },
          { subject, text, telegram }
        )
      }
    }

    return NextResponse.json({ success: true, letter: updatedLetter })
  } catch (error) {
    logger.error('PATCH /api/letters/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/letters/[id] - удалить письмо (только админ, soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
      where: { id },
      data: { deletedAt: new Date() },
    })

    // Записать в историю
    await prisma.history.create({
      data: {
        letterId: id,
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

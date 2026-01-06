import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import type { LetterStatus } from '@prisma/client'
import { isDoneStatus, addWorkingDays, sanitizeInput } from '@/lib/utils'
import { logger } from '@/lib/logger.server'
import { DEFAULT_DEADLINE_WORKING_DAYS } from '@/lib/constants'
import { requirePermission } from '@/lib/permission-guard'
import { csrfGuard } from '@/lib/security'
import { z } from 'zod'

// Схема валидации для массового создания
const bulkCreateLetterSchema = z.object({
  number: z.string().min(1, 'Номер письма обязателен').max(50),
  org: z.string().min(1, 'Организация обязательна').max(500),
  date: z.string().transform((val) => new Date(val)),
  deadlineDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : null)),
  type: z.string().optional(),
  content: z.string().max(10000).optional(),
  comment: z.string().max(5000).optional(),
  priority: z.number().min(0).max(100).optional().default(50),
})

const bulkCreateSchema = z.object({
  letters: z.array(bulkCreateLetterSchema).min(1).max(100),
  skipDuplicates: z.boolean().optional().default(false),
})

// POST /api/letters/bulk - массовое обновление или создание писем
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const csrfError = csrfGuard(request)
    if (csrfError) {
      return csrfError
    }

    const permissionError = requirePermission(session.user.role, 'MANAGE_LETTERS')
    if (permissionError) {
      return permissionError
    }

    const body = await request.json()
    const { ids, action, value, letters, skipDuplicates } = body

    // Массовое создание писем
    if (letters && Array.isArray(letters)) {
      return handleBulkCreate(letters, skipDuplicates, session)
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No letters selected' }, { status: 400 })
    }

    let updated = 0

    switch (action) {
      case 'status':
        const newStatus = value as LetterStatus
        const updateData: any = { status: newStatus }

        // Если статус "готово", установить дату закрытия
        if (isDoneStatus(newStatus)) {
          updateData.closeDate = new Date()
        }

        const result = await prisma.letter.updateMany({
          where: { id: { in: ids } },
          data: updateData,
        })
        updated = result.count

        // Записать в историю для всех писем одним запросом (batch)
        await prisma.history.createMany({
          data: ids.map((id) => ({
            letterId: id,
            userId: session.user.id,
            field: 'status',
            newValue: newStatus,
          })),
        })
        break

      case 'owner':
        const ownerId = value as string
        const ownerResult = await prisma.letter.updateMany({
          where: { id: { in: ids } },
          data: { ownerId: ownerId || null },
        })
        updated = ownerResult.count

        // Записать в историю для всех писем одним запросом (batch)
        await prisma.history.createMany({
          data: ids.map((id) => ({
            letterId: id,
            userId: session.user.id,
            field: 'owner',
            newValue: ownerId,
          })),
        })
        break

      case 'delete':
        // Только админ может удалять
        if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Soft delete - помечаем как удалённые
        const deleteResult = await prisma.letter.updateMany({
          where: { id: { in: ids } },
          data: { deletedAt: new Date() },
        })
        updated = deleteResult.count

        // Записать в историю
        await prisma.history.createMany({
          data: ids.map((id) => ({
            letterId: id,
            userId: session.user.id,
            field: 'deleted',
            newValue: 'true',
          })),
        })
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ success: true, updated })
  } catch (error) {
    logger.error('POST /api/letters/bulk', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Обработчик массового создания писем
async function handleBulkCreate(
  letters: unknown[],
  skipDuplicates: boolean = false,
  session: { user: { id: string; role?: string } }
) {
  // Валидация
  const result = bulkCreateSchema.safeParse({ letters, skipDuplicates })
  if (!result.success) {
    return NextResponse.json(
      {
        error: 'Ошибка валидации',
        details: result.error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
      { status: 400 }
    )
  }

  const validatedLetters = result.data.letters

  // Проверка на дубликаты номеров внутри запроса
  const numbers = validatedLetters.map((l) => l.number.toLowerCase())
  const duplicatesInRequest = numbers.filter((n, i) => numbers.indexOf(n) !== i)
  if (duplicatesInRequest.length > 0) {
    return NextResponse.json(
      {
        error: 'Дублирующиеся номера в запросе',
        duplicates: Array.from(new Set(duplicatesInRequest)),
      },
      { status: 400 }
    )
  }

  // Проверка существующих номеров в БД
  const existingLetters = await prisma.letter.findMany({
    where: {
      number: { in: numbers, mode: 'insensitive' },
      deletedAt: null,
    },
    select: { number: true },
  })
  const existingNumbers = new Set(existingLetters.map((l) => l.number.toLowerCase()))

  // Фильтрация дубликатов если skipDuplicates = true
  let lettersToCreate = validatedLetters
  const skipped: string[] = []

  if (existingNumbers.size > 0) {
    if (skipDuplicates) {
      lettersToCreate = validatedLetters.filter((l) => {
        if (existingNumbers.has(l.number.toLowerCase())) {
          skipped.push(l.number)
          return false
        }
        return true
      })
    } else {
      return NextResponse.json(
        {
          error: 'Письма с такими номерами уже существуют',
          duplicates: Array.from(existingNumbers),
        },
        { status: 409 }
      )
    }
  }

  if (lettersToCreate.length === 0) {
    return NextResponse.json(
      {
        success: true,
        created: 0,
        skipped: skipped.length,
        skippedNumbers: skipped,
        letters: [],
      },
      { status: 200 }
    )
  }

  // Создание писем в транзакции
  const createdLetters = await prisma.$transaction(async (tx) => {
    const results = []

    for (const letterData of lettersToCreate) {
      // Санитизация
      const sanitizedData = {
        number: sanitizeInput(letterData.number, 50),
        org: sanitizeInput(letterData.org, 500),
        date: letterData.date,
        deadlineDate:
          letterData.deadlineDate || addWorkingDays(letterData.date, DEFAULT_DEADLINE_WORKING_DAYS),
        type: letterData.type,
        content: letterData.content ? sanitizeInput(letterData.content, 10000) : null,
        comment: letterData.comment ? sanitizeInput(letterData.comment, 5000) : null,
        priority: letterData.priority,
        status: 'NOT_REVIEWED' as const,
      }

      const letter = await tx.letter.create({
        data: sanitizedData,
        select: {
          id: true,
          number: true,
          org: true,
          date: true,
          deadlineDate: true,
          status: true,
          type: true,
          priority: true,
        },
      })

      // История
      await tx.history.create({
        data: {
          letterId: letter.id,
          userId: session.user.id,
          field: 'created',
          newValue: JSON.stringify({ number: letter.number, org: letter.org }),
        },
      })

      // Автоподписка создателя
      await tx.watcher.create({
        data: {
          letterId: letter.id,
          userId: session.user.id,
        },
      })

      results.push(letter)
    }

    return results
  })

  return NextResponse.json(
    {
      success: true,
      created: createdLetters.length,
      skipped: skipped.length,
      skippedNumbers: skipped,
      letters: createdLetters,
    },
    { status: 201 }
  )
}

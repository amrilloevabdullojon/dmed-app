import { Prisma, PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prismaClientSingleton = () => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

  // Middleware для автоматического логирования изменений Letter
  client.$use(letterChangeLogMiddleware)

  return client
}

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/**
 * Middleware для автоматической записи изменений Letter в LetterChangeLog.
 * Эти записи затем синхронизируются с Google Sheets фоновым процессом.
 */
const letterChangeLogMiddleware: Prisma.Middleware = async (params, next) => {
  // Только для модели Letter
  if (params.model !== 'Letter') {
    return next(params)
  }

  const action = params.action

  // CREATE
  if (action === 'create') {
    const result = await next(params)

    // Записываем создание в лог (асинхронно, не блокируем)
    logLetterChange({
      letterId: result.id,
      action: 'CREATE',
      userId: params.args.data?.creatorId || null,
    }).catch(() => {
      // Игнорируем ошибки логирования
    })

    return result
  }

  // UPDATE (включая soft delete)
  if (action === 'update') {
    // Получаем старые данные перед обновлением
    const oldData = await prisma.letter.findUnique({
      where: params.args.where,
      select: getLetterSyncFields(),
    })

    const result = await next(params)

    if (oldData && result) {
      // Проверяем soft delete (deletedAt изменился с null на дату)
      const wasSoftDeleted = oldData.deletedAt === null && result.deletedAt !== null

      if (wasSoftDeleted) {
        // Логируем как DELETE
        logLetterChange({
          letterId: result.id,
          action: 'DELETE',
        }).catch(() => {})
      } else {
        // Определяем изменённые поля
        const changes = detectChanges(oldData, result)

        for (const change of changes) {
          logLetterChange({
            letterId: result.id,
            action: 'UPDATE',
            field: change.field,
            oldValue: change.oldValue,
            newValue: change.newValue,
          }).catch(() => {})
        }
      }
    }

    return result
  }

  // DELETE (hard delete)
  if (action === 'delete') {
    const toDelete = await prisma.letter.findUnique({
      where: params.args.where,
      select: { id: true },
    })

    const result = await next(params)

    if (toDelete) {
      logLetterChange({
        letterId: toDelete.id,
        action: 'DELETE',
      }).catch(() => {})
    }

    return result
  }

  return next(params)
}

/**
 * Поля Letter, которые синхронизируются с Google Sheets
 */
function getLetterSyncFields() {
  return {
    id: true,
    number: true,
    org: true,
    date: true,
    deadlineDate: true,
    status: true,
    type: true,
    content: true,
    zordoc: true,
    answer: true,
    sendStatus: true,
    ijroDate: true,
    comment: true,
    contacts: true,
    closeDate: true,
    jiraLink: true,
    ownerId: true,
    deletedAt: true,
  }
}

/**
 * Поля, изменение которых требует синхронизации
 */
const SYNC_FIELDS = [
  'number',
  'org',
  'date',
  'deadlineDate',
  'status',
  'type',
  'content',
  'zordoc',
  'answer',
  'sendStatus',
  'ijroDate',
  'comment',
  'contacts',
  'closeDate',
  'jiraLink',
  'ownerId',
  'deletedAt',
]

/**
 * Определяет какие поля изменились
 */
function detectChanges(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): Array<{ field: string; oldValue: string | null; newValue: string | null }> {
  const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = []

  for (const field of SYNC_FIELDS) {
    const oldVal = oldData[field]
    const newVal = newData[field]

    // Сравниваем значения (учитываем даты)
    const oldStr = valueToString(oldVal)
    const newStr = valueToString(newVal)

    if (oldStr !== newStr) {
      changes.push({
        field,
        oldValue: oldStr,
        newValue: newStr,
      })
    }
  }

  return changes
}

/**
 * Преобразует значение в строку для сравнения и хранения
 */
function valueToString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * Записывает изменение в LetterChangeLog
 */
async function logLetterChange(data: {
  letterId: string
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  field?: string
  oldValue?: string | null
  newValue?: string | null
  userId?: string | null
}) {
  try {
    await prisma.letterChangeLog.create({
      data: {
        letterId: data.letterId,
        action: data.action,
        field: data.field || null,
        oldValue: data.oldValue || null,
        newValue: data.newValue || null,
        userId: data.userId || null,
        syncStatus: 'PENDING',
      },
    })
  } catch (error) {
    // Логируем ошибку, но не прерываем основную операцию
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('[LetterChangeLog] Failed to log change:', error)
    }
  }
}

/**
 * Получить несинхронизированные изменения (для sync worker)
 */
export async function getPendingChanges(limit = 100) {
  return prisma.letterChangeLog.findMany({
    where: {
      syncStatus: { in: ['PENDING', 'FAILED'] },
      retryCount: { lt: 5 }, // Максимум 5 попыток
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
}

/**
 * Отметить изменения как синхронизированные
 */
export async function markChangesSynced(ids: string[]) {
  return prisma.letterChangeLog.updateMany({
    where: { id: { in: ids } },
    data: {
      syncStatus: 'SYNCED',
      syncedAt: new Date(),
    },
  })
}

/**
 * Отметить изменение как failed
 */
export async function markChangeFailed(id: string, error: string) {
  return prisma.letterChangeLog.update({
    where: { id },
    data: {
      syncStatus: 'FAILED',
      syncError: error,
      retryCount: { increment: 1 },
    },
  })
}

/**
 * Получить статистику синхронизации
 */
export async function getSyncStats() {
  const [pending, failed, synced, total] = await Promise.all([
    prisma.letterChangeLog.count({ where: { syncStatus: 'PENDING' } }),
    prisma.letterChangeLog.count({ where: { syncStatus: 'FAILED' } }),
    prisma.letterChangeLog.count({ where: { syncStatus: 'SYNCED' } }),
    prisma.letterChangeLog.count(),
  ])

  const lastSynced = await prisma.letterChangeLog.findFirst({
    where: { syncStatus: 'SYNCED' },
    orderBy: { syncedAt: 'desc' },
    select: { syncedAt: true },
  })

  return {
    pending,
    failed,
    synced,
    total,
    lastSyncedAt: lastSynced?.syncedAt || null,
  }
}

import { google } from 'googleapis'
import { prisma } from './prisma'
import { STATUS_LABELS, STATUS_FROM_LABEL, formatDate, addWorkingDays } from './utils'
import type { LetterStatus } from '@prisma/client'

// Колонки в Google Sheets (реальный порядок из таблицы)
const COLUMNS = {
  NUM: 0,           // A - Номер письма
  ORG: 1,           // B - Учреждение
  DATE: 2,          // C - Дата
  DEADLINE_DATE: 3, // D - Дата дедлайна
  STATUS: 4,        // E - Статус дедлайна
  FILE: 5,          // F - Файл
  TYPE: 6,          // G - Тип запроса
  CONTENT: 7,       // H - Содержание
  JIRA_LINK: 8,     // I - Ссылка на Jira
  ZORDOC: 9,        // J - Коментарии ZorDoc
  ANSWER: 10,       // K - Ответ
  SEND_STATUS: 11,  // L - Статус отправки Uzinfocom
  IJRO_DATE: 12,    // M - Дата ответного письма в IJRO
  COMMENT: 13,      // N - Комментарии Uzinfocom
  OWNER: 14,        // O - Ответственный
  CONTACTS: 15,     // P - Контакты
  CLOSE_DATE: 16,   // Q - Дата закрытия
  SHEET_ID: 17,     // R - ID
  SHEET_UPDATED_AT: 18, // S - UPDATED_AT
  SHEET_DELETED_AT: 19, // T - DELETED_AT
  SHEET_CONFLICT: 20, // U - CONFLICT
}


// Получить клиент Google Sheets
async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  return google.sheets({ version: 'v4', auth })
}

// Парсить дату из строки Google Sheets
function parseSheetDate(value: string | null | undefined): Date | null {
  if (!value || String(value).trim() === '') return null

  const strValue = String(value).trim()

  // Формат ДД.ММ.ГГГГ
  const parts = strValue.split('.')
  if (parts.length === 3 && parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 4) {
    const date = new Date(+parts[2], +parts[1] - 1, +parts[0])
    if (!isNaN(date.getTime())) return date
  }

  // DD_¥?D¬Dø¥, D"D"/DoDo/D"D"D"D"
  const slashParts = strValue.split('/')
  if (slashParts.length === 3 && slashParts[0].length <= 2 && slashParts[1].length <= 2 && slashParts[2].length === 4) {
    const date = new Date(+slashParts[2], +slashParts[1] - 1, +slashParts[0])
    if (!isNaN(date.getTime())) return date
  }

  // Формат ГГГГ-ММ-ДД
  const isoParts = strValue.split('-')
  if (isoParts.length === 3 && isoParts[0].length === 4) {
    const date = new Date(+isoParts[0], +isoParts[1] - 1, +isoParts[2])
    if (!isNaN(date.getTime())) return date
  }

  // Попробовать стандартный парсинг
  const d = new Date(strValue)
  return isNaN(d.getTime()) ? null : d
}

// Форматировать дату для Google Sheets
function formatSheetDate(date: Date | null): string {
  if (!date) return ''
  return formatDate(date)
}


// Format datetime for Google Sheets
function formatSheetDateTime(date: Date | null): string {
  if (!date) return ''
  return date.toISOString()
}

// ===== СИНХРОНИЗАЦИЯ В GOOGLE SHEETS =====

export async function syncToGoogleSheets() {
  const sheets = await getSheetsClient()
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID!
  const sheetName = process.env.GOOGLE_SHEET_NAME || '\u041d\u043e\u044f\u0431\u0440\u044c_2025'

  // ??????? ??? ?????????????
  const syncLog = await prisma.syncLog.create({
    data: {
      direction: 'TO_SHEETS',
      status: 'IN_PROGRESS',
    },
  })

  try {
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!R1:U1`,
    })
    const headerValues = headerResponse.data.values?.[0] || []
    if (headerValues.length < 4 || headerValues.some((v) => !v)) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!R1:U1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['ID', 'UPDATED_AT', 'DELETED_AT', 'CONFLICT']],
        },
      })
    }

    const letters = await prisma.letter.findMany({
      where: { deletedAt: null },
      include: {
        owner: true,
        files: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A2:U`,
    })

    const existingRows = response.data.values || []
    const existingRowCount = existingRows.length
    const maxRowNum = existingRowCount + 1
    let nextRowNum = existingRowCount + 2

    const updates: { range: string; values: (string | number)[][] }[] = []
    const newRows: (string | number)[][] = []
    const newRowLetterIds: string[] = []
    const syncedLetterIds: string[] = []

    const buildRow = (letter: typeof letters[number]) => [
      letter.number,
      letter.org,
      formatSheetDate(letter.date),
      formatSheetDate(letter.deadlineDate),
      STATUS_LABELS[letter.status],
      letter.files.map((f) => f.name).join('\n'),
      letter.type || '',
      letter.content || '',
      letter.jiraLink || '',
      letter.zordoc || '',
      letter.answer || '',
      letter.sendStatus || '',
      formatSheetDate(letter.ijroDate),
      letter.comment || '',
      letter.owner?.email || letter.owner?.name || '',
      letter.contacts || '',
      formatSheetDate(letter.closeDate),
      letter.id,
      formatSheetDateTime(letter.updatedAt),
      formatSheetDateTime(letter.deletedAt),
      '',
    ]

    for (const letter of letters) {
      const row = buildRow(letter)
      const rowNum = letter.sheetRowNum
      const shouldSync = !letter.lastSyncedAt || letter.updatedAt > letter.lastSyncedAt

      if (rowNum && rowNum >= 2 && rowNum <= maxRowNum) {
        if (shouldSync) {
          updates.push({
            range: `${sheetName}!A${rowNum}:U${rowNum}`,
            values: [row],
          })
          syncedLetterIds.push(letter.id)
        }
      } else {
        newRows.push(row)
        newRowLetterIds.push(letter.id)
        syncedLetterIds.push(letter.id)
      }
    }

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates,
        },
      })
    }

    if (newRows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${nextRowNum}:U${nextRowNum + newRows.length - 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: newRows,
        },
      })
    }

    const syncedAt = new Date()
    if (syncedLetterIds.length > 0) {
      await prisma.letter.updateMany({
        where: { id: { in: syncedLetterIds } },
        data: { lastSyncedAt: syncedAt },
      })
    }

    if (newRowLetterIds.length > 0) {
      for (let i = 0; i < newRowLetterIds.length; i++) {
        await prisma.letter.update({
          where: { id: newRowLetterIds[i] },
          data: {
            sheetRowNum: nextRowNum + i,
            lastSyncedAt: syncedAt,
          },
        })
      }
    }

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'COMPLETED',
        rowsAffected: syncedLetterIds.length,
        finishedAt: new Date(),
      },
    })

    return { success: true, rowsAffected: syncedLetterIds.length }
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'FAILED',
        error: String(error),
        finishedAt: new Date(),
      },
    })

    throw error
  }
}
// ===== ИМПОРТ ИЗ GOOGLE SHEETS =====

export async function importFromGoogleSheets() {
  const sheets = await getSheetsClient()
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID!
  const sheetName = process.env.GOOGLE_SHEET_NAME || '\u041d\u043e\u044f\u0431\u0440\u044c_2025'

  // ??????? ??? ?????????????
  const syncLog = await prisma.syncLog.create({
    data: {
      direction: 'FROM_SHEETS',
      status: 'IN_PROGRESS',
    },
  })

  try {
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!R1:U1`,
    })
    const headerValues = headerResponse.data.values?.[0] || []
    if (headerValues.length < 4 || headerValues.some((v) => !v)) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!R1:U1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['ID', 'UPDATED_AT', 'DELETED_AT', 'CONFLICT']],
        },
      })
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A2:U`,
    })

    const rows = response.data.values || []
    let imported = 0
    const updates: { range: string; values: (string | number)[][] }[] = []
    const conflictRows: number[] = []
    const updatedRows = new Set<number>()

    const normalizeRow = (values: (string | number | null | undefined)[], length: number) =>
      Array.from({ length }, (_, idx) => String(values[idx] ?? '').trim())

    const normalizeOwnerValue = (value: string) =>
      value.replace(/\s+/g, ' ').trim().toLowerCase()

    const isEmailValue = (value: string) => value.includes('@')

    const ownerValues = new Map<string, { raw: string; isEmail: boolean }>()
    for (const row of rows) {
      const ownerRaw = String(row[COLUMNS.OWNER] || '').trim()
      if (!ownerRaw) continue
      const isEmail = isEmailValue(ownerRaw)
      const key = isEmail ? ownerRaw.toLowerCase() : normalizeOwnerValue(ownerRaw)
      if (!ownerValues.has(key)) {
        ownerValues.set(key, { raw: ownerRaw, isEmail })
      }
    }

    const existingUsers = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, canLogin: true },
    })
    const usersByEmail = new Map(
      existingUsers
        .filter((user) => user.email)
        .map((user) => [String(user.email).toLowerCase(), user])
    )
    const usersByName = new Map(
      existingUsers
        .filter((user) => user.name)
        .map((user) => [normalizeOwnerValue(String(user.name)), user])
    )
    const ownerIdByKey = new Map<string, string>()
    const allowedUserIds = new Set<string>()

    for (const key of Array.from(ownerValues.keys())) {
      const value = ownerValues.get(key)
      if (!value) continue
      let owner = value.isEmail ? usersByEmail.get(key) : usersByName.get(key)
      if (!owner) {
        if (value.isEmail) {
          owner = await prisma.user.create({
            data: {
              email: key,
              name: value.raw.split('@')[0],
              canLogin: true,
            },
          })
          usersByEmail.set(key, owner)
        } else {
          owner = await prisma.user.create({
            data: {
              name: value.raw,
              email: null,
              canLogin: true,
            },
          })
          usersByName.set(key, owner)
        }
      } else if (!owner.canLogin && owner.role !== 'ADMIN') {
        owner = await prisma.user.update({
          where: { id: owner.id },
          data: { canLogin: true },
        })
        if (owner.email) {
          usersByEmail.set(String(owner.email).toLowerCase(), owner)
        }
        if (owner.name) {
          usersByName.set(normalizeOwnerValue(String(owner.name)), owner)
        }
      }

      ownerIdByKey.set(key, owner.id)
      allowedUserIds.add(owner.id)
    }

    if (allowedUserIds.size > 0) {
      await prisma.user.updateMany({
        where: {
          role: { not: 'ADMIN' },
          id: { notIn: Array.from(allowedUserIds) },
        },
        data: { canLogin: false },
      })
      await prisma.user.updateMany({
        where: { id: { in: Array.from(allowedUserIds) } },
        data: { canLogin: true },
      })
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2

      const sheetIdRaw = String(row[COLUMNS.SHEET_ID] || '').trim()
      const number = String(row[COLUMNS.NUM] || '').trim()
      if (!sheetIdRaw && !number) continue

      if (!number) {
        if (sheetIdRaw) {
          // Ensure sheet has the latest data when number is missing
          const existingById = await prisma.letter.findUnique({ where: { id: sheetIdRaw }, include: { owner: true, files: true } })
          if (existingById) {
            updates.push({
              range: `${sheetName}!A${rowNum}:U${rowNum}`,
              values: [[
                existingById.number,
                existingById.org,
                formatSheetDate(existingById.date),
                formatSheetDate(existingById.deadlineDate),
                STATUS_LABELS[existingById.status],
                existingById.files.map((f) => f.name).join('\n'),
                existingById.type || '',
                existingById.content || '',
                existingById.jiraLink || '',
                existingById.zordoc || '',
                existingById.answer || '',
                existingById.sendStatus || '',
                formatSheetDate(existingById.ijroDate),
                existingById.comment || '',
                existingById.owner?.email || existingById.owner?.name || '',
                existingById.contacts || '',
                formatSheetDate(existingById.closeDate),
                existingById.id,
                formatSheetDateTime(existingById.updatedAt),
                formatSheetDateTime(existingById.deletedAt),
                '',
              ]],
            })
            updatedRows.add(rowNum)
          }
        }
        continue
      }

      const statusLabel = String(row[COLUMNS.STATUS] || '\u043d\u0435 \u0440\u0430\u0441\u0441\u043c\u043e\u0442\u0440\u0435\u043d').toLowerCase().trim()
      const status = STATUS_FROM_LABEL[statusLabel] || 'NOT_REVIEWED'

      let ownerId: string | null = null
      const ownerRaw = String(row[COLUMNS.OWNER] || '').trim()
      if (ownerRaw) {
        const ownerKey = isEmailValue(ownerRaw)
          ? ownerRaw.toLowerCase()
          : normalizeOwnerValue(ownerRaw)
        ownerId = ownerIdByKey.get(ownerKey) || null
      }

      const letterDate = parseSheetDate(row[COLUMNS.DATE]) || new Date()
      const deadlineDateParsed = parseSheetDate(row[COLUMNS.DEADLINE_DATE])
      const deadlineDate = deadlineDateParsed || addWorkingDays(letterDate, 7)

      const sheetUpdatedAt = parseSheetDate(row[COLUMNS.SHEET_UPDATED_AT])
      const sheetDeletedAt = parseSheetDate(row[COLUMNS.SHEET_DELETED_AT])

      let existing: any = null
      if (sheetIdRaw) {
        existing = await prisma.letter.findUnique({ where: { id: sheetIdRaw }, include: { owner: true, files: true } })
      }
      if (!existing && number) {
        existing = await prisma.letter.findFirst({ where: { number, deletedAt: null }, include: { owner: true, files: true } })
      }

      const sheetData = {
        number,
        org: String(row[COLUMNS.ORG] || ''),
        date: letterDate,
        deadlineDate,
        status: status as LetterStatus,
        type: row[COLUMNS.TYPE] || null,
        content: row[COLUMNS.CONTENT] || null,
        jiraLink: row[COLUMNS.JIRA_LINK] || null,
        zordoc: row[COLUMNS.ZORDOC] || null,
        answer: row[COLUMNS.ANSWER] || null,
        sendStatus: row[COLUMNS.SEND_STATUS] || null,
        ijroDate: parseSheetDate(row[COLUMNS.IJRO_DATE]),
        comment: row[COLUMNS.COMMENT] || null,
        contacts: row[COLUMNS.CONTACTS] || null,
        closeDate: parseSheetDate(row[COLUMNS.CLOSE_DATE]),
        ownerId,
        sheetRowNum: rowNum,
      }

      const buildRowFromLetter = (letter: typeof existing, conflictMark = '') => [
        letter?.number || '',
        letter?.org || '',
        formatSheetDate(letter?.date || null),
        formatSheetDate(letter?.deadlineDate || null),
        letter?.status ? STATUS_LABELS[letter.status as LetterStatus] : '',
        letter?.files?.map((f: { name: string }) => f.name).join('\n') || '',
        letter?.type || '',
        letter?.content || '',
        letter?.jiraLink || '',
        letter?.zordoc || '',
        letter?.answer || '',
        letter?.sendStatus || '',
        formatSheetDate(letter?.ijroDate || null),
        letter?.comment || '',
        letter?.owner?.email || letter?.owner?.name || '',
        letter?.contacts || '',
        formatSheetDate(letter?.closeDate || null),
        letter?.id || '',
        formatSheetDateTime(letter?.updatedAt || null),
        formatSheetDateTime(letter?.deletedAt || null),
        conflictMark,
      ]

      if (!existing) {
        const created = await prisma.letter.create({
          data: sheetData,
          include: { owner: true, files: true },
        })
        imported++
        updates.push({
          range: `${sheetName}!A${rowNum}:U${rowNum}`,
          values: [buildRowFromLetter(created, '')],
        })
        updatedRows.add(rowNum)
        continue
      }

      if (sheetDeletedAt && !existing.deletedAt) {
        await prisma.letter.update({
          where: { id: existing.id },
          data: { deletedAt: sheetDeletedAt },
        })
        imported++
        updates.push({
          range: `${sheetName}!A${rowNum}:U${rowNum}`,
          values: [buildRowFromLetter({ ...existing, deletedAt: sheetDeletedAt }, '')],
        })
        updatedRows.add(rowNum)
        continue
      }

      if (existing.deletedAt && !sheetDeletedAt) {
        updates.push({
          range: `${sheetName}!A${rowNum}:U${rowNum}`,
          values: [buildRowFromLetter(existing, '')],
        })
        updatedRows.add(rowNum)
        continue
      }

      const existingUpdatedAt = existing.updatedAt

      const sheetRowValues = normalizeRow(row, 17)
      const dbRowValues = normalizeRow(buildRowFromLetter(existing), 17)
      const hasSheetChanges = JSON.stringify(sheetRowValues) !== JSON.stringify(dbRowValues)
      const dbChangedSinceSync = !!(existing.lastSyncedAt && existingUpdatedAt > existing.lastSyncedAt)
      const sheetIsNewer = !!(sheetUpdatedAt && sheetUpdatedAt > existingUpdatedAt)
      const hasConflict = hasSheetChanges && dbChangedSinceSync
      const conflictMark = hasConflict ? 'CONFLICT' : ''
      if (hasConflict) {
        conflictRows.push(rowNum)
      }

      if (hasSheetChanges && (!dbChangedSinceSync || sheetIsNewer)) {
        const updated = await prisma.letter.update({
          where: { id: existing.id },
          data: sheetData,
          include: { owner: true, files: true },
        })
        existing = updated
        imported++
        updates.push({
          range: `${sheetName}!A${rowNum}:U${rowNum}`,
          values: [buildRowFromLetter(updated, conflictMark)],
        })
        updatedRows.add(rowNum)
      } else if (hasSheetChanges && dbChangedSinceSync) {
        updates.push({
          range: `${sheetName}!A${rowNum}:U${rowNum}`,
          values: [buildRowFromLetter(existing, conflictMark)],
        })
        updatedRows.add(rowNum)
      } else if (!sheetIdRaw || !row[COLUMNS.SHEET_UPDATED_AT]) {
        updates.push({
          range: `${sheetName}!A${rowNum}:U${rowNum}`,
          values: [buildRowFromLetter(existing, conflictMark)],
        })
        updatedRows.add(rowNum)
      }

      if (existing && existing.sheetRowNum !== rowNum) {
        await prisma.letter.update({
          where: { id: existing.id },
          data: { sheetRowNum: rowNum },
        })
      }

      const existingConflict = String(row[COLUMNS.SHEET_CONFLICT] || '').trim()
      if (!hasConflict && existingConflict && !updatedRows.has(rowNum)) {
        updates.push({
          range: `${sheetName}!U${rowNum}:U${rowNum}`,
          values: [['']],
        })
      }
    }

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates,
        },
      })
    }

    const conflictMessage = conflictRows.length
      ? `\u041a\u043e\u043d\u0444\u043b\u0438\u043a\u0442\u044b \u0432 \u0441\u0442\u0440\u043e\u043a\u0430\u0445: ${conflictRows.join(', ')}`
      : null

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'COMPLETED',
        rowsAffected: imported,
        error: conflictMessage,
        finishedAt: new Date(),
      },
    })

    return { success: true, imported, conflicts: conflictRows }
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'FAILED',
        error: String(error),
        finishedAt: new Date(),
      },
    })

    throw error
  }
}


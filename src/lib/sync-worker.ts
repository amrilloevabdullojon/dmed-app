import { google } from 'googleapis'
import { prisma, getPendingChanges, markChangesSynced, markChangeFailed } from './prisma'
import { STATUS_LABELS, formatDate } from './utils'
import type { Letter, LetterChangeLog } from '@prisma/client'
import { logger } from '@/lib/logger'

// ÐšÐ¾Ð»Ð¾Ð½ÐºÐ¸ Ð² Google Sheets
const COLUMNS = {
  NUM: 0,
  ORG: 1,
  DATE: 2,
  DEADLINE_DATE: 3,
  STATUS: 4,
  FILE: 5,
  TYPE: 6,
  CONTENT: 7,
  JIRA_LINK: 8,
  ZORDOC: 9,
  ANSWER: 10,
  SEND_STATUS: 11,
  IJRO_DATE: 12,
  COMMENT: 13,
  OWNER: 14,
  CONTACTS: 15,
  CLOSE_DATE: 16,
  SHEET_ID: 17,
  SHEET_UPDATED_AT: 18,
  SHEET_DELETED_AT: 19,
  SHEET_CONFLICT: 20,
}

const TOTAL_COLUMNS = 21
const TEMPLATE_ROW_INDEX = 1
const FORMULA_SEPARATOR = process.env.GOOGLE_SHEET_FORMULA_SEPARATOR || ';'

/**
 * ÐŸÐ¾Ð»ÑƒÑ‡Ð¸Ñ‚ÑŒ ÐºÐ»Ð¸ÐµÐ½Ñ‚ Google Sheets
 */
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
async function getSheetId(
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  spreadsheetId: string,
  sheetName: string
) {
  const sheetMeta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  })
  const sheet = sheetMeta.data.sheets?.find((item) => item.properties?.title === sheetName)
  return sheet?.properties?.sheetId ?? null
}

function escapeSheetString(value: string) {
  return value.replace(/"/g, '""').replace(/\r?\n/g, ' ')
}

function buildFileCell(files: Array<{ id: string; name: string; url?: string | null }>) {
  if (!files.length) return ''
  const baseUrl = (process.env.NEXTAUTH_URL || process.env.APP_URL || '').replace(/\/$/, '')

  const links = files.map((file) => {
    const url =
      baseUrl.length > 0
        ? `${baseUrl}/api/files/${file.id}`
        : file.url && file.url.startsWith('http')
          ? file.url
          : `/api/files/${file.id}`
    const safeUrl = escapeSheetString(url)
    const safeName = escapeSheetString(file.name)
    return `HYPERLINK("${safeUrl}"${FORMULA_SEPARATOR}"${safeName}")`
  })

  if (links.length === 1) {
    return `=${links[0]}`
  }
  return `=${links.join(' & CHAR(10) & ')}`
}

function buildOwnerValidationRule(values: string[]) {
  return {
    condition: {
      type: 'ONE_OF_LIST',
      values: values.map((value) => ({ userEnteredValue: value })),
    },
    strict: true,
    showCustomUi: true,
  }
}

async function applyOwnerValidation(
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  spreadsheetId: string,
  sheetId: number,
  lastRowNum: number,
  values: string[]
) {
  if (!values.length || lastRowNum < 2) return

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            setDataValidation: {
              range: {
                sheetId,
                startRowIndex: 1,
                endRowIndex: lastRowNum,
                startColumnIndex: COLUMNS.OWNER,
                endColumnIndex: COLUMNS.OWNER + 1,
              },
              rule: buildOwnerValidationRule(values),
            },
          },
        ],
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/typed columns/i.test(message)) return
    throw error
  }
}

async function copyTemplateFormatting(
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  spreadsheetId: string,
  sheetId: number,
  startRow: number,
  rowCount: number
) {
  const startRowIndex = startRow - 1
  const endRowIndex = startRowIndex + rowCount

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          copyPaste: {
            source: {
              sheetId,
              startRowIndex: TEMPLATE_ROW_INDEX,
              endRowIndex: TEMPLATE_ROW_INDEX + 1,
              startColumnIndex: 0,
              endColumnIndex: TOTAL_COLUMNS,
            },
            destination: {
              sheetId,
              startRowIndex,
              endRowIndex,
              startColumnIndex: 0,
              endColumnIndex: TOTAL_COLUMNS,
            },
            pasteType: 'PASTE_FORMAT',
            pasteOrientation: 'NORMAL',
          },
        },
        {
          copyPaste: {
            source: {
              sheetId,
              startRowIndex: TEMPLATE_ROW_INDEX,
              endRowIndex: TEMPLATE_ROW_INDEX + 1,
              startColumnIndex: 0,
              endColumnIndex: TOTAL_COLUMNS,
            },
            destination: {
              sheetId,
              startRowIndex,
              endRowIndex,
              startColumnIndex: 0,
              endColumnIndex: TOTAL_COLUMNS,
            },
            pasteType: 'PASTE_DATA_VALIDATION',
            pasteOrientation: 'NORMAL',
          },
        },
      ],
    },
  })
}

/**
 * Ð¤Ð¾Ñ€Ð¼Ð°Ñ‚Ð¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒ Ð´Ð°Ñ‚Ñƒ Ð´Ð»Ñ Google Sheets
 */
function formatSheetDate(date: Date | null): string {
  if (!date) return ''
  return formatDate(date)
}

/**
 * ÐŸÐ¾ÑÑ‚Ñ€Ð¾Ð¸Ñ‚ÑŒ ÑÑ‚Ñ€Ð¾ÐºÑƒ Ð´Ð°Ð½Ð½Ñ‹Ñ… Ð´Ð»Ñ Google Sheets Ð¸Ð· Letter
 */
async function buildRowFromLetter(letter: Letter): Promise<string[]> {
  const row: string[] = new Array(TOTAL_COLUMNS).fill('')

  // ÐŸÐ¾Ð»ÑƒÑ‡Ð°ÐµÐ¼ Ñ„Ð°Ð¹Ð»Ñ‹ Ð¸ Ð²Ð»Ð°Ð´ÐµÐ»ÑŒÑ†Ð°
  const [files, owner] = await Promise.all([
    prisma.file.findMany({
      where: { letterId: letter.id },
      select: { id: true, name: true, url: true },
    }),
    letter.ownerId
      ? prisma.user.findUnique({
          where: { id: letter.ownerId },
          select: { email: true, name: true },
        })
      : null,
  ])

  row[COLUMNS.NUM] = letter.number || ''
  row[COLUMNS.ORG] = letter.org || ''
  row[COLUMNS.DATE] = formatSheetDate(letter.date)
  row[COLUMNS.DEADLINE_DATE] = ''
  row[COLUMNS.STATUS] = STATUS_LABELS[letter.status] || ''
  row[COLUMNS.FILE] = buildFileCell(files)
  row[COLUMNS.TYPE] = letter.type || ''
  row[COLUMNS.CONTENT] = letter.content || ''
  row[COLUMNS.JIRA_LINK] = letter.jiraLink || ''
  row[COLUMNS.ZORDOC] = letter.zordoc || ''
  row[COLUMNS.ANSWER] = letter.answer || ''
  row[COLUMNS.SEND_STATUS] = letter.sendStatus || ''
  row[COLUMNS.IJRO_DATE] = formatSheetDate(letter.ijroDate)
  row[COLUMNS.COMMENT] = letter.comment || ''
  row[COLUMNS.OWNER] = owner?.email || owner?.name || ''
  row[COLUMNS.CONTACTS] = letter.contacts || ''
  row[COLUMNS.CLOSE_DATE] = formatSheetDate(letter.closeDate)
  row[COLUMNS.SHEET_ID] = letter.id
  row[COLUMNS.SHEET_UPDATED_AT] = letter.updatedAt.toISOString()
  row[COLUMNS.SHEET_DELETED_AT] = letter.deletedAt?.toISOString() || ''
  row[COLUMNS.SHEET_CONFLICT] = ''

  return row
}

/**
 * Ð ÐµÐ·ÑƒÐ»ÑŒÑ‚Ð°Ñ‚ Ð¾Ð±Ñ€Ð°Ð±Ð¾Ñ‚ÐºÐ¸ batch
 */
interface SyncResult {
  processed: number
  synced: number
  failed: number
  errors: string[]
}

/**
 * ÐžÐ±Ñ€Ð°Ð±Ð¾Ñ‚Ð°Ñ‚ÑŒ pending Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ñ Ð¸ ÑÐ¸Ð½Ñ…Ñ€Ð¾Ð½Ð¸Ð·Ð¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒ Ñ Google Sheets
 */
export async function processPendingChanges(batchSize = 50): Promise<SyncResult> {
  const result: SyncResult = {
    processed: 0,
    synced: 0,
    failed: 0,
    errors: [],
  }

  // ÐŸÑ€Ð¾Ð²ÐµÑ€ÑÐµÐ¼ Ð½Ð°Ð»Ð¸Ñ‡Ð¸Ðµ credentials
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    return { ...result, errors: ['Google credentials not configured'] }
  }

  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
  const sheetName = process.env.GOOGLE_SHEET_NAME || 'ÐÐ¾ÑÐ±Ñ€ÑŒ_2025'

  if (!spreadsheetId) {
    return { ...result, errors: ['GOOGLE_SPREADSHEET_ID not configured'] }
  }

  try {
    // ÐŸÐ¾Ð»ÑƒÑ‡Ð°ÐµÐ¼ pending Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ñ
    const pendingChanges = await getPendingChanges(batchSize)

    if (pendingChanges.length === 0) {
      return result
    }

    result.processed = pendingChanges.length

    // Ð“Ñ€ÑƒÐ¿Ð¿Ð¸Ñ€ÑƒÐµÐ¼ Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ñ Ð¿Ð¾ letterId (Ð±ÐµÑ€Ñ‘Ð¼ Ð¿Ð¾ÑÐ»ÐµÐ´Ð½ÐµÐµ Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ðµ Ð´Ð»Ñ ÐºÐ°Ð¶Ð´Ð¾Ð³Ð¾ Ð¿Ð¸ÑÑŒÐ¼Ð°)
    const letterChanges = groupChangesByLetter(pendingChanges)

    const sheets = await getSheetsClient()
    const sheetId = await getSheetId(sheets, spreadsheetId, sheetName)

    // ÐŸÐ¾Ð»ÑƒÑ‡Ð°ÐµÐ¼ Ñ‚ÐµÐºÑƒÑ‰Ð¸Ðµ Ð´Ð°Ð½Ð½Ñ‹Ðµ Ð¸Ð· Ñ‚Ð°Ð±Ð»Ð¸Ñ†Ñ‹ Ð´Ð»Ñ Ð¾Ð¿Ñ€ÐµÐ´ÐµÐ»ÐµÐ½Ð¸Ñ Ð½Ð¾Ð¼ÐµÑ€Ð¾Ð² ÑÑ‚Ñ€Ð¾Ðº
    const existingRows = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!R2:R`, // ÐšÐ¾Ð»Ð¾Ð½ÐºÐ° Ñ ID
    })

    const idToRowMap = new Map<string, number>()
    const existingIds = existingRows.data.values || []
    const existingRowCount = existingIds.length
    existingIds.forEach((row, index) => {
      if (row[0]) {
        idToRowMap.set(row[0], index + 2) // +2 Ð¿Ð¾Ñ‚Ð¾Ð¼Ñƒ Ñ‡Ñ‚Ð¾ Ð½Ð°Ñ‡Ð¸Ð½Ð°ÐµÐ¼ Ñ ÑÑ‚Ñ€Ð¾ÐºÐ¸ 2
      }
    })

    // ÐžÐ±Ñ€Ð°Ð±Ð°Ñ‚Ñ‹Ð²Ð°ÐµÐ¼ ÐºÐ°Ð¶Ð´Ð¾Ðµ Ð¿Ð¸ÑÑŒÐ¼Ð¾
    const updateRequests: {
      range: string
      values: string[][]
    }[] = []
    const updatedLetterIds: string[] = []

    const appendRows: string[][] = []
    let appendedStartRow: number | null = null
    const syncedIds: string[] = []
    const letterIdsToUpdate: { letterId: string; sheetRowNum: number }[] = []

    const letterEntries = Array.from(letterChanges.entries())
    for (const [letterId, changes] of letterEntries) {
      try {
        // ÐŸÐ¾Ð»ÑƒÑ‡Ð°ÐµÐ¼ Ð°ÐºÑ‚ÑƒÐ°Ð»ÑŒÐ½Ñ‹Ðµ Ð´Ð°Ð½Ð½Ñ‹Ðµ Ð¿Ð¸ÑÑŒÐ¼Ð°
        const letter = await prisma.letter.findUnique({
          where: { id: letterId },
        })

        if (!letter) {
          // ÐŸÐ¸ÑÑŒÐ¼Ð¾ ÑƒÐ´Ð°Ð»ÐµÐ½Ð¾ Ð¸Ð· Ð‘Ð” â€” Ð¿Ñ€Ð¾Ð¿ÑƒÑÐºÐ°ÐµÐ¼
          syncedIds.push(...changes.map((c) => c.id))
          continue
        }

        const rowData = await buildRowFromLetter(letter)
        const existingRowNum = idToRowMap.get(letterId) || letter.sheetRowNum

        if (existingRowNum) {
          // ÐžÐ±Ð½Ð¾Ð²Ð»ÑÐµÐ¼ ÑÑƒÑ‰ÐµÑÑ‚Ð²ÑƒÑŽÑ‰ÑƒÑŽ ÑÑ‚Ñ€Ð¾ÐºÑƒ
          updateRequests.push({
            range: `${sheetName}!A${existingRowNum}:C${existingRowNum}`,
            values: [rowData.slice(0, COLUMNS.DEADLINE_DATE)],
          })
          updateRequests.push({
            range: `${sheetName}!E${existingRowNum}:U${existingRowNum}`,
            values: [rowData.slice(COLUMNS.STATUS)],
          })
          updatedLetterIds.push(letter.id)
        } else {
          // Ð”Ð¾Ð±Ð°Ð²Ð»ÑÐµÐ¼ Ð½Ð¾Ð²ÑƒÑŽ ÑÑ‚Ñ€Ð¾ÐºÑƒ
          appendRows.push(rowData)
          letterIdsToUpdate.push({ letterId, sheetRowNum: -1 }) // Ð‘ÑƒÐ´ÐµÑ‚ Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¾ Ð¿Ð¾ÑÐ»Ðµ append
        }

        syncedIds.push(...changes.map((c) => c.id))
        result.synced++
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        result.errors.push(`Letter ${letterId}: ${errorMsg}`)
        result.failed++

        // ÐžÑ‚Ð¼ÐµÑ‡Ð°ÐµÐ¼ Ð²ÑÐµ Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ñ ÑÑ‚Ð¾Ð³Ð¾ Ð¿Ð¸ÑÑŒÐ¼Ð° ÐºÐ°Ðº failed
        for (const change of changes) {
          await markChangeFailed(change.id, errorMsg)
        }
      }
    }

    // Ð’Ñ‹Ð¿Ð¾Ð»Ð½ÑÐµÐ¼ batch update Ð´Ð»Ñ ÑÑƒÑ‰ÐµÑÑ‚Ð²ÑƒÑŽÑ‰Ð¸Ñ… ÑÑ‚Ñ€Ð¾Ðº
    if (updateRequests.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updateRequests,
        },
      })
    }

    // Ð”Ð¾Ð±Ð°Ð²Ð»ÑÐµÐ¼ Ð½Ð¾Ð²Ñ‹Ðµ ÑÑ‚Ñ€Ð¾ÐºÐ¸
    if (appendRows.length > 0) {
      const appendResult = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:U`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: appendRows,
        },
      })

      // ÐžÐ¿Ñ€ÐµÐ´ÐµÐ»ÑÐµÐ¼ Ð½Ð¾Ð¼ÐµÑ€Ð° ÑÑ‚Ñ€Ð¾Ðº Ð´Ð»Ñ Ð½Ð¾Ð²Ñ‹Ñ… Ð·Ð°Ð¿Ð¸ÑÐµÐ¹
      const updatedRange = appendResult.data.updates?.updatedRange
      if (updatedRange) {
        const match = updatedRange.match(/!A(\d+):/)
        if (match) {
          const startRow = parseInt(match[1], 10)
          appendedStartRow = startRow
          if (sheetId !== null) {
            await copyTemplateFormatting(
              sheets,
              spreadsheetId,
              sheetId,
              startRow,
              appendRows.length
            )
          }
          for (let i = 0; i < letterIdsToUpdate.length; i++) {
            const { letterId } = letterIdsToUpdate[i]
            await prisma.letter.update({
              where: { id: letterId },
              data: {
                sheetRowNum: startRow + i,
                lastSyncedAt: new Date(),
              },
            })
          }
        }
      }
    }

    const lastRowNum =
      appendedStartRow && appendRows.length > 0
        ? Math.max(existingRowCount + 1, appendedStartRow + appendRows.length - 1)
        : existingRowCount + 1

    if (sheetId !== null && (updateRequests.length > 0 || appendRows.length > 0)) {
      const users = await prisma.user.findMany({ select: { name: true, email: true } })
      const ownerOptions = Array.from(
        new Set(
          users
            .map((user) => (user.name || user.email || '').trim())
            .filter((value) => value.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b))
      await applyOwnerValidation(sheets, spreadsheetId, sheetId, lastRowNum, ownerOptions)
    }

    // ÐžÐ±Ð½Ð¾Ð²Ð»ÑÐµÐ¼ lastSyncedAt Ð´Ð»Ñ Ð¾Ð±Ð½Ð¾Ð²Ð»Ñ‘Ð½Ð½Ñ‹Ñ… Ð¿Ð¸ÑÐµÐ¼
    if (updatedLetterIds.length > 0) {
      await prisma.letter.updateMany({
        where: { id: { in: updatedLetterIds } },
        data: { lastSyncedAt: new Date() },
      })
    }

    // ÐžÑ‚Ð¼ÐµÑ‡Ð°ÐµÐ¼ Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ñ ÐºÐ°Ðº ÑÐ¸Ð½Ñ…Ñ€Ð¾Ð½Ð¸Ð·Ð¸Ñ€Ð¾Ð²Ð°Ð½Ð½Ñ‹Ðµ
    if (syncedIds.length > 0) {
      await markChangesSynced(syncedIds)
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    result.errors.push(`Batch sync error: ${errorMsg}`)
  }

  return result
}

/**
 * Ð“Ñ€ÑƒÐ¿Ð¿Ð¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒ Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ñ Ð¿Ð¾ letterId
 */
function groupChangesByLetter(changes: LetterChangeLog[]): Map<string, LetterChangeLog[]> {
  const map = new Map<string, LetterChangeLog[]>()

  for (const change of changes) {
    const existing = map.get(change.letterId) || []
    existing.push(change)
    map.set(change.letterId, existing)
  }

  return map
}

/**
 * Ð—Ð°Ð¿ÑƒÑÑ‚Ð¸Ñ‚ÑŒ sync worker ÐºÐ°Ðº Ñ„Ð¾Ð½Ð¾Ð²Ñ‹Ð¹ Ð¿Ñ€Ð¾Ñ†ÐµÑÑ
 * Ð˜ÑÐ¿Ð¾Ð»ÑŒÐ·ÑƒÐµÑ‚ÑÑ Ð´Ð»Ñ Ð¿ÐµÑ€Ð¸Ð¾Ð´Ð¸Ñ‡ÐµÑÐºÐ¾Ð¹ ÑÐ¸Ð½Ñ…Ñ€Ð¾Ð½Ð¸Ð·Ð°Ñ†Ð¸Ð¸
 */
let syncInterval: NodeJS.Timeout | null = null

export function startSyncWorker(intervalMs = 30000) {
  if (syncInterval) {
    return // Ð£Ð¶Ðµ Ð·Ð°Ð¿ÑƒÑ‰ÐµÐ½
  }

  // eslint-disable-next-line no-console
  console.log(`[SyncWorker] Starting with interval ${intervalMs}ms`)

  syncInterval = setInterval(async () => {
    try {
      const result = await processPendingChanges()
      if (result.processed > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[SyncWorker] Processed: ${result.processed}, Synced: ${result.synced}, Failed: ${result.failed}`
        )
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      logger.error('SyncWorker', error)
    }
  }, intervalMs)
}

export function stopSyncWorker() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
    // eslint-disable-next-line no-console
    console.log('[SyncWorker] Stopped')
  }
}

/**
 * ÐŸÑ€Ð¾Ð²ÐµÑ€Ð¸Ñ‚ÑŒ, Ð·Ð°Ð¿ÑƒÑ‰ÐµÐ½ Ð»Ð¸ worker
 */
export function isSyncWorkerRunning() {
  return syncInterval !== null
}

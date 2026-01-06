import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { LetterStatus } from '@prisma/client'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Маппинг статусов БД на русские названия
// Status labels for UI and Google Sheets export.
export const STATUS_LABELS: Record<LetterStatus, string> = {
  NOT_REVIEWED: '\u043d\u0435 \u0440\u0430\u0441\u0441\u043c\u043e\u0442\u0440\u0435\u043d',
  ACCEPTED: '\u043f\u0440\u0438\u043d\u044f\u0442',
  IN_PROGRESS: '\u0432\u0437\u044f\u0442\u043e \u0432 \u0440\u0430\u0431\u043e\u0442\u0443',
  CLARIFICATION: '\u043d\u0430 \u0443\u0442\u043e\u0447\u043d\u0435\u043d\u0438\u0438',
  READY: '\u0433\u043e\u0442\u043e\u0432\u043e',
  DONE: '\u0441\u0434\u0435\u043b\u0430\u043d\u043e',
}

// Обратный маппинг
// Reverse mapping for Sheets import (lower-case).
export const STATUS_FROM_LABEL: Record<string, LetterStatus> = {
  '\u043d\u0435 \u0440\u0430\u0441\u0441\u043c\u043e\u0442\u0440\u0435\u043d': 'NOT_REVIEWED',
  '\u043f\u0440\u0438\u043d\u044f\u0442': 'ACCEPTED',
  '\u0432\u0437\u044f\u0442\u043e \u0432 \u0440\u0430\u0431\u043e\u0442\u0443': 'IN_PROGRESS',
  '\u043d\u0430 \u0443\u0442\u043e\u0447\u043d\u0435\u043d\u0438\u0438': 'CLARIFICATION',
  '\u0433\u043e\u0442\u043e\u0432\u043e': 'READY',
  '\u0441\u0434\u0435\u043b\u0430\u043d\u043e': 'DONE',
}

// Цвета статусов
export const STATUS_COLORS: Record<LetterStatus, string> = {
  NOT_REVIEWED: 'bg-slate-500/20 text-slate-200 ring-1 ring-slate-400/30',
  ACCEPTED: 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/30',
  IN_PROGRESS: 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40',
  CLARIFICATION: 'bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/40',
  READY: 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40',
  DONE: 'bg-teal-500/20 text-teal-200 ring-1 ring-teal-400/40',
}

// Проверка "завершенного" статуса
export function isDoneStatus(status: LetterStatus): boolean {
  return status === 'READY' || status === 'DONE'
}

// Форматирование даты
function parseDateValue(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  const trimmed = value.trim()
  const isExactDate = (date: Date, year: number, month: number, day: number) =>
    date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
  const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (dotMatch) {
    const day = parseInt(dotMatch[1], 10)
    const month = parseInt(dotMatch[2], 10) - 1
    const year = parseInt(dotMatch[3], 10)
    const parsed = new Date(year, month, day)
    return !isNaN(parsed.getTime()) && isExactDate(parsed, year, month, day) ? parsed : null
  }
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10)
    const month = parseInt(slashMatch[2], 10) - 1
    const year = parseInt(slashMatch[3], 10)
    const parsed = new Date(year, month, day)
    return !isNaN(parsed.getTime()) && isExactDate(parsed, year, month, day) ? parsed : null
  }
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10)
    const month = parseInt(isoMatch[2], 10) - 1
    const day = parseInt(isoMatch[3], 10)
    const parsed = new Date(year, month, day)
    return !isNaN(parsed.getTime()) && isExactDate(parsed, year, month, day) ? parsed : null
  }
  const parsed = new Date(trimmed)
  return isNaN(parsed.getTime()) ? null : parsed
}

export function formatDate(date: Date | string | null): string {
  const parsed = parseDateValue(date)
  if (!parsed) return ''
  return parsed.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Добавить рабочие дни
export function addWorkingDays(date: Date, days: number): Date {
  const result = new Date(date)
  let added = 0
  while (added < days) {
    result.setDate(result.getDate() + 1)
    if (result.getDay() !== 0 && result.getDay() !== 6) added++
  }
  return result
}

// Склонение слова "день"
export function pluralizeDays(n: number): string {
  const abs = Math.abs(n)
  const last = abs % 10
  const last2 = abs % 100
  if (last === 1 && last2 !== 11) return '\u0434\u0435\u043d\u044c'
  if (last >= 2 && last <= 4 && !(last2 >= 12 && last2 <= 14)) return '\u0434\u043d\u044f'
  return '\u0434\u043d\u0435\u0439'
}

// Дней до дедлайна
export function getDaysUntilDeadline(deadline: Date | string): number {
  const parsed = parseDateValue(deadline)
  if (!parsed) return 0
  const now = new Date()
  const deadlineUtc = Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.ceil((deadlineUtc - nowUtc) / (1000 * 60 * 60 * 24))
}

// Приоритет в текст
export function getPriorityLabel(priority: number): { label: string; color: string } {
  if (priority >= 70)
    return { label: '\u0412\u044b\u0441\u043e\u043a\u0438\u0439', color: 'text-red-600' }
  if (priority >= 40)
    return { label: '\u0421\u0440\u0435\u0434\u043d\u0438\u0439', color: 'text-yellow-600' }
  return { label: '\u041d\u0438\u0437\u043a\u0438\u0439', color: 'text-green-600' }
}

// Санитизация ввода
export function sanitizeInput(text: string | null | undefined, maxLength = 10000): string {
  if (!text) return ''
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .substring(0, maxLength)
    .trim()
}

// Экспорт письма в PDF (открывает страницу для печати)
export function exportLetterToPdf(letterId: string): void {
  const url = `/api/export/pdf?id=${encodeURIComponent(letterId)}`
  const printWindow = window.open(url, '_blank')
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print()
    }
  }
}

// Скачивание CSV файла
export function downloadCsv(data: string[][], filename: string): void {
  const BOM = '\uFEFF'
  const escapeCSV = (value: string) => {
    if (
      value.includes('"') ||
      value.includes(',') ||
      value.includes('\n') ||
      value.includes('\r')
    ) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  const csv = BOM + data.map((row) => row.map(escapeCSV).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

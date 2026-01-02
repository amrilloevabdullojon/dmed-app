'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Trash2,
  Hash,
  Building2,
  Calendar,
  Clock,
  FileText,
  Check,
  X,
  Loader2,
  Copy,
  Download,
  AlertCircle,
  ListPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { LETTER_TYPES } from '@/lib/constants'

interface LetterRow {
  id: string
  number: string
  org: string
  date: string
  deadlineDate: string
  type: string
  content: string
  priority: number
}

const createEmptyRow = (): LetterRow => ({
  id: crypto.randomUUID(),
  number: '',
  org: '',
  date: new Date().toISOString().split('T')[0],
  deadlineDate: '',
  type: '',
  content: '',
  priority: 50,
})

interface BulkCreateLettersProps {
  onClose?: () => void
  onSuccess?: (letters: unknown[]) => void
}

export function BulkCreateLetters({ onClose, onSuccess }: BulkCreateLettersProps) {
  const router = useRouter()
  const [rows, setRows] = useState<LetterRow[]>([createEmptyRow()])
  const [creating, setCreating] = useState(false)
  const [skipDuplicates, setSkipDuplicates] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [createdLetters, setCreatedLetters] = useState<unknown[]>([])

  // Добавить новую строку
  const addRow = useCallback(() => {
    setRows((prev) => [...prev, createEmptyRow()])
  }, [])

  // Удалить строку
  const removeRow = useCallback((id: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.id !== id) : prev))
  }, [])

  // Дублировать строку
  const duplicateRow = useCallback((id: string) => {
    setRows((prev) => {
      const index = prev.findIndex((row) => row.id === id)
      if (index === -1) return prev
      const newRow = { ...prev[index], id: crypto.randomUUID(), number: '' }
      return [...prev.slice(0, index + 1), newRow, ...prev.slice(index + 1)]
    })
  }, [])

  // Обновить поле
  const updateRow = useCallback((id: string, field: keyof LetterRow, value: string | number) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row
        const updated = { ...row, [field]: value }
        // Автозаполнение дедлайна (+7 дней)
        if (field === 'date' && value && !row.deadlineDate) {
          const date = new Date(value as string)
          date.setDate(date.getDate() + 7)
          updated.deadlineDate = date.toISOString().split('T')[0]
        }
        return updated
      })
    )
    // Очистить ошибки при изменении
    setErrors((prev) => {
      const newErrors = { ...prev }
      delete newErrors[id]
      return newErrors
    })
  }, [])

  // Валидация
  const validate = (): boolean => {
    const newErrors: Record<string, string[]> = {}
    let isValid = true

    rows.forEach((row) => {
      const rowErrors: string[] = []
      if (!row.number.trim()) rowErrors.push('Номер обязателен')
      if (!row.org.trim()) rowErrors.push('Организация обязательна')
      if (!row.date) rowErrors.push('Дата обязательна')

      if (rowErrors.length > 0) {
        newErrors[row.id] = rowErrors
        isValid = false
      }
    })

    // Проверка дубликатов номеров
    const numbers = rows.map((r) => r.number.toLowerCase().trim()).filter(Boolean)
    const seen = new Set<string>()
    numbers.forEach((num, idx) => {
      if (seen.has(num)) {
        const rowId = rows.find((r) => r.number.toLowerCase().trim() === num)?.id
        if (rowId) {
          newErrors[rowId] = [...(newErrors[rowId] || []), 'Дублирующийся номер']
          isValid = false
        }
      }
      seen.add(num)
    })

    setErrors(newErrors)
    return isValid
  }

  // Создание писем
  const handleCreate = async () => {
    if (!validate()) {
      toast.error('Исправьте ошибки в форме')
      return
    }

    setCreating(true)
    const toastId = toast.loading(`Создание ${rows.length} писем...`)

    try {
      const letters = rows.map((row) => ({
        number: row.number.trim(),
        org: row.org.trim(),
        date: row.date,
        deadlineDate: row.deadlineDate || undefined,
        type: row.type || undefined,
        content: row.content || undefined,
        priority: row.priority,
      }))

      const res = await fetch('/api/letters/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ letters, skipDuplicates }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.duplicates) {
          toast.error(`Дубликаты: ${data.duplicates.join(', ')}`, { id: toastId })
        } else if (data.details) {
          toast.error(data.error, { id: toastId })
        } else {
          throw new Error(data.error || 'Ошибка создания')
        }
        return
      }

      setCreatedLetters(data.letters || [])

      let message = `Создано ${data.created} писем`
      if (data.skipped > 0) {
        message += `, пропущено ${data.skipped}`
      }
      toast.success(message, { id: toastId })

      onSuccess?.(data.letters || [])

      // Если создано хоть одно письмо, показать опции
      if (data.created > 0) {
        // Не закрываем, чтобы пользователь мог экспортировать
      }
    } catch (error) {
      console.error('Bulk create error:', error)
      toast.error(error instanceof Error ? error.message : 'Ошибка создания', { id: toastId })
    } finally {
      setCreating(false)
    }
  }

  // Экспорт в Excel (CSV)
  const exportToExcel = () => {
    const data = createdLetters.length > 0 ? createdLetters : rows
    const headers = ['Номер', 'Организация', 'Дата', 'Дедлайн', 'Тип', 'Содержание', 'Приоритет']

    const csvContent = [
      headers.join(','),
      ...data.map((item: any) => {
        const row = [
          `"${(item.number || '').replace(/"/g, '""')}"`,
          `"${(item.org || '').replace(/"/g, '""')}"`,
          item.date ? new Date(item.date).toLocaleDateString('ru-RU') : '',
          item.deadlineDate ? new Date(item.deadlineDate).toLocaleDateString('ru-RU') : '',
          `"${(item.type || '').replace(/"/g, '""')}"`,
          `"${(item.content || '').replace(/"/g, '""')}"`,
          item.priority || 50,
        ]
        return row.join(',')
      }),
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `letters_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)

    toast.success('Экспортировано в CSV')
  }

  // Сброс формы
  const reset = () => {
    setRows([createEmptyRow()])
    setErrors({})
    setCreatedLetters([])
  }

  const hasCreated = createdLetters.length > 0

  return (
    <div className="mx-auto max-w-6xl rounded-xl border border-gray-700 bg-gray-800 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListPlus className="h-5 w-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Массовое создание писем</h3>
          <span className="text-sm text-gray-400">({rows.length} шт.)</span>
        </div>
        <div className="flex items-center gap-2">
          {(rows.length > 0 || hasCreated) && (
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white transition hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              Excel
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {hasCreated ? (
        // Результат создания
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/20 p-4">
            <div className="mb-2 flex items-center gap-2 text-emerald-400">
              <Check className="h-5 w-5" />
              <span className="font-medium">Создано {createdLetters.length} писем</span>
            </div>
            <div className="space-y-1 text-sm text-gray-300">
              {(createdLetters as any[]).slice(0, 5).map((letter: any) => (
                <div key={letter.id} className="flex items-center gap-2">
                  <span className="text-emerald-400">#{letter.number}</span>
                  <span className="text-gray-400">—</span>
                  <span>{letter.org}</span>
                </div>
              ))}
              {createdLetters.length > 5 && (
                <div className="text-gray-500">...и ещё {createdLetters.length - 5}</div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.push('/letters')}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-700"
            >
              Перейти к письмам
            </button>
            <button
              onClick={reset}
              className="rounded-lg bg-gray-700 px-4 py-2.5 text-white transition hover:bg-gray-600"
            >
              Создать ещё
            </button>
          </div>
        </div>
      ) : (
        // Форма создания
        <div className="space-y-4">
          {/* Опции */}
          <div className="flex items-center gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2 text-gray-400">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500"
              />
              Пропускать дубликаты
            </label>
          </div>

          {/* Таблица */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left text-gray-400">
                  <th className="w-8 pb-2 pr-2">#</th>
                  <th className="px-2 pb-2">
                    <span className="flex items-center gap-1">
                      <Hash className="h-3 w-3" /> Номер *
                    </span>
                  </th>
                  <th className="px-2 pb-2">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> Организация *
                    </span>
                  </th>
                  <th className="px-2 pb-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Дата *
                    </span>
                  </th>
                  <th className="px-2 pb-2">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Дедлайн
                    </span>
                  </th>
                  <th className="px-2 pb-2">Тип</th>
                  <th className="px-2 pb-2">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Содержание
                    </span>
                  </th>
                  <th className="w-24 pb-2 pl-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`border-b border-gray-700/50 ${errors[row.id] ? 'bg-red-500/10' : ''}`}
                  >
                    <td className="py-2 pr-2 text-gray-500">{index + 1}</td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={row.number}
                        onChange={(e) => updateRow(row.id, 'number', e.target.value)}
                        className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                        placeholder="7941"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={row.org}
                        onChange={(e) => updateRow(row.id, 'org', e.target.value)}
                        className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                        placeholder="Организация"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) => updateRow(row.id, 'date', e.target.value)}
                        className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        value={row.deadlineDate}
                        onChange={(e) => updateRow(row.id, 'deadlineDate', e.target.value)}
                        className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={row.type}
                        onChange={(e) => updateRow(row.id, 'type', e.target.value)}
                        className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="">—</option>
                        {LETTER_TYPES.filter((t) => t.value !== 'all').map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={row.content}
                        onChange={(e) => updateRow(row.id, 'content', e.target.value)}
                        className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                        placeholder="Краткое содержание"
                      />
                    </td>
                    <td className="py-2 pl-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => duplicateRow(row.id)}
                          className="p-1.5 text-gray-400 transition hover:text-blue-400"
                          title="Дублировать"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => removeRow(row.id)}
                          disabled={rows.length === 1}
                          className="p-1.5 text-gray-400 transition hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Ошибки */}
          {Object.keys(errors).length > 0 && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/20 p-3">
              <div className="mb-2 flex items-center gap-2 text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Ошибки валидации</span>
              </div>
              <ul className="space-y-1 text-sm text-red-300">
                {Object.entries(errors).map(([id, errs]) => {
                  const rowIndex = rows.findIndex((r) => r.id === id)
                  return (
                    <li key={id}>
                      Строка {rowIndex + 1}: {errs.join(', ')}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Добавить строку */}
          <button
            onClick={addRow}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-600 px-4 py-2 text-gray-400 transition hover:border-gray-500 hover:text-white"
          >
            <Plus className="h-4 w-4" />
            Добавить строку
          </button>

          {/* Действия */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreate}
              disabled={creating || rows.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-600"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Создание...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Создать {rows.length}{' '}
                  {rows.length === 1 ? 'письмо' : rows.length < 5 ? 'письма' : 'писем'}
                </>
              )}
            </button>
            <button
              onClick={reset}
              disabled={creating}
              className="rounded-lg bg-gray-700 px-4 py-2.5 text-white transition hover:bg-gray-600"
            >
              Сбросить
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

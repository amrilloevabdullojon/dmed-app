'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
  Upload,
  Bot,
  Paperclip,
  ArrowUpRight,
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import { DEFAULT_DEADLINE_WORKING_DAYS, LETTER_TYPES } from '@/lib/constants'
import { formatDateForInput, calculateDeadline } from '@/lib/parseLetterFilename'
import { recommendLetterType } from '@/lib/recommendLetterType'

interface LetterRow {
  id: string
  number: string
  org: string
  date: string
  deadlineDate: string
  type: string
  content: string
  priority: number
  file: File | null
  parsing: boolean
  parsedByAI: boolean
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
  file: null,
  parsing: false,
  parsedByAI: false,
})

interface ParsedPdfData {
  number: string | null
  date: string | null
  deadline: string | null
  organization: string | null
  content: string | null
}

interface ParseResult {
  id: string
  data: ParsedPdfData | null
  error?: string
}

const parsePdfContent = async (
  file: File
): Promise<{ data: ParsedPdfData | null; error?: string }> => {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/parse-pdf', {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      return { data: null, error: errorData.error || `Ошибка ${res.status}` }
    }

    const result = await res.json()
    return { data: result.data }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Неизвестная ошибка' }
  }
}

interface CreatedLetter {
  id: string
  number: string
  org: string
  date?: string
  deadlineDate?: string
  type?: string
  content?: string
  priority?: number
}

interface BulkCreateLettersProps {
  onClose?: () => void
  onSuccess?: (letters: CreatedLetter[]) => void
  pageHref?: string
}

export function BulkCreateLetters({ onClose, onSuccess, pageHref }: BulkCreateLettersProps) {
  const router = useRouter()
  const toast = useToast()
  const [rows, setRows] = useState<LetterRow[]>([createEmptyRow()])
  const [creating, setCreating] = useState(false)
  const [skipDuplicates, setSkipDuplicates] = useState(false)
  const [bulkDate, setBulkDate] = useState('')
  const [bulkDeadlineDate, setBulkDeadlineDate] = useState('')
  const [bulkType, setBulkType] = useState('')
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [createdLetters, setCreatedLetters] = useState<CreatedLetter[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState(false)

  // Парсинг PDF через API
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const pdfFiles = Array.from(files).filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      )

      if (pdfFiles.length === 0) {
        toast.error('Выберите PDF файлы')
        return
      }

      // Создаём строки для каждого файла
      const newRows: LetterRow[] = pdfFiles.map((file) => ({
        ...createEmptyRow(),
        file,
        parsing: true,
      }))

      // Если первая строка пустая - заменяем, иначе добавляем
      setRows((prev) => {
        const firstRowEmpty = prev.length === 1 && !prev[0].number && !prev[0].org && !prev[0].file
        return firstRowEmpty ? newRows : [...prev, ...newRows]
      })

      // Парсим каждый файл параллельно с использованием Promise.allSettled
      const toastId = toast.loading(`Анализ ${pdfFiles.length} PDF с помощью AI...`)

      const settledResults = await Promise.allSettled(
        newRows.map(async (row): Promise<ParseResult> => {
          if (!row.file) return { id: row.id, data: null }
          const result = await parsePdfContent(row.file)
          return { id: row.id, data: result.data, error: result.error }
        })
      )

      // Преобразуем результаты allSettled в единый формат
      const results: ParseResult[] = settledResults.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value
        }
        // Если промис отклонён, возвращаем ошибку
        return {
          id: newRows[index].id,
          data: null,
          error: result.reason instanceof Error ? result.reason.message : 'Ошибка обработки',
        }
      })

      // Обновляем строки с распознанными данными
      setRows((prev) =>
        prev.map((row) => {
          const result = results.find((r) => r.id === row.id)
          if (!result || !result.data) {
            return { ...row, parsing: false }
          }

          const data = result.data
          let deadlineDate = ''

          if (data.deadline) {
            deadlineDate = formatDateForInput(new Date(data.deadline))
          } else if (data.date) {
            deadlineDate = formatDateForInput(
              calculateDeadline(new Date(data.date), DEFAULT_DEADLINE_WORKING_DAYS)
            )
          }

          const recommendedType = recommendLetterType({
            content: data.content,
            organization: data.organization,
            filename: row.file?.name,
          })

          return {
            ...row,
            number: data.number || '',
            org: data.organization || '',
            date: data.date ? formatDateForInput(new Date(data.date)) : row.date,
            deadlineDate,
            type: row.type || recommendedType,
            content: data.content || '',
            parsing: false,
            parsedByAI: true,
          }
        })
      )

      const successCount = results.filter((r) => r.data).length
      const errorCount = results.filter((r) => r.error).length

      if (successCount === pdfFiles.length) {
        toast.success(`Все ${pdfFiles.length} PDF успешно распознаны`, { id: toastId })
      } else if (successCount > 0) {
        const message =
          errorCount > 0
            ? `Распознано ${successCount} из ${pdfFiles.length} PDF. Ошибок: ${errorCount}`
            : `Распознано ${successCount} из ${pdfFiles.length} PDF`
        toast.warning(message, { id: toastId })
      } else {
        const firstError = results.find((r) => r.error)?.error
        toast.error(`Не удалось распознать PDF файлы${firstError ? `: ${firstError}` : ''}`, {
          id: toastId,
        })
      }
    },
    [toast]
  )

  // Drag & Drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files)
      }
    },
    [handleFiles]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
    }
  }

  // Add new rows
  const addRows = useCallback((count = 1) => {
    setRows((prev) => [...prev, ...Array.from({ length: count }, () => createEmptyRow())])
  }, [])

  const addRow = useCallback(() => {
    addRows(1)
  }, [addRows])

  // Удалить строку
  const removeRow = useCallback((id: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.id !== id) : prev))
  }, [])

  // Дублировать строку
  const duplicateRow = useCallback((id: string) => {
    setRows((prev) => {
      const index = prev.findIndex((row) => row.id === id)
      if (index === -1) return prev
      const newRow = {
        ...prev[index],
        id: crypto.randomUUID(),
        number: '',
        file: null,
        parsing: false,
        parsedByAI: false,
      }
      return [...prev.slice(0, index + 1), newRow, ...prev.slice(index + 1)]
    })
  }, [])

  const clearRow = useCallback((id: string) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...createEmptyRow(), id } : row)))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const clearFile = useCallback((id: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, file: null, parsedByAI: false, parsing: false } : row
      )
    )
  }, [])

  const removeEmptyRows = useCallback(() => {
    setRows((prev) => {
      const filtered = prev.filter(
        (row) => row.number.trim() || row.org.trim() || row.content.trim() || row.file
      )
      const nextRows = filtered.length > 0 ? filtered : [createEmptyRow()]
      const ids = new Set(nextRows.map((row) => row.id))
      setErrors((prevErrors) => {
        const nextErrors: Record<string, string[]> = {}
        Object.entries(prevErrors).forEach(([id, errs]) => {
          if (ids.has(id)) nextErrors[id] = errs
        })
        return nextErrors
      })
      return nextRows
    })
  }, [])

  const applyBulkDefaults = useCallback(
    (mode: 'all' | 'empty') => {
      if (!bulkDate && !bulkDeadlineDate && !bulkType) return

      setRows((prev) =>
        prev.map((row) => {
          const updated = { ...row }
          const shouldSetDate = bulkDate && (mode === 'all' || !row.date)
          const shouldSetDeadline = bulkDeadlineDate && (mode === 'all' || !row.deadlineDate)
          const shouldSetType = bulkType && (mode === 'all' || !row.type)

          if (shouldSetDate) {
            updated.date = bulkDate
          }

          if (shouldSetDeadline) {
            updated.deadlineDate = bulkDeadlineDate
          } else if (shouldSetDate && (mode === 'all' || !row.deadlineDate)) {
            const deadline = calculateDeadline(new Date(bulkDate), DEFAULT_DEADLINE_WORKING_DAYS)
            updated.deadlineDate = formatDateForInput(deadline)
          }

          if (shouldSetType) {
            updated.type = bulkType
          }

          return updated
        })
      )

      setErrors({})
    },
    [bulkDate, bulkDeadlineDate, bulkType]
  )

  const resetBulkDefaults = useCallback(() => {
    setBulkDate('')
    setBulkDeadlineDate('')
    setBulkType('')
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
          const deadline = calculateDeadline(date, DEFAULT_DEADLINE_WORKING_DAYS)
          updated.deadlineDate = deadline.toISOString().split('T')[0]
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
    numbers.forEach((num) => {
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

  // Загрузка файлов к письмам
  const uploadFilesToLetters = async (
    letterIdMap: Map<string, string>
  ): Promise<{ success: number; failed: number }> => {
    let success = 0
    let failed = 0

    const rowsWithFiles = rows.filter((r) => r.file && letterIdMap.has(r.number.toLowerCase()))

    for (const row of rowsWithFiles) {
      if (!row.file) continue

      const letterId = letterIdMap.get(row.number.toLowerCase())
      if (!letterId) continue

      try {
        const formData = new FormData()
        formData.append('file', row.file)
        formData.append('letterId', letterId)

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (res.ok) {
          success++
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }

    return { success, failed }
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

      // Загрузка файлов
      const hasFiles = rows.some((r) => r.file)
      if (hasFiles && data.letters?.length > 0) {
        setUploadingFiles(true)
        toast.loading('Загрузка файлов...', { id: toastId })

        // Создаём карту номер -> id
        const letterIdMap = new Map<string, string>()
        const letters = data.letters as CreatedLetter[]
        for (const letter of letters) {
          letterIdMap.set(letter.number.toLowerCase(), letter.id)
        }

        const uploadResult = await uploadFilesToLetters(letterIdMap)
        setUploadingFiles(false)

        if (uploadResult.failed > 0) {
          toast.warning(
            `Создано ${data.created} писем. Файлов загружено: ${uploadResult.success}, ошибок: ${uploadResult.failed}`,
            { id: toastId }
          )
        } else if (uploadResult.success > 0) {
          toast.success(`Создано ${data.created} писем, загружено ${uploadResult.success} файлов`, {
            id: toastId,
          })
        } else {
          toast.success(`Создано ${data.created} писем`, { id: toastId })
        }
      } else {
        let message = `Создано ${data.created} писем`
        if (data.skipped > 0) {
          message += `, пропущено ${data.skipped}`
        }
        toast.success(message, { id: toastId })
      }

      setCreatedLetters(data.letters || [])
      onSuccess?.(data.letters || [])
    } catch (error) {
      console.error('Bulk create error:', error)
      toast.error(error instanceof Error ? error.message : 'Ошибка создания', { id: toastId })
    } finally {
      setCreating(false)
      setUploadingFiles(false)
    }
  }

  // Экспорт в Excel (CSV)
  const exportToExcel = () => {
    type ExportableItem = LetterRow | CreatedLetter
    const data: ExportableItem[] = createdLetters.length > 0 ? createdLetters : rows
    const headers = ['Номер', 'Организация', 'Дата', 'Дедлайн', 'Тип', 'Содержание', 'Приоритет']

    const csvContent = [
      headers.join(','),
      ...data.map((item) => {
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

  const duplicateNumbers = useMemo(() => {
    const counts = new Map<string, number>()
    rows.forEach((row) => {
      const normalized = row.number.trim().toLowerCase()
      if (!normalized) return
      counts.set(normalized, (counts.get(normalized) || 0) + 1)
    })
    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([key]) => key)
    )
  }, [rows])

  const hasCreated = createdLetters.length > 0
  const parsingCount = rows.filter((r) => r.parsing).length
  const isParsing = parsingCount > 0
  const filesCount = rows.filter((r) => r.file).length

  return (
    <div className="mx-auto max-w-6xl rounded-xl border border-gray-700 bg-gray-800 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListPlus className="h-5 w-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Массовое создание писем</h3>
          <span className="text-sm text-gray-400">({rows.length} шт.)</span>
          {filesCount > 0 && (
            <span className="flex items-center gap-1 rounded bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
              <Paperclip className="h-3 w-3" />
              {filesCount} файлов
            </span>
          )}
          {parsingCount > 0 && (
            <span className="flex items-center gap-1 rounded bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">
              <Loader2 className="h-3 w-3 animate-spin" />
              {'\u0420\u0430\u0437\u0431\u043e\u0440'} {parsingCount}
            </span>
          )}
          {duplicateNumbers.size > 0 && (
            <span className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
              <AlertCircle className="h-3 w-3" />
              {'\u0415\u0441\u0442\u044c \u0434\u0443\u0431\u043b\u0438'}
            </span>
          )}
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
          {pageHref && (
            <Link
              href={pageHref}
              className="flex items-center gap-1 rounded-lg bg-gray-700 px-3 py-1.5 text-sm text-white transition hover:bg-gray-600"
            >
              <ArrowUpRight className="h-4 w-4" />
              Открыть на странице
            </Link>
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
              {createdLetters.slice(0, 5).map((letter) => (
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
          {/* Drop zone для PDF */}
          <div
            className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition ${
              dragOver
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-gray-600 hover:border-gray-500'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => document.getElementById('bulk-file-input')?.click()}
          >
            <input
              id="bulk-file-input"
              type="file"
              className="hidden"
              accept=".pdf"
              multiple
              onChange={handleFileSelect}
            />
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <Upload className="h-6 w-6 text-gray-500" />
                <Bot className="h-6 w-6 text-purple-400" />
              </div>
              <p className="text-gray-300">
                Перетащите PDF файлы сюда или <span className="text-purple-400">выберите</span>
              </p>
              <p className="text-xs text-gray-500">
                AI автоматически извлечёт данные из каждого PDF
              </p>
            </div>
          </div>

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

          {/* Bulk defaults */}
          <div className="rounded-lg border border-gray-700/60 bg-gray-900/40 p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex min-w-[160px] flex-col gap-1">
                <span className="text-xs text-gray-500">
                  {'\u041e\u0431\u0449\u0430\u044f \u0434\u0430\u0442\u0430'}
                </span>
                <input
                  type="date"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="flex min-w-[160px] flex-col gap-1">
                <span className="text-xs text-gray-500">
                  {'\u041e\u0431\u0449\u0438\u0439 \u0434\u0435\u0434\u043b\u0430\u0439\u043d'}
                </span>
                <input
                  type="date"
                  value={bulkDeadlineDate}
                  onChange={(e) => setBulkDeadlineDate(e.target.value)}
                  className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="flex min-w-[180px] flex-col gap-1">
                <span className="text-xs text-gray-500">
                  {'\u041e\u0431\u0449\u0438\u0439 \u0442\u0438\u043f'}
                </span>
                <select
                  value={bulkType}
                  onChange={(e) => setBulkType(e.target.value)}
                  className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">{'\u0411\u0435\u0437 \u0442\u0438\u043f\u0430'}</option>
                  {LETTER_TYPES.filter((t) => t.value !== 'all').map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyBulkDefaults('empty')}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 transition hover:bg-emerald-500/20"
                >
                  {'\u041a \u043f\u0443\u0441\u0442\u044b\u043c'}
                </button>
                <button
                  type="button"
                  onClick={() => applyBulkDefaults('all')}
                  className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-300 transition hover:bg-blue-500/20"
                >
                  {'\u041a\u043e \u0432\u0441\u0435\u043c'}
                </button>
                <button
                  type="button"
                  onClick={resetBulkDefaults}
                  className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-1.5 text-xs text-gray-200 transition hover:bg-gray-600"
                >
                  {'\u0421\u0431\u0440\u043e\u0441'}
                </button>
                <button
                  type="button"
                  onClick={removeEmptyRows}
                  className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-1.5 text-xs text-gray-200 transition hover:bg-gray-600"
                >
                  {'\u0423\u0431\u0440\u0430\u0442\u044c \u043f\u0443\u0441\u0442\u044b\u0435'}
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {
                '\u0414\u0430\u0442\u0430 \u0438 \u0434\u0435\u0434\u043b\u0430\u0439\u043d \u043f\u0440\u0438\u043c\u0435\u043d\u044f\u044e\u0442\u0441\u044f \u0441 \u043e\u0431\u0449\u0438\u043c \u0440\u0430\u0441\u0447\u0451\u0442\u043e\u043c, \u0435\u0441\u043b\u0438 \u0434\u0435\u0434\u043b\u0430\u0439\u043d \u043f\u0443\u0441\u0442\u043e\u0439.'
              }
            </p>
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
                  <th className="w-28 pb-2 pl-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const normalizedNumber = row.number.trim().toLowerCase()
                  const isDuplicate =
                    normalizedNumber.length > 0 && duplicateNumbers.has(normalizedNumber)
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-gray-700/50 ${isDuplicate ? 'bg-amber-500/10' : ''} ${errors[row.id] ? 'bg-red-500/10' : ''} ${row.parsing ? 'animate-pulse bg-purple-500/5' : ''}`}
                    >
                      <td className="py-2 pr-2 text-gray-500">
                        <div className="flex items-center gap-1">
                          {index + 1}
                          {row.parsing && (
                            <Loader2 className="h-3 w-3 animate-spin text-purple-400" />
                          )}
                          {row.parsedByAI && !row.parsing && (
                            <span title="Распознано AI">
                              <Bot className="h-3 w-3 text-purple-400" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={row.number}
                            onChange={(e) => updateRow(row.id, 'number', e.target.value)}
                            disabled={row.parsing}
                            className={`flex-1 rounded border ${isDuplicate ? 'border-amber-500/60' : 'border-gray-600'} bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50`}
                            placeholder="7941"
                          />
                          {isDuplicate && (
                            <span
                              title={
                                '\u0414\u0443\u0431\u043b\u0438\u043a\u0430\u0442 \u043d\u043e\u043c\u0435\u0440\u0430'
                              }
                            >
                              <AlertCircle className="h-4 w-4 text-amber-400" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={row.org}
                          onChange={(e) => updateRow(row.id, 'org', e.target.value)}
                          disabled={row.parsing}
                          className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                          placeholder="Организация"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) => updateRow(row.id, 'date', e.target.value)}
                          disabled={row.parsing}
                          className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="date"
                          value={row.deadlineDate}
                          onChange={(e) => updateRow(row.id, 'deadlineDate', e.target.value)}
                          disabled={row.parsing}
                          className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={row.type}
                          onChange={(e) => updateRow(row.id, 'type', e.target.value)}
                          disabled={row.parsing}
                          className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
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
                          disabled={row.parsing}
                          className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                          placeholder="Краткое содержание"
                        />
                      </td>
                      <td className="py-2 pl-2">
                        <div className="flex items-center gap-1">
                          {row.file && (
                            <span
                              className="truncate rounded bg-gray-700 px-1.5 py-0.5 text-xs text-gray-300"
                              title={row.file.name}
                            >
                              <Paperclip className="inline h-3 w-3" />
                            </span>
                          )}
                          {row.file && (
                            <button
                              type="button"
                              onClick={() => clearFile(row.id)}
                              className="p-1.5 text-gray-400 transition hover:text-amber-400"
                              title={
                                '\u0423\u0431\u0440\u0430\u0442\u044c \u0444\u0430\u0439\u043b'
                              }
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => duplicateRow(row.id)}
                            disabled={row.parsing}
                            className="p-1.5 text-gray-400 transition hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-30"
                            title={
                              '\u0414\u0443\u0431\u043b\u0438\u0440\u043e\u0432\u0430\u0442\u044c'
                            }
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => clearRow(row.id)}
                            disabled={row.parsing}
                            className="p-1.5 text-gray-400 transition hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-30"
                            title={
                              '\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0441\u0442\u0440\u043e\u043a\u0443'
                            }
                          >
                            <X className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
                            disabled={rows.length === 1 || row.parsing}
                            className="p-1.5 text-gray-400 transition hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                            title={'\u0423\u0434\u0430\u043b\u0438\u0442\u044c'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
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

          {/* Add rows */}
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={addRow}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-600 px-4 py-2 text-gray-400 transition hover:border-gray-500 hover:text-white"
            >
              <Plus className="h-4 w-4" />
              {
                '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0441\u0442\u0440\u043e\u043a\u0443'
              }
            </button>
            <button
              type="button"
              onClick={() => addRows(5)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-600 px-4 py-2 text-gray-400 transition hover:border-gray-500 hover:text-white"
            >
              <ListPlus className="h-4 w-4" />
              {'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c 5 \u0441\u0442\u0440\u043e\u043a'}
            </button>
          </div>

          {/* Действия */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreate}
              disabled={creating || isParsing || rows.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-600"
            >
              {creating || uploadingFiles ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {uploadingFiles ? 'Загрузка файлов...' : 'Создание...'}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Создать {rows.length}{' '}
                  {rows.length === 1 ? 'письмо' : rows.length < 5 ? 'письма' : 'писем'}
                  {filesCount > 0 && ` + ${filesCount} файлов`}
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

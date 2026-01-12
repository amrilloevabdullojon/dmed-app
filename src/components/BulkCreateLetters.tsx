'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { bulkCreateLettersSchema, type BulkCreateLettersInput } from '@/lib/schemas'

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
  const [creating, setCreating] = useState(false)
  const [createdLetters, setCreatedLetters] = useState<CreatedLetter[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState(false)

  // File state (отдельно от формы, т.к. File объекты не валидируются Zod)
  const [files, setFiles] = useState<Map<string, File>>(new Map())
  const [parsingStates, setParsingStates] = useState<Map<string, boolean>>(new Map())
  const [parsedByAI, setParsedByAI] = useState<Map<string, boolean>>(new Map())

  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<BulkCreateLettersInput>({
    resolver: zodResolver(bulkCreateLettersSchema),
    mode: 'onChange',
    defaultValues: {
      letters: [createEmptyRow()],
      skipDuplicates: false,
      bulkDate: '',
      bulkDeadlineDate: '',
      bulkType: '',
    },
  })

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: 'letters',
  })

  const formValues = watch()
  const bulkDate = watch('bulkDate')
  const bulkDeadlineDate = watch('bulkDeadlineDate')
  const bulkType = watch('bulkType')

  // Парсинг PDF через API
  const handleFiles = useCallback(
    async (uploadedFiles: FileList | File[]) => {
      const pdfFiles = Array.from(uploadedFiles).filter(
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
      const firstRowEmpty =
        fields.length === 1 &&
        !formValues.letters[0].number &&
        !formValues.letters[0].org &&
        !files.has(fields[0].id)

      if (firstRowEmpty) {
        // Заменяем первую строку
        remove(0)
      }

      // Добавляем новые строки
      newRows.forEach((row) => {
        append(row)
        setFiles((prev) => new Map(prev).set(row.id, row.file!))
        setParsingStates((prev) => new Map(prev).set(row.id, true))
      })

      // Парсим каждый файл параллельно
      const toastId = toast.loading(`Анализ ${pdfFiles.length} PDF с помощью AI...`)

      const settledResults = await Promise.allSettled(
        newRows.map(async (row): Promise<ParseResult> => {
          if (!row.file) return { id: row.id, data: null }
          const result = await parsePdfContent(row.file)
          return { id: row.id, data: result.data, error: result.error }
        })
      )

      const results: ParseResult[] = settledResults.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value
        }
        return {
          id: newRows[index].id,
          data: null,
          error: result.reason instanceof Error ? result.reason.message : 'Ошибка обработки',
        }
      })

      // Обновляем строки с распознанными данными
      results.forEach((result, resultIndex) => {
        const fieldIndex = firstRowEmpty
          ? resultIndex
          : fields.length - newRows.length + resultIndex
        const row = newRows[resultIndex]

        setParsingStates((prev) => {
          const next = new Map(prev)
          next.set(row.id, false)
          return next
        })

        if (!result.data) return

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

        // Обновляем поля формы
        setValue(`letters.${fieldIndex}.number`, data.number || '')
        setValue(`letters.${fieldIndex}.org`, data.organization || '')
        setValue(
          `letters.${fieldIndex}.date`,
          data.date ? formatDateForInput(new Date(data.date)) : row.date
        )
        setValue(`letters.${fieldIndex}.deadlineDate`, deadlineDate)
        setValue(`letters.${fieldIndex}.content`, data.content || '')
        if (recommendedType) {
          setValue(`letters.${fieldIndex}.type`, recommendedType)
        }

        setParsedByAI((prev) => new Map(prev).set(row.id, true))
      })

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
    [toast, fields, formValues, files, append, remove, setValue]
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
  const addRows = useCallback(
    (count = 1) => {
      for (let i = 0; i < count; i++) {
        append(createEmptyRow())
      }
    },
    [append]
  )

  const addRow = useCallback(() => {
    addRows(1)
  }, [addRows])

  // Дублировать строку
  const duplicateRow = useCallback(
    (index: number) => {
      const row = formValues.letters[index]
      const newRow = {
        ...createEmptyRow(),
        org: row.org,
        date: row.date,
        deadlineDate: row.deadlineDate,
        type: row.type,
        content: row.content,
        priority: row.priority,
      }
      // Insert after current row
      const newFields = [...formValues.letters]
      newFields.splice(index + 1, 0, newRow)
      setValue('letters', newFields)
    },
    [formValues.letters, setValue]
  )

  const clearRow = useCallback(
    (index: number) => {
      const emptyRow = createEmptyRow()
      // Keep the ID
      emptyRow.id = fields[index].id
      update(index, emptyRow)
      // Clear file
      setFiles((prev) => {
        const next = new Map(prev)
        next.delete(fields[index].id)
        return next
      })
      setParsedByAI((prev) => {
        const next = new Map(prev)
        next.delete(fields[index].id)
        return next
      })
    },
    [fields, update]
  )

  const clearFile = useCallback((id: string) => {
    setFiles((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
    setParsedByAI((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  const removeEmptyRows = useCallback(() => {
    const filtered = formValues.letters.filter(
      (row) => row.number.trim() || row.org.trim() || row.content?.trim() || '' || files.has(row.id)
    )
    if (filtered.length > 0) {
      setValue('letters', filtered)
      // Clean up files map
      const remainingIds = new Set(filtered.map((r) => r.id))
      setFiles((prev) => {
        const next = new Map()
        prev.forEach((file, id) => {
          if (remainingIds.has(id)) next.set(id, file)
        })
        return next
      })
    } else {
      setValue('letters', [createEmptyRow()])
      setFiles(new Map())
    }
  }, [formValues.letters, files, setValue])

  const applyBulkDefaults = useCallback(
    (mode: 'all' | 'empty') => {
      if (!bulkDate && !bulkDeadlineDate && !bulkType) return

      formValues.letters.forEach((row, index) => {
        const shouldSetDate = bulkDate && (mode === 'all' || !row.date)
        const shouldSetDeadline = bulkDeadlineDate && (mode === 'all' || !row.deadlineDate)
        const shouldSetType = bulkType && (mode === 'all' || !row.type)

        if (shouldSetDate) {
          setValue(`letters.${index}.date`, bulkDate)
        }

        if (shouldSetDeadline) {
          setValue(`letters.${index}.deadlineDate`, bulkDeadlineDate)
        } else if (shouldSetDate && (mode === 'all' || !row.deadlineDate)) {
          const deadline = calculateDeadline(new Date(bulkDate), DEFAULT_DEADLINE_WORKING_DAYS)
          setValue(`letters.${index}.deadlineDate`, formatDateForInput(deadline))
        }

        if (shouldSetType) {
          setValue(`letters.${index}.type`, bulkType)
        }
      })
    },
    [bulkDate, bulkDeadlineDate, bulkType, formValues.letters, setValue]
  )

  const resetBulkDefaults = useCallback(() => {
    setValue('bulkDate', '')
    setValue('bulkDeadlineDate', '')
    setValue('bulkType', '')
  }, [setValue])

  // Загрузка файлов к письмам
  const uploadFilesToLetters = async (
    letterIdMap: Map<string, string>
  ): Promise<{ success: number; failed: number }> => {
    let success = 0
    let failed = 0

    for (const [rowId, file] of files.entries()) {
      // Find letter by number
      const row = formValues.letters.find((r) => r.id === rowId)
      if (!row) continue

      const letterId = letterIdMap.get(row.number.toLowerCase())
      if (!letterId) continue

      try {
        const formData = new FormData()
        formData.append('file', file)
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
  const onSubmit = async (data: BulkCreateLettersInput) => {
    setCreating(true)
    const toastId = toast.loading(`Создание ${data.letters.length} писем...`)

    try {
      const letters = data.letters.map((row) => ({
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
        body: JSON.stringify({ letters, skipDuplicates: data.skipDuplicates }),
      })

      const result = await res.json()

      if (!res.ok) {
        if (result.duplicates) {
          toast.error(`Дубликаты: ${result.duplicates.join(', ')}`, { id: toastId })
        } else if (result.details) {
          toast.error(result.error, { id: toastId })
        } else {
          throw new Error(result.error || 'Ошибка создания')
        }
        return
      }

      // Загрузка файлов
      const hasFiles = files.size > 0
      if (hasFiles && result.letters?.length > 0) {
        setUploadingFiles(true)
        toast.loading('Загрузка файлов...', { id: toastId })

        const letterIdMap = new Map<string, string>()
        const createdLetters = result.letters as CreatedLetter[]
        for (const letter of createdLetters) {
          letterIdMap.set(letter.number.toLowerCase(), letter.id)
        }

        const uploadResult = await uploadFilesToLetters(letterIdMap)
        setUploadingFiles(false)

        if (uploadResult.failed > 0) {
          toast.warning(
            `Создано ${result.created} писем. Файлов загружено: ${uploadResult.success}, ошибок: ${uploadResult.failed}`,
            { id: toastId }
          )
        } else if (uploadResult.success > 0) {
          toast.success(
            `Создано ${result.created} писем, загружено ${uploadResult.success} файлов`,
            {
              id: toastId,
            }
          )
        } else {
          toast.success(`Создано ${result.created} писем`, { id: toastId })
        }
      } else {
        let message = `Создано ${result.created} писем`
        if (result.skipped > 0) {
          message += `, пропущено ${result.skipped}`
        }
        toast.success(message, { id: toastId })
      }

      setCreatedLetters(result.letters || [])
      onSuccess?.(result.letters || [])
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
    const data: ExportableItem[] = createdLetters.length > 0 ? createdLetters : formValues.letters
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
  const resetForm = () => {
    reset()
    setFiles(new Map())
    setParsingStates(new Map())
    setParsedByAI(new Map())
    setCreatedLetters([])
  }

  const duplicateNumbers = useMemo(() => {
    const counts = new Map<string, number>()
    formValues.letters.forEach((row) => {
      const normalized = row.number.trim().toLowerCase()
      if (!normalized) return
      counts.set(normalized, (counts.get(normalized) || 0) + 1)
    })
    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([key]) => key)
    )
  }, [formValues.letters])

  const hasCreated = createdLetters.length > 0
  const parsingCount = Array.from(parsingStates.values()).filter(Boolean).length
  const isParsing = parsingCount > 0
  const filesCount = files.size

  return (
    <div className="mx-auto max-w-6xl rounded-xl border border-gray-700 bg-gray-800 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListPlus className="h-5 w-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Массовое создание писем</h3>
          <span className="text-sm text-gray-400">({fields.length} шт.)</span>
          {filesCount > 0 && (
            <span className="flex items-center gap-1 rounded bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
              <Paperclip className="h-3 w-3" />
              {filesCount} файлов
            </span>
          )}
          {parsingCount > 0 && (
            <span className="flex items-center gap-1 rounded bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">
              <Loader2 className="h-3 w-3 animate-spin" />
              Разбор {parsingCount}
            </span>
          )}
          {duplicateNumbers.size > 0 && (
            <span className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
              <AlertCircle className="h-3 w-3" />
              Есть дубли
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(fields.length > 0 || hasCreated) && (
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
              onClick={resetForm}
              className="rounded-lg bg-gray-700 px-4 py-2.5 text-white transition hover:bg-gray-600"
            >
              Создать ещё
            </button>
          </div>
        </div>
      ) : (
        // Форма создания
        <form
          onSubmit={handleSubmit(onSubmit as (data: BulkCreateLettersInput) => Promise<void>)}
          className="space-y-4"
        >
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
                {...register('skipDuplicates')}
                className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500"
              />
              Пропускать дубликаты
            </label>
          </div>

          {/* Bulk defaults */}
          <div className="rounded-lg border border-gray-700/60 bg-gray-900/40 p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex min-w-[160px] flex-col gap-1">
                <span className="text-xs text-gray-500">Общая дата</span>
                <input
                  type="date"
                  {...register('bulkDate')}
                  className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="flex min-w-[160px] flex-col gap-1">
                <span className="text-xs text-gray-500">Общий дедлайн</span>
                <input
                  type="date"
                  {...register('bulkDeadlineDate')}
                  className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="flex min-w-[180px] flex-col gap-1">
                <span className="text-xs text-gray-500">Общий тип</span>
                <select
                  {...register('bulkType')}
                  className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Без типа</option>
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
                  К пустым
                </button>
                <button
                  type="button"
                  onClick={() => applyBulkDefaults('all')}
                  className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-300 transition hover:bg-blue-500/20"
                >
                  Ко всем
                </button>
                <button
                  type="button"
                  onClick={resetBulkDefaults}
                  className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-1.5 text-xs text-gray-200 transition hover:bg-gray-600"
                >
                  Сброс
                </button>
                <button
                  type="button"
                  onClick={removeEmptyRows}
                  className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-1.5 text-xs text-gray-200 transition hover:bg-gray-600"
                >
                  Убрать пустые
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Дата и дедлайн применяются с общим расчётом, если дедлайн пустой.
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
                {fields.map((field, index) => {
                  const row = formValues.letters[index]
                  const normalizedNumber = row.number.trim().toLowerCase()
                  const isDuplicate =
                    normalizedNumber.length > 0 && duplicateNumbers.has(normalizedNumber)
                  const isParsing = parsingStates.get(field.id) || false
                  const hasFile = files.has(field.id)
                  const isAIParsed = parsedByAI.get(field.id) || false

                  return (
                    <tr
                      key={field.id}
                      className={`border-b border-gray-700/50 ${isDuplicate ? 'bg-amber-500/10' : ''} ${errors.letters?.[index] ? 'bg-red-500/10' : ''} ${isParsing ? 'animate-pulse bg-purple-500/5' : ''}`}
                    >
                      <td className="py-2 pr-2 text-gray-500">
                        <div className="flex items-center gap-1">
                          {index + 1}
                          {isParsing && (
                            <Loader2 className="h-3 w-3 animate-spin text-purple-400" />
                          )}
                          {isAIParsed && !isParsing && (
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
                            {...register(`letters.${index}.number`)}
                            disabled={isParsing}
                            className={`flex-1 rounded border ${isDuplicate ? 'border-amber-500/60' : 'border-gray-600'} bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50`}
                            placeholder="7941"
                          />
                          {isDuplicate && (
                            <span title="Дубликат номера">
                              <AlertCircle className="h-4 w-4 text-amber-400" />
                            </span>
                          )}
                        </div>
                        {errors.letters?.[index]?.number && (
                          <p className="mt-1 text-xs text-red-400">
                            {errors.letters[index]?.number?.message}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          {...register(`letters.${index}.org`)}
                          disabled={isParsing}
                          className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                          placeholder="Организация"
                        />
                        {errors.letters?.[index]?.org && (
                          <p className="mt-1 text-xs text-red-400">
                            {errors.letters[index]?.org?.message}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="date"
                          {...register(`letters.${index}.date`)}
                          disabled={isParsing}
                          className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="date"
                          {...register(`letters.${index}.deadlineDate`)}
                          disabled={isParsing}
                          className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          {...register(`letters.${index}.type`)}
                          disabled={isParsing}
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
                          {...register(`letters.${index}.content`)}
                          disabled={isParsing}
                          className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                          placeholder="Краткое содержание"
                        />
                      </td>
                      <td className="py-2 pl-2">
                        <div className="flex items-center gap-1">
                          {hasFile && (
                            <span
                              className="truncate rounded bg-gray-700 px-1.5 py-0.5 text-xs text-gray-300"
                              title={files.get(field.id)?.name}
                            >
                              <Paperclip className="inline h-3 w-3" />
                            </span>
                          )}
                          {hasFile && (
                            <button
                              type="button"
                              onClick={() => clearFile(field.id)}
                              className="p-1.5 text-gray-400 transition hover:text-amber-400"
                              title="Убрать файл"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => duplicateRow(index)}
                            disabled={isParsing}
                            className="p-1.5 text-gray-400 transition hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-30"
                            title="Дублировать"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => clearRow(index)}
                            disabled={isParsing}
                            className="p-1.5 text-gray-400 transition hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-30"
                            title="Очистить строку"
                          >
                            <X className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            disabled={fields.length === 1 || isParsing}
                            className="p-1.5 text-gray-400 transition hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                            title="Удалить"
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

          {/* Ошибки валидации */}
          {errors.letters && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/20 p-3">
              <div className="mb-2 flex items-center gap-2 text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Ошибки валидации</span>
              </div>
              <ul className="space-y-1 text-sm text-red-300">
                {Object.entries(errors.letters).map(([index, error]) => {
                  if (typeof error === 'object' && error !== null) {
                    const rowErrors = Object.entries(error)
                      .filter(([key]) => key !== 'root')
                      .map(
                        ([key, val]) =>
                          `${key}: ${(val as { message?: string }).message || 'Ошибка'}`
                      )
                      .join(', ')
                    if (rowErrors) {
                      return (
                        <li key={index}>
                          Строка {parseInt(index) + 1}: {rowErrors}
                        </li>
                      )
                    }
                  }
                  return null
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
              Добавить строку
            </button>
            <button
              type="button"
              onClick={() => addRows(5)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-600 px-4 py-2 text-gray-400 transition hover:border-gray-500 hover:text-white"
            >
              <ListPlus className="h-4 w-4" />
              Добавить 5 строк
            </button>
          </div>

          {/* Действия */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={creating || isParsing || fields.length === 0}
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
                  Создать {fields.length}{' '}
                  {fields.length === 1 ? 'письмо' : fields.length < 5 ? 'письма' : 'писем'}
                  {filesCount > 0 && ` + ${filesCount} файлов`}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={creating}
              className="rounded-lg bg-gray-700 px-4 py-2.5 text-white transition hover:bg-gray-600"
            >
              Сброс
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

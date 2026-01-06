'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload,
  FileText,
  Calendar,
  Building2,
  Hash,
  Clock,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Sparkles,
  Scan,
  MapPin,
  FileCode,
  Bot,
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import {
  parseLetterFilename,
  guessOrganization,
  calculateDeadline,
  formatDateForInput,
} from '@/lib/parseLetterFilename'
import { DEFAULT_DEADLINE_WORKING_DAYS, LETTER_TYPES } from '@/lib/constants'
import { recommendLetterType } from '@/lib/recommendLetterType'

interface ParsedPdfData {
  number: string | null
  date: string | null
  deadline: string | null
  organization: string | null
  content: string | null
  contentRussian: string | null
  region: string | null
  district: string | null
}

interface ParseMeta {
  extractedFrom?: {
    ai?: boolean
    pdf?: boolean
    filename?: boolean
  }
}

interface QuickLetterUploadProps {
  onClose?: () => void
}

export function QuickLetterUpload({ onClose }: QuickLetterUploadProps) {
  const router = useRouter()
  const toast = useToast()
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parseSource, setParseSource] = useState<'ai' | 'pdf' | 'filename' | null>(null)

  // Редактируемые поля
  const [number, setNumber] = useState('')
  const [org, setOrg] = useState('')
  const [date, setDate] = useState('')
  const [deadlineDate, setDeadlineDate] = useState('')
  const [content, setContent] = useState('')
  const [contentRussian, setContentRussian] = useState('')
  const [region, setRegion] = useState('')
  const [type, setType] = useState('')
  const [applicantName, setApplicantName] = useState('')
  const [applicantEmail, setApplicantEmail] = useState('')
  const [applicantPhone, setApplicantPhone] = useState('')
  const [applicantTelegramChatId, setApplicantTelegramChatId] = useState('')

  /**
   * Парсит PDF через API
   */
  const parsePdfContent = useCallback(
    async (f: File): Promise<{ data: ParsedPdfData; meta: ParseMeta } | null> => {
      try {
        const formData = new FormData()
        formData.append('file', f)

        const res = await fetch('/api/parse-pdf', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const err = await res.json()
          console.error('PDF parse error:', err)
          return null
        }

        const result = await res.json()
        return { data: result.data, meta: result.meta }
      } catch (error) {
        console.error('Failed to parse PDF:', error)
        return null
      }
    },
    []
  )

  const handleFile = useCallback(
    async (f: File) => {
      setFile(f)
      setParsing(true)
      setParseSource(null)

      const isPdf = f.name.toLowerCase().endsWith('.pdf')

      // Сначала пробуем распарсить содержимое PDF
      if (isPdf) {
        toast.loading('Анализ PDF с помощью AI...', { id: 'parsing' })

        const result = await parsePdfContent(f)

        if (result?.data) {
          const { data, meta } = result

          // Определяем источник данных
          if (meta.extractedFrom?.ai) {
            setParseSource('ai')
          } else if (meta.extractedFrom?.pdf) {
            setParseSource('pdf')
          } else if (meta.extractedFrom?.filename) {
            setParseSource('filename')
          }

          if (data.number) setNumber(data.number)
          if (data.organization) setOrg(data.organization)
          if (data.date) {
            const dateObj = new Date(data.date)
            setDate(formatDateForInput(dateObj))
          }
          if (data.deadline) {
            const deadlineObj = new Date(data.deadline)
            setDeadlineDate(formatDateForInput(deadlineObj))
          } else if (data.date) {
            const dateObj = new Date(data.date)
            // +7 рабочих дней
            setDeadlineDate(
              formatDateForInput(calculateDeadline(dateObj, DEFAULT_DEADLINE_WORKING_DAYS))
            )
          }
          if (data.content) setContent(data.content)
          if (data.contentRussian) setContentRussian(data.contentRussian)
          if (data.region || data.district) {
            setRegion([data.region, data.district].filter(Boolean).join(', '))
          }
          const recommendedType = recommendLetterType({
            content: data.content,
            contentRussian: data.contentRussian,
            organization: data.organization,
            filename: f.name,
          })
          if (recommendedType) {
            setType((prev) => prev || recommendedType)
          }

          const sourceText = meta.extractedFrom?.ai
            ? 'AI'
            : meta.extractedFrom?.pdf
              ? 'PDF'
              : 'имени файла'
          toast.success(`Данные извлечены из ${sourceText}`, { id: 'parsing' })
          setParsing(false)
          return
        }
      }

      // Fallback: парсим имя файла
      const result = parseLetterFilename(f.name)

      if (result.isValid) {
        setParseSource('filename')
        setNumber(result.number)
        setDate(formatDateForInput(result.date))
        // +7 рабочих дней
        setDeadlineDate(
          formatDateForInput(calculateDeadline(result.date, DEFAULT_DEADLINE_WORKING_DAYS))
        )
        setContent(result.content)
        const guessedOrg = guessOrganization(result.content)
        setOrg(guessedOrg)
        const recommendedType = recommendLetterType({
          content: result.content,
          organization: guessedOrg,
          filename: f.name,
        })
        if (recommendedType) {
          setType((prev) => prev || recommendedType)
        }
        toast.success('Данные распознаны из имени файла', { id: 'parsing' })
      } else {
        toast.error('Не удалось распознать данные. Заполните вручную.', { id: 'parsing' })
      }

      setParsing(false)
    },
    [parsePdfContent, toast]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const f = e.dataTransfer.files?.[0]
      if (f) handleFile(f)
    },
    [handleFile]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  const handleCreate = async () => {
    if (!number || !org || !date) {
      toast.error('Заполните обязательные поля: номер, организация, дата')
      return
    }

    setCreating(true)
    const toastId = toast.loading('Создание письма...')

    try {
      // 1. Создаём письмо
      const letterRes = await fetch('/api/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number,
          org,
          date,
          deadlineDate: deadlineDate || undefined,
          type: type || undefined,
          content: content || undefined,
          applicantName: applicantName || undefined,
          applicantEmail: applicantEmail || undefined,
          applicantPhone: applicantPhone || undefined,
          applicantTelegramChatId: applicantTelegramChatId || undefined,
        }),
      })

      const letterData = await letterRes.json()

      if (!letterRes.ok) {
        throw new Error(letterData.error || 'Ошибка создания письма')
      }

      const createdLetter = letterData.letter || letterData
      const letterId = createdLetter?.id
      if (!letterId) {
        throw new Error('Missing letter id from server')
      }

      // 2. Загружаем файл, если есть
      if (file) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('letterId', letterId)

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (uploadRes.status === 413) {
          toast.error('Файл слишком большой (413)')
        } else if (!uploadRes.ok) {
          const uploadError = await uploadRes.json().catch(() => null)
          const uploadMessage = uploadError?.error || 'Failed to upload file'
          console.error(uploadMessage)
          toast.error(uploadMessage)
        }
      }

      toast.success('Письмо создано!', { id: toastId })
      router.push(`/letters/${letterId}`)
    } catch (error) {
      console.error('Create error:', error)
      toast.error(error instanceof Error ? error.message : 'Ошибка создания', { id: toastId })
    } finally {
      setCreating(false)
    }
  }

  const reset = () => {
    setFile(null)
    setParseSource(null)
    setNumber('')
    setOrg('')
    setDate('')
    setDeadlineDate('')
    setContent('')
    setContentRussian('')
    setRegion('')
    setType('')
    setApplicantName('')
    setApplicantEmail('')
    setApplicantPhone('')
    setApplicantTelegramChatId('')
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">Быстрое создание письма</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Закрыть">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <p className="mb-4 text-sm text-gray-400">
        Перетащите PDF файл письма. Gemini AI автоматически извлечёт данные и переведёт на русский.
      </p>

      {!file ? (
        // Drop zone
        <div
          className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition ${
            dragOver
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-gray-600 hover:border-gray-500'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => document.getElementById('quick-upload-input')?.click()}
        >
          <input
            id="quick-upload-input"
            aria-label="Выбрать файл"
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx"
            onChange={handleFileSelect}
          />
          <Upload className="mx-auto mb-3 h-10 w-10 text-gray-500" />
          <p className="text-gray-300">
            Перетащите файл сюда или <span className="text-emerald-400">выберите</span>
          </p>
          <p className="mt-2 text-xs text-gray-500">PDF, DOC, DOCX</p>
        </div>
      ) : (
        // Form
        <div className="space-y-4">
          {/* File info */}
          <div className="flex items-center gap-3 rounded-lg bg-gray-700/50 p-3">
            <FileText className="h-8 w-8 text-emerald-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-white">{file.name}</p>
              <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            {parsing ? (
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            ) : parseSource === 'ai' ? (
              <div className="flex items-center gap-1 text-purple-400">
                <Bot className="h-4 w-4" />
                <span className="text-xs">AI</span>
              </div>
            ) : parseSource === 'pdf' ? (
              <div className="flex items-center gap-1 text-emerald-400">
                <Scan className="h-4 w-4" />
                <span className="text-xs">PDF</span>
              </div>
            ) : parseSource === 'filename' ? (
              <div className="flex items-center gap-1 text-yellow-400">
                <FileCode className="h-4 w-4" />
                <span className="text-xs">имя</span>
              </div>
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
            )}
            <button
              onClick={reset}
              className="p-1 text-gray-400 hover:text-red-400"
              aria-label="Сбросить файл"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* AI info */}
          {parseSource === 'ai' && (
            <div className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/20 p-3 text-sm text-purple-400">
              <Bot className="h-4 w-4" />
              Данные извлечены и переведены с помощью AI
            </div>
          )}

          {/* Form fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 flex items-center gap-2 text-sm text-gray-400">
                <Hash className="h-4 w-4" />
                Номер письма *
              </label>
              <input
                type="text"
                value={number}
                aria-label="Номер письма"
                onChange={(e) => setNumber(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                placeholder="7941"
              />
            </div>

            <div>
              <label className="mb-1 flex items-center gap-2 text-sm text-gray-400">
                <Building2 className="h-4 w-4" />
                Организация *
              </label>
              <input
                type="text"
                value={org}
                aria-label="Организация"
                onChange={(e) => setOrg(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                placeholder="3-son oilaviy poliklinika"
              />
            </div>

            <div>
              <label className="mb-1 flex items-center gap-2 text-sm text-gray-400">
                <Calendar className="h-4 w-4" />
                Дата письма *
              </label>
              <input
                type="date"
                value={date}
                aria-label="Дата письма"
                onChange={(e) => {
                  setDate(e.target.value)
                  if (e.target.value) {
                    const newDate = new Date(e.target.value)
                    // +7 рабочих дней
                    setDeadlineDate(
                      formatDateForInput(calculateDeadline(newDate, DEFAULT_DEADLINE_WORKING_DAYS))
                    )
                  }
                }}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 flex items-center gap-2 text-sm text-gray-400">
                <Clock className="h-4 w-4" />
                Дедлайн
              </label>
              <input
                type="date"
                value={deadlineDate}
                aria-label="Дедлайн"
                onChange={(e) => setDeadlineDate(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 flex items-center gap-2 text-sm text-gray-400">
              <FileText className="h-4 w-4" />
              {'\u0422\u0438\u043f \u0437\u0430\u043f\u0440\u043e\u0441\u0430'}
            </label>
            <select
              value={type}
              aria-label="Тип запроса"
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="">
                {'\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0438\u043f'}
              </option>
              {LETTER_TYPES.filter((item) => item.value !== 'all').map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          {/* Additional fields from PDF */}
          {region && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 flex items-center gap-2 text-sm text-gray-400">
                  <MapPin className="h-4 w-4" />
                  Регион
                </label>
                <input
                  type="text"
                  value={region}
                  aria-label="Регион"
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 flex items-center gap-2 text-sm text-gray-400">
              <FileText className="h-4 w-4" />
              {
                '\u041a\u0440\u0430\u0442\u043a\u043e\u0435 \u0441\u043e\u0434\u0435\u0440\u0436\u0430\u043d\u0438\u0435'
              }
            </label>
            <textarea
              value={content}
              aria-label="Краткое содержание"
              onChange={(e) => setContent(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
              placeholder={
                '\u041e\u043f\u0438\u0448\u0438\u0442\u0435 \u0441\u043e\u0434\u0435\u0440\u0436\u0430\u043d\u0438\u0435 \u043f\u0438\u0441\u044c\u043c\u0430...'
              }
            />
          </div>

          <div className="rounded-lg border border-gray-600/60 bg-gray-900/40 p-4">
            <h4 className="mb-3 text-sm font-semibold text-white">{'Данные заявителя'}</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs text-gray-400">{'Имя'}</label>
                <input
                  type="text"
                  value={applicantName}
                  aria-label="Имя заявителя"
                  onChange={(e) => setApplicantName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  placeholder={'Имя заявителя'}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Email</label>
                <input
                  type="email"
                  value={applicantEmail}
                  aria-label="Email заявителя"
                  onChange={(e) => setApplicantEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">{'Телефон'}</label>
                <input
                  type="tel"
                  value={applicantPhone}
                  aria-label="Телефон заявителя"
                  onChange={(e) => setApplicantPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="+998901234567"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Telegram chat id</label>
                <input
                  type="text"
                  value={applicantTelegramChatId}
                  aria-label="Telegram chat id заявителя"
                  onChange={(e) => setApplicantTelegramChatId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="123456789"
                />
              </div>
            </div>
          </div>

          {/* Russian translation */}
          {contentRussian && (
            <div>
              <label className="mb-1 flex items-center gap-2 text-sm text-gray-400">
                <Bot className="h-4 w-4 text-purple-400" />
                Перевод на русский
              </label>
              <div className="max-h-32 w-full overflow-y-auto rounded-lg border border-gray-600 bg-gray-700/50 px-3 py-2 text-sm text-gray-300">
                {contentRussian}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreate}
              disabled={creating || parsing || !number || !org || !date}
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
                  Создать письмо
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

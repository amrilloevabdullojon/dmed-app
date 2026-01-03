'use client'

import { useSession } from 'next-auth/react'
import { Header } from '@/components/Header'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Save, Sparkles, FileText } from 'lucide-react'
import Link from 'next/link'
import { QuickLetterUpload } from '@/components/QuickLetterUpload'
import { useToast } from '@/components/Toast'
import {
  ALLOWED_FILE_EXTENSIONS,
  LETTER_TYPES,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_LABEL,
} from '@/lib/constants'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { useForm } from '@/hooks/useForm'
import { createLetterSchema } from '@/lib/schemas'
import { z, type ZodSchema } from 'zod'

type CreateLetterFormValues = Omit<z.input<typeof createLetterSchema>, 'date' | 'deadlineDate'> & {
  date: string
  deadlineDate: string
}

export default function NewLetterPage() {
  const { data: session, status } = useSession()
  useAuthRedirect(status)
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [mode, setMode] = useState<'quick' | 'manual'>('quick')
  const [attachment, setAttachment] = useState<File | null>(null)

  const form = useForm<CreateLetterFormValues>({
    initialValues: {
      number: '',
      org: '',
      date: new Date().toISOString().split('T')[0],
      deadlineDate: '',
      type: '',
      content: '',
      comment: '',
      contacts: '',
      jiraLink: '',
      applicantName: '',
      applicantEmail: '',
      applicantPhone: '',
      applicantTelegramChatId: '',
    },
    schema: createLetterSchema as unknown as ZodSchema<CreateLetterFormValues>,
    validateOnChange: false,
    validateOnBlur: false,
    onError: () => setError('Проверьте обязательные поля.'),
    onSubmit: async (values) => {
      setLoading(true)
      setError('')

      try {
        const res = await fetch('/api/letters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        })

        const data = await res.json()

        if (data.success) {
          if (attachment) {
            const formData = new FormData()
            formData.append('file', attachment)
            formData.append('letterId', data.letter.id)

            const uploadRes = await fetch('/api/upload', {
              method: 'POST',
              body: formData,
            })

            if (!uploadRes.ok) {
              toast.error('Письмо создано, но файл не загрузился.')
            }
          }

          router.push(`/letters/${data.letter.id}`)
        } else {
          setError(data.error || 'Ошибка при создании письма')
        }
      } catch (err) {
        setError('Ошибка соединения с сервером')
      } finally {
        setLoading(false)
      }
    },
  })
  const handleSubmit = form.handleSubmit

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (file && file.size > MAX_FILE_SIZE) {
      toast.error(`Файл слишком большой. Максимум ${MAX_FILE_SIZE_LABEL}.`)
      e.target.value = ''
      return
    }
    setAttachment(file)
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Link
          href="/letters"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          Назад к списку
        </Link>

        <div className="flex flex-col sm:flex-row gap-2 mb-6">
          <button
            onClick={() => setMode('quick')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition w-full sm:w-auto ${
              mode === 'quick'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Быстрое создание
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition w-full sm:w-auto ${
              mode === 'manual'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            Ручной ввод
          </button>
        </div>

        {mode === 'quick' ? (
          <QuickLetterUpload />
        ) : (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 sm:p-6">
            <h1 className="text-2xl font-bold text-white mb-6">Новое письмо</h1>

            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Номер письма *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.values.number}
                    aria-label="Номер письма"
                    onChange={(e) => form.setValue('number', e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                    placeholder="Например: 01-15/1234"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Дата письма *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.values.date}
                    aria-label="Дата письма"
                    onChange={(e) => form.setValue('date', e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Дедлайн
                  </label>
                  <input
                    type="date"
                    value={form.values.deadlineDate}
                    aria-label="Дедлайн"
                    onChange={(e) => form.setValue('deadlineDate', e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Если не указано, будет рассчитано автоматически (+7 рабочих дней)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Ссылка на Jira
                  </label>
                  <input
                    type="url"
                    value={form.values.jiraLink}
                    aria-label="Ссылка на Jira"
                    onChange={(e) => form.setValue('jiraLink', e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                    placeholder="https://jira.example.com/browse/..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Организация *
                </label>
                <input
                  type="text"
                  required
                  value={form.values.org}
                  aria-label="Организация"
                  onChange={(e) => form.setValue('org', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                  placeholder="Название организации"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Файл (опционально)
                </label>
                <input
                  type="file"
                  aria-label="Файл"
                  accept={ALLOWED_FILE_EXTENSIONS}
                  onChange={handleAttachmentChange}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white file:mr-3 file:py-2 file:px-3 file:border-0 file:bg-gray-600 file:text-white file:rounded-md"
                />
                {attachment && (
                  <p className="text-xs text-gray-400 mt-1">{attachment.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Тип запроса
                </label>
                <select
                  value={form.values.type}
                  aria-label="Тип запроса"
                  onChange={(e) => form.setValue('type', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Выберите тип</option>
                  {LETTER_TYPES.filter((item) => item.value !== 'all').map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Содержание
                </label>
                <textarea
                  rows={4}
                  value={form.values.content}
                  aria-label="Содержание"
                  onChange={(e) => form.setValue('content', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 resize-none"
                  placeholder="Краткое описание содержания письма"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Контакты
                </label>
                <input
                  type="text"
                  value={form.values.contacts}
                  aria-label="Контакты"
                  onChange={(e) => form.setValue('contacts', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                  placeholder="Телефон, email контактного лица"
                />
              </div>

              <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-4">
                <h4 className="text-sm font-semibold text-white mb-4">
                  Данные заявителя
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Имя
                    </label>
                    <input
                      type="text"
                      value={form.values.applicantName}
                      aria-label="Имя заявителя"
                      onChange={(e) => form.setValue('applicantName', e.target.value)}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                      placeholder="Имя заявителя"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                    <input
                      type="email"
                      value={form.values.applicantEmail}
                      aria-label="Email заявителя"
                      onChange={(e) => form.setValue('applicantEmail', e.target.value)}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                      placeholder="email@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Телефон
                    </label>
                    <input
                      type="tel"
                      value={form.values.applicantPhone}
                      aria-label="Телефон заявителя"
                      onChange={(e) => form.setValue('applicantPhone', e.target.value)}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                      placeholder="+998901234567"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Telegram chat id
                    </label>
                    <input
                      type="text"
                      value={form.values.applicantTelegramChatId}
                      aria-label="Telegram chat id заявителя"
                      onChange={(e) =>
                        form.setValue('applicantTelegramChatId', e.target.value)
                      }
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                      placeholder="123456789"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Комментарий
                </label>
                <textarea
                  rows={2}
                  value={form.values.comment}
                  aria-label="Комментарий"
                  onChange={(e) => form.setValue('comment', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 resize-none"
                  placeholder="Внутренний комментарий"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
                <Link
                  href="/letters"
                  className="px-4 py-2 text-gray-400 hover:text-white transition"
                >
                  Отмена
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  {loading ? 'Сохранение...' : 'Создать письмо'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}

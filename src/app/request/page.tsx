'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import { Header } from '@/components/Header'
import { useToast } from '@/components/Toast'
import {
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_LABEL,
  REQUEST_ALLOWED_FILE_EXTENSIONS,
  REQUEST_MAX_FILES,
} from '@/lib/constants'
import { Paperclip, Send, Trash2 } from 'lucide-react'

interface RequestFormState {
  organization: string
  contactName: string
  contactEmail: string
  contactPhone: string
  contactTelegram: string
  description: string
}

declare global {
  interface Window {
    onTurnstileSuccess?: (token: string) => void
    onTurnstileExpired?: () => void
    onTurnstileError?: () => void
    turnstile?: {
      reset: () => void
    }
  }
}

const initialForm: RequestFormState = {
  organization: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  contactTelegram: '',
  description: '',
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function RequestPage() {
  const toast = useToast()
  const [form, setForm] = useState<RequestFormState>(initialForm)
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!turnstileSiteKey) return

    window.onTurnstileSuccess = (token: string) => setTurnstileToken(token)
    window.onTurnstileExpired = () => setTurnstileToken('')
    window.onTurnstileError = () => setTurnstileToken('')

    return () => {
      delete window.onTurnstileSuccess
      delete window.onTurnstileExpired
      delete window.onTurnstileError
    }
  }, [turnstileSiteKey])

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || [])
    if (selected.length === 0) return

    const nextFiles: File[] = []
    for (const file of selected) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(
          `Файл слишком большой. Максимум ${MAX_FILE_SIZE_LABEL}.`
        )
        continue
      }
      nextFiles.push(file)
    }

    const combined = [...files, ...nextFiles]
    if (combined.length > REQUEST_MAX_FILES) {
      toast.warning(
        `Максимум ${REQUEST_MAX_FILES} файлов. Лишние файлы не будут добавлены.`
      )
    }

    setFiles(combined.slice(0, REQUEST_MAX_FILES))
    event.target.value = ''
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index))
  }

  const resetForm = () => {
    setForm(initialForm)
    setFiles([])
    setSubmitted(false)
    setTurnstileToken('')
    if (typeof window !== 'undefined' && window.turnstile?.reset) {
      try {
        window.turnstile.reset()
      } catch {
        // Ignore Turnstile reset errors in the UI.
      }
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    if (!turnstileSiteKey) {
      toast.error('Captcha is not configured.')
      return
    }

    if (!turnstileToken) {
      toast.error('Please complete the captcha.')
      return
    }

    setSubmitting(true)
    const toastId = toast.loading('Отправка заявки...')

    try {
      const formData = new FormData()
      formData.append('organization', form.organization)
      formData.append('contactName', form.contactName)
      formData.append('contactEmail', form.contactEmail)
      formData.append('contactPhone', form.contactPhone)
      formData.append('contactTelegram', form.contactTelegram)
      formData.append('description', form.description)
      formData.append('website', honeypot)
      formData.append('cf-turnstile-response', turnstileToken)

      files.forEach((file) => {
        formData.append('files', file)
      })

      const response = await fetch('/api/requests', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Request failed')
      }

      if (Array.isArray(data.filesFailed) && data.filesFailed.length > 0) {
        toast.warning(
          'Часть файлов не загрузилась. Заявка все равно создана.'
        )
      }

      toast.success(
        'Заявка отправлена. Мы свяжемся с вами в ближайшее время.',
        { id: toastId }
      )
      setSubmitted(true)
    } catch (error) {
      console.error('Request submit failed:', error)
      toast.error(
        'Не удалось отправить заявку. Попробуйте еще раз.',
        { id: toastId }
      )
    } finally {
      setSubmitting(false)
      setTurnstileToken('')
      if (typeof window !== 'undefined' && window.turnstile?.reset) {
        try {
          window.turnstile.reset()
        } catch {
          // Ignore Turnstile reset errors in the UI.
        }
      }
    }
  }

  return (
    <div className="min-h-screen app-shell bg-gray-900">
      {turnstileSiteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          async
          defer
          strategy="afterInteractive"
        />
      )}
      <Header />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="panel panel-glass rounded-2xl p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-semibold text-white">
              {'Подать заявку'}
            </h1>
            <p className="text-sm text-slate-300/80 mt-2">
              {'Отправьте заявку через форму, и она сразу попадет в нашу систему.'}
            </p>
          </div>

          {submitted ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-200">
                {'Спасибо! Заявка принята.'}
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition"
              >
                {'Отправить еще одну'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {'Организация *'}
                </label>
                <input
                  type="text"
                  name="organization"
                  required
                  value={form.organization}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                  placeholder="Наименование организации"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {'Контактное лицо *'}
                  </label>
                  <input
                    type="text"
                    name="contactName"
                    required
                    value={form.contactName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                    placeholder="Кому отвечать"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {'Телефон *'}
                  </label>
                  <input
                    type="tel"
                    name="contactPhone"
                    required
                    value={form.contactPhone}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                    placeholder="+998 90 000 00 00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {'Email *'}
                  </label>
                  <input
                    type="email"
                    name="contactEmail"
                    required
                    value={form.contactEmail}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {'Telegram *'}
                  </label>
                  <input
                    type="text"
                    name="contactTelegram"
                    required
                    value={form.contactTelegram}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                    placeholder="@username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {'Содержание проблемы *'}
                </label>
                <textarea
                  name="description"
                  required
                  value={form.description}
                  onChange={handleChange}
                  rows={6}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 resize-none"
                  placeholder="Опишите, что нужно сделать, какой результат ожидается."
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">
                  {'Вложения'}
                </label>
                <div className="flex flex-col gap-3">
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 border border-dashed border-gray-500 rounded-lg text-sm text-gray-200 hover:border-emerald-500 hover:text-white cursor-pointer">
                    <Paperclip className="w-4 h-4" />
                    {'Добавить файлы'}
                    <input
                      type="file"
                      multiple
                      accept={REQUEST_ALLOWED_FILE_EXTENSIONS}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-slate-400">
                    {`До ${REQUEST_MAX_FILES} файлов, до ${MAX_FILE_SIZE_LABEL} каждый. Поддерживаются документы и фото.`}
                  </p>
                </div>

                {files.length > 0 && (
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-800/60 border border-gray-700 rounded-lg"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{file.name}</p>
                          <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-slate-400 hover:text-red-400 transition"
                          aria-label="Remove file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={(event) => setHoneypot(event.target.value)}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
              />

              {turnstileSiteKey ? (
                <div className="flex justify-start">
                  <div
                    className="cf-turnstile"
                    data-sitekey={turnstileSiteKey}
                    data-callback="onTurnstileSuccess"
                    data-expired-callback="onTurnstileExpired"
                    data-error-callback="onTurnstileError"
                    data-response-field="false"
                    data-theme="auto"
                  />
                </div>
              ) : (
                <p className="text-xs text-amber-300">
                  Turnstile is not configured.
                </p>
              )}
              <input
                type="hidden"
                name="cf-turnstile-response"
                value={turnstileToken}
              />

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition disabled:opacity-60"
              >
                <Send className={`w-4 h-4 ${submitting ? 'animate-pulse' : ''}`} />
                {submitting
                  ? 'Отправка...'
                  : 'Отправить заявку'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}

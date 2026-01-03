'use client'

import { useState } from 'react'
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
          `\u0424\u0430\u0439\u043b \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0431\u043e\u043b\u044c\u0448\u043e\u0439. \u041c\u0430\u043a\u0441\u0438\u043c\u0443\u043c ${MAX_FILE_SIZE_LABEL}.`
        )
        continue
      }
      nextFiles.push(file)
    }

    const combined = [...files, ...nextFiles]
    if (combined.length > REQUEST_MAX_FILES) {
      toast.warning(
        `\u041c\u0430\u043a\u0441\u0438\u043c\u0443\u043c ${REQUEST_MAX_FILES} \u0444\u0430\u0439\u043b\u043e\u0432. \u041b\u0438\u0448\u043d\u0438\u0435 \u0444\u0430\u0439\u043b\u044b \u043d\u0435 \u0431\u0443\u0434\u0443\u0442 \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u044b.`
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
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    const toastId = toast.loading('\u041e\u0442\u043f\u0440\u0430\u0432\u043a\u0430 \u0437\u0430\u044f\u0432\u043a\u0438...')

    try {
      const formData = new FormData()
      formData.append('organization', form.organization)
      formData.append('contactName', form.contactName)
      formData.append('contactEmail', form.contactEmail)
      formData.append('contactPhone', form.contactPhone)
      formData.append('contactTelegram', form.contactTelegram)
      formData.append('description', form.description)
      formData.append('website', honeypot)

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
          '\u0427\u0430\u0441\u0442\u044c \u0444\u0430\u0439\u043b\u043e\u0432 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043b\u0430\u0441\u044c. \u0417\u0430\u044f\u0432\u043a\u0430 \u0432\u0441\u0435 \u0440\u0430\u0432\u043d\u043e \u0441\u043e\u0437\u0434\u0430\u043d\u0430.'
        )
      }

      toast.success(
        '\u0417\u0430\u044f\u0432\u043a\u0430 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0430. \u041c\u044b \u0441\u0432\u044f\u0436\u0435\u043c\u0441\u044f \u0441 \u0432\u0430\u043c\u0438 \u0432 \u0431\u043b\u0438\u0436\u0430\u0439\u0448\u0435\u0435 \u0432\u0440\u0435\u043c\u044f.',
        { id: toastId }
      )
      setSubmitted(true)
    } catch (error) {
      console.error('Request submit failed:', error)
      toast.error(
        '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0435 \u0440\u0430\u0437.',
        { id: toastId }
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="panel panel-glass rounded-2xl p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-semibold text-white">
              {'\u041f\u043e\u0434\u0430\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443'}
            </h1>
            <p className="text-sm text-slate-300/80 mt-2">
              {'\u041e\u0442\u043f\u0440\u0430\u0432\u044c\u0442\u0435 \u0437\u0430\u044f\u0432\u043a\u0443 \u0447\u0435\u0440\u0435\u0437 \u0444\u043e\u0440\u043c\u0443, \u0438 \u043e\u043d\u0430 \u0441\u0440\u0430\u0437\u0443 \u043f\u043e\u043f\u0430\u0434\u0435\u0442 \u0432 \u043d\u0430\u0448\u0443 \u0441\u0438\u0441\u0442\u0435\u043c\u0443.'}
            </p>
          </div>

          {submitted ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-200">
                {'\u0421\u043f\u0430\u0441\u0438\u0431\u043e! \u0417\u0430\u044f\u0432\u043a\u0430 \u043f\u0440\u0438\u043d\u044f\u0442\u0430.'}
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition"
              >
                {'\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0435\u0449\u0435 \u043e\u0434\u043d\u0443'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {'\u041e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u044f *'}
                </label>
                <input
                  type="text"
                  name="organization"
                  required
                  value={form.organization}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                  placeholder="\u041d\u0430\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u043d\u0438\u0435 \u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u0438"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {'\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u043d\u043e\u0435 \u043b\u0438\u0446\u043e *'}
                  </label>
                  <input
                    type="text"
                    name="contactName"
                    required
                    value={form.contactName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                    placeholder="\u041a\u043e\u043c\u0443 \u043e\u0442\u0432\u0435\u0447\u0430\u0442\u044c"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {'\u0422\u0435\u043b\u0435\u0444\u043e\u043d *'}
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
                  {'\u0421\u043e\u0434\u0435\u0440\u0436\u0430\u043d\u0438\u0435 \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u044b *'}
                </label>
                <textarea
                  name="description"
                  required
                  value={form.description}
                  onChange={handleChange}
                  rows={6}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 resize-none"
                  placeholder="\u041e\u043f\u0438\u0448\u0438\u0442\u0435, \u0447\u0442\u043e \u043d\u0443\u0436\u043d\u043e \u0441\u0434\u0435\u043b\u0430\u0442\u044c, \u043a\u0430\u043a\u043e\u0439 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442 \u043e\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044f."
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">
                  {'\u0412\u043b\u043e\u0436\u0435\u043d\u0438\u044f'}
                </label>
                <div className="flex flex-col gap-3">
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 border border-dashed border-gray-500 rounded-lg text-sm text-gray-200 hover:border-emerald-500 hover:text-white cursor-pointer">
                    <Paperclip className="w-4 h-4" />
                    {'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0444\u0430\u0439\u043b\u044b'}
                    <input
                      type="file"
                      multiple
                      accept={REQUEST_ALLOWED_FILE_EXTENSIONS}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-slate-400">
                    {`\u0414\u043e ${REQUEST_MAX_FILES} \u0444\u0430\u0439\u043b\u043e\u0432, \u0434\u043e ${MAX_FILE_SIZE_LABEL} \u043a\u0430\u0436\u0434\u044b\u0439. \u041f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044e\u0442\u0441\u044f \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u044b \u0438 \u0444\u043e\u0442\u043e.`}
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

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition disabled:opacity-60"
              >
                <Send className={`w-4 h-4 ${submitting ? 'animate-pulse' : ''}`} />
                {submitting
                  ? '\u041e\u0442\u043f\u0440\u0430\u0432\u043a\u0430...'
                  : '\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}

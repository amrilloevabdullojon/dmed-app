'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Check, FileText, Loader2, Send, Upload, X, Copy } from 'lucide-react'
import { ALLOWED_FILE_EXTENSIONS, MAX_FILE_SIZE, MAX_FILE_SIZE_LABEL } from '@/lib/constants'
import { portalLetterSchema, type PortalLetterInput } from '@/lib/schemas'

declare global {
  interface Window {
    onTurnstileSuccess?: (token: string) => void
    onTurnstileExpired?: () => void
    onTurnstileError?: () => void
    turnstile?: {
      reset: (widgetId?: string) => void
      render?: (container: HTMLElement, options: Record<string, unknown>) => string
    }
  }
}

const MAX_FILES = 5

const copy = {
  title: '\u041f\u043e\u0434\u0430\u0442\u044c \u043f\u0438\u0441\u044c\u043c\u043e',
  subtitle:
    '\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u0434\u0430\u043d\u043d\u044b\u0435 \u0438 \u043c\u044b \u043d\u0430\u0447\u043d\u0435\u043c \u0440\u0430\u0441\u0441\u043c\u043e\u0442\u0440\u0435\u043d\u0438\u0435.',
  back: '\u041d\u0430\u0437\u0430\u0434',
  submit:
    '\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u043f\u0438\u0441\u044c\u043c\u043e',
  number: '\u041d\u043e\u043c\u0435\u0440 \u043f\u0438\u0441\u044c\u043c\u0430 *',
  org: '\u041e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u044f *',
  date: '\u0414\u0430\u0442\u0430 \u043f\u0438\u0441\u044c\u043c\u0430 *',
  content:
    '\u041a\u0440\u0430\u0442\u043a\u043e\u0435 \u0441\u043e\u0434\u0435\u0440\u0436\u0430\u043d\u0438\u0435',
  contacts:
    '\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b \u0434\u043b\u044f \u043e\u0442\u0432\u0435\u0442\u0430',
  applicant:
    '\u0414\u0430\u043d\u043d\u044b\u0435 \u0437\u0430\u044f\u0432\u0438\u0442\u0435\u043b\u044f',
  applicantName: '\u0418\u043c\u044f *',
  applicantEmail: 'Email',
  applicantPhone: '\u0422\u0435\u043b\u0435\u0444\u043e\u043d',
  applicantTelegram: 'Telegram',
  files:
    '\u0412\u043b\u043e\u0436\u0435\u043d\u0438\u044f (\u043d\u0435\u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u043e)',
  filesHint: `\u0414\u043e ${MAX_FILES} \u0444\u0430\u0439\u043b\u043e\u0432, \u0434\u043e ${MAX_FILE_SIZE_LABEL}`,
  captchaMissing:
    '\u041f\u0440\u043e\u0439\u0434\u0438\u0442\u0435 \u043a\u0430\u043f\u0447\u0443.',
  contactMissing:
    '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 email, \u0442\u0435\u043b\u0435\u0444\u043e\u043d \u0438\u043b\u0438 Telegram.',
  successTitle:
    '\u041f\u0438\u0441\u044c\u043c\u043e \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e',
  successBody:
    '\u041c\u044b \u043d\u0430\u0447\u0430\u043b\u0438 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0443. \u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0435 \u0441\u0441\u044b\u043b\u043a\u0443 \u0434\u043b\u044f \u043e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u043d\u0438\u044f.',
  portalLink:
    '\u0421\u0441\u044b\u043b\u043a\u0430 \u043d\u0430 \u0441\u0442\u0430\u0442\u0443\u0441',
  copy: '\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c',
  newLetter:
    '\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0435\u0449\u0435 \u043f\u0438\u0441\u044c\u043c\u043e',
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function PublicLetterSubmission() {
  const [files, setFiles] = useState<File[]>([])
  const [turnstileToken, setTurnstileToken] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const [portalLink, setPortalLink] = useState('')
  const [filesFailed, setFilesFailed] = useState<Array<{ name: string; reason: string }>>([])
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PortalLetterInput>({
    resolver: zodResolver(portalLetterSchema),
    mode: 'onChange',
    defaultValues: {
      number: '',
      org: '',
      date: new Date().toISOString().split('T')[0],
      content: '',
      contacts: '',
      applicantName: '',
      applicantEmail: '',
      applicantPhone: '',
      applicantTelegramChatId: '',
    },
  })

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

  const addFiles = (incoming: File[]) => {
    const nextFiles: File[] = []
    incoming.forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        return
      }
      nextFiles.push(file)
    })
    const combined = [...files, ...nextFiles].slice(0, MAX_FILES)
    setFiles(combined)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || [])
    addFiles(selected)
    event.target.value = ''
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index))
  }

  const onSubmit = async (data: PortalLetterInput) => {
    setGlobalError('')
    setFilesFailed([])

    if (turnstileSiteKey && !turnstileToken) {
      setGlobalError(copy.captchaMissing)
      return
    }
    try {
      const formData = new FormData()
      formData.append('number', data.number.trim())
      formData.append('org', data.org.trim())
      formData.append('date', data.date)
      formData.append('content', data.content?.trim() || '')
      formData.append('contacts', data.contacts?.trim() || '')
      formData.append('applicantName', data.applicantName.trim())
      formData.append('applicantEmail', data.applicantEmail?.trim() || '')
      formData.append('applicantPhone', data.applicantPhone?.trim() || '')
      formData.append('applicantTelegramChatId', data.applicantTelegramChatId?.trim() || '')
      formData.append('website', '')
      if (turnstileToken) {
        formData.append('cf-turnstile-response', turnstileToken)
      }
      files.forEach((file) => formData.append('files', file))

      const response = await fetch('/api/portal/letters', {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Submit failed')
      }

      setPortalLink(result.portalLink || '')
      setFilesFailed(Array.isArray(result.filesFailed) ? result.filesFailed : [])
      setSubmitted(true)
    } catch (err) {
      setGlobalError((err as Error).message || 'Submit failed')
    } finally {
      setTurnstileToken('')
      if (typeof window !== 'undefined' && window.turnstile?.reset) {
        try {
          window.turnstile.reset()
        } catch {
          // ignore
        }
      }
    }
  }

  const copyPortalLink = async () => {
    if (!portalLink) return
    try {
      await navigator.clipboard.writeText(portalLink)
    } catch {
      // ignore
    }
  }

  if (submitted) {
    return (
      <div className="app-shell min-h-screen">
        <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="panel panel-glass rounded-3xl p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
              <Check className="h-7 w-7 text-emerald-300" />
            </div>
            <h1 className="text-2xl font-semibold text-white">{copy.successTitle}</h1>
            <p className="mt-2 text-sm text-slate-300">{copy.successBody}</p>

            {portalLink && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                <div className="text-xs text-slate-400">{copy.portalLink}</div>
                <div className="mt-1 break-all text-sm text-emerald-200">{portalLink}</div>
                <button
                  type="button"
                  onClick={copyPortalLink}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs text-white transition hover:bg-white/20"
                >
                  <Copy className="h-4 w-4" />
                  {copy.copy}
                </button>
              </div>
            )}

            {filesFailed.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-left text-xs text-amber-200">
                {filesFailed.map((item) => (
                  <div key={item.name}>
                    {item.name}: {item.reason}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6">
              <Link
                href="/portal/letters/new"
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
              >
                {copy.newLetter}
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell min-h-screen">
      {turnstileSiteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          async
          defer
          strategy="afterInteractive"
        />
      )}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/portal"
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {copy.back}
        </Link>

        <div className="panel panel-glass rounded-3xl p-6 sm:p-8">
          <h1 className="text-2xl font-semibold text-white">{copy.title}</h1>
          <p className="mt-2 text-sm text-slate-400">{copy.subtitle}</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5">
            {globalError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {globalError}
              </div>
            )}
            {errors.applicantEmail && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {errors.applicantEmail.message}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm text-slate-300">{copy.number}</label>
                <input
                  {...register('number')}
                  className={`w-full rounded-lg border px-3 py-2 text-sm text-white focus:outline-none ${
                    errors.number
                      ? 'border-rose-500/50 bg-rose-500/10 focus:border-rose-500'
                      : 'border-white/10 bg-white/5 focus:border-emerald-400'
                  }`}
                />
                {errors.number && (
                  <p className="mt-1 text-xs text-rose-300">{errors.number.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-slate-300">{copy.date}</label>
                <input
                  type="date"
                  {...register('date')}
                  className={`w-full rounded-lg border px-3 py-2 text-sm text-white focus:outline-none ${
                    errors.date
                      ? 'border-rose-500/50 bg-rose-500/10 focus:border-rose-500'
                      : 'border-white/10 bg-white/5 focus:border-emerald-400'
                  }`}
                />
                {errors.date && <p className="mt-1 text-xs text-rose-300">{errors.date.message}</p>}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-slate-300">{copy.org}</label>
              <input
                {...register('org')}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-white focus:outline-none ${
                  errors.org
                    ? 'border-rose-500/50 bg-rose-500/10 focus:border-rose-500'
                    : 'border-white/10 bg-white/5 focus:border-emerald-400'
                }`}
              />
              {errors.org && <p className="mt-1 text-xs text-rose-300">{errors.org.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-slate-300">{copy.content}</label>
              <textarea
                {...register('content')}
                rows={4}
                className={`w-full resize-none rounded-lg border px-3 py-2 text-sm text-white focus:outline-none ${
                  errors.content
                    ? 'border-rose-500/50 bg-rose-500/10 focus:border-rose-500'
                    : 'border-white/10 bg-white/5 focus:border-emerald-400'
                }`}
              />
              {errors.content && (
                <p className="mt-1 text-xs text-rose-300">{errors.content.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-slate-300">{copy.contacts}</label>
              <input
                {...register('contacts')}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-white focus:outline-none ${
                  errors.contacts
                    ? 'border-rose-500/50 bg-rose-500/10 focus:border-rose-500'
                    : 'border-white/10 bg-white/5 focus:border-emerald-400'
                }`}
              />
              {errors.contacts && (
                <p className="mt-1 text-xs text-rose-300">{errors.contacts.message}</p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 text-sm font-medium text-white">{copy.applicant}</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs text-slate-400">
                    {copy.applicantName}
                  </label>
                  <input
                    {...register('applicantName')}
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-white focus:outline-none ${
                      errors.applicantName
                        ? 'border-rose-500/50 bg-rose-500/10 focus:border-rose-500'
                        : 'border-white/10 bg-white/5 focus:border-emerald-400'
                    }`}
                  />
                  {errors.applicantName && (
                    <p className="mt-1 text-xs text-rose-300">{errors.applicantName.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-slate-400">
                    {copy.applicantEmail}
                  </label>
                  <input
                    type="email"
                    {...register('applicantEmail')}
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-white focus:outline-none ${
                      errors.applicantEmail
                        ? 'border-rose-500/50 bg-rose-500/10 focus:border-rose-500'
                        : 'border-white/10 bg-white/5 focus:border-emerald-400'
                    }`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-slate-400">
                    {copy.applicantPhone}
                  </label>
                  <input
                    {...register('applicantPhone')}
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-white focus:outline-none ${
                      errors.applicantPhone
                        ? 'border-rose-500/50 bg-rose-500/10 focus:border-rose-500'
                        : 'border-white/10 bg-white/5 focus:border-emerald-400'
                    }`}
                  />
                  {errors.applicantPhone && (
                    <p className="mt-1 text-xs text-rose-300">{errors.applicantPhone.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-slate-400">
                    {copy.applicantTelegram}
                  </label>
                  <input
                    {...register('applicantTelegramChatId')}
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-white focus:outline-none ${
                      errors.applicantTelegramChatId
                        ? 'border-rose-500/50 bg-rose-500/10 focus:border-rose-500'
                        : 'border-white/10 bg-white/5 focus:border-emerald-400'
                    }`}
                  />
                  {errors.applicantTelegramChatId && (
                    <p className="mt-1 text-xs text-rose-300">
                      {errors.applicantTelegramChatId.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-slate-300">{copy.files}</label>
              <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 text-center">
                <Upload className="mx-auto h-6 w-6 text-slate-400" />
                <p className="mt-2 text-xs text-slate-400">{copy.filesHint}</p>
                <input
                  type="file"
                  multiple
                  accept={ALLOWED_FILE_EXTENSIONS}
                  onChange={handleFileChange}
                  className="mt-3 w-full text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-white hover:file:bg-white/20"
                />
              </div>

              {files.length > 0 && (
                <div className="mt-3 space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-sm text-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-emerald-300" />
                        <span className="truncate">{file.name}</span>
                        <span className="text-xs text-slate-400">{formatFileSize(file.size)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                        aria-label="Remove"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {turnstileSiteKey ? (
              <div className="flex justify-center">
                <div
                  className="cf-turnstile"
                  data-sitekey={turnstileSiteKey}
                  data-callback="onTurnstileSuccess"
                  data-expired-callback="onTurnstileExpired"
                  data-error-callback="onTurnstileError"
                  data-response-field="false"
                  data-theme="dark"
                />
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {copy.submit}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

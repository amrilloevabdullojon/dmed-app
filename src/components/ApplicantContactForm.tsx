'use client'

import { useState } from 'react'
import { Loader2, Bell } from 'lucide-react'

type ApplicantContactFormProps = {
  token: string
  initialEmail?: string | null
  initialTelegram?: string | null
  language?: 'ru' | 'uz'
}

export function ApplicantContactForm({
  token,
  initialEmail = '',
  initialTelegram = '',
  language = 'ru',
}: ApplicantContactFormProps) {
  const [email, setEmail] = useState(initialEmail || '')
  const [telegramChatId, setTelegramChatId] = useState(initialTelegram || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const copy =
    language === 'uz'
      ? {
          required: 'Email yoki Telegram ID kiriting',
          failed: 'Kontaktni saqlab bo\u02bclmadi',
          network: 'Tarmoq xatosi. Qayta urinib ko\u02bcring.',
          inactive: 'Obuna faol emas',
          update: 'Obunani yangilash',
          subscribe: 'Obuna bo\u02bclish',
          updated: 'Obuna yangilandi',
          emailLabel: 'Email',
          telegramLabel: 'Telegram ID',
        }
      : {
          required:
            '\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 email \u0438\u043b\u0438 Telegram ID',
          failed:
            '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043a\u043e\u043d\u0442\u0430\u043a\u0442',
          network:
            '\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0435\u0442\u0438. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0435 \u0440\u0430\u0437.',
          inactive:
            '\u041f\u043e\u0434\u043f\u0438\u0441\u043a\u0430 \u043d\u0435 \u0430\u043a\u0442\u0438\u0432\u043d\u0430',
          update:
            '\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0443',
          subscribe: '\u041f\u043e\u0434\u043f\u0438\u0441\u0430\u0442\u044c\u0441\u044f',
          updated:
            '\u041f\u043e\u0434\u043f\u0438\u0441\u043a\u0430 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0430',
          emailLabel: 'Email',
          telegramLabel: 'Telegram ID',
        }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const payload = {
      email: email.trim(),
      telegramChatId: telegramChatId.trim(),
    }

    if (!payload.email && !payload.telegramChatId) {
      setError(copy.required)
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/portal/${token}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = (await response.json()) as { error?: string; success?: boolean }

      if (!response.ok) {
        setError(data.error || copy.failed)
        return
      }

      if (data.success) {
        setSuccess(copy.updated)
      }
    } catch (err) {
      setError(copy.network)
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasEmail = !!email.trim()
  const hasTelegram = !!telegramChatId.trim()

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="text-muted flex flex-wrap gap-2 text-xs">
        {hasEmail && <span className="app-pill text-xs">Email: {email}</span>}
        {hasTelegram && <span className="app-pill text-xs">Telegram ID: {telegramChatId}</span>}
        {!hasEmail && !hasTelegram && <span className="app-pill text-xs">{copy.inactive}</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-muted text-xs">{copy.emailLabel}</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email@example.com"
            className="w-full rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-1">
          <label className="text-muted text-xs">{copy.telegramLabel}</label>
          <input
            type="text"
            value={telegramChatId}
            onChange={(event) => setTelegramChatId(event.target.value)}
            placeholder="123456789"
            className="w-full rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
            disabled={isSubmitting}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {hasEmail || hasTelegram ? copy.update : copy.subscribe}
        </button>
        {success && <span className="text-xs text-emerald-400">{success}</span>}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  )
}

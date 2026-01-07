'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Send } from 'lucide-react'

type ApplicantCommentFormProps = {
  token: string
}

export function ApplicantCommentForm({ token }: ApplicantCommentFormProps) {
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = text.trim()

    if (!trimmed) {
      setError(
        '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439'
      )
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch(`/api/portal/${token}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      })

      const data = (await response.json()) as { error?: string }

      if (!response.ok) {
        setError(
          data.error ||
            '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439'
        )
        return
      }

      setText('')
      setSuccess(true)
      router.refresh()
      setTimeout(() => setSuccess(false), 2500)
    } catch (err) {
      setError(
        '\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0435\u0442\u0438. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0435 \u0440\u0430\u0437.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        maxLength={2000}
        placeholder="\u041e\u043f\u0438\u0448\u0438\u0442\u0435 \u0432\u043e\u043f\u0440\u043e\u0441 \u0438\u043b\u0438 \u0443\u0442\u043e\u0447\u043d\u0435\u043d\u0438\u0435..."
        className="w-full rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
        disabled={isSubmitting}
      />
      <div className="text-muted flex items-center justify-between text-xs">
        <span>{'\u0414\u043e 2000 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432'}</span>
        <span>{text.length}/2000</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          disabled={isSubmitting || !text.trim()}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {isSubmitting
            ? '\u041e\u0442\u043f\u0440\u0430\u0432\u043a\u0430...'
            : '\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c'}
        </button>
        {success && (
          <span className="text-xs text-emerald-400">
            {
              '\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d'
            }
          </span>
        )}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  )
}

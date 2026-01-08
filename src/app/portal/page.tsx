'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Inbox, Search, Send, ClipboardCheck } from 'lucide-react'

const copy = {
  title:
    '\u041f\u043e\u0440\u0442\u0430\u043b \u0434\u043b\u044f \u0437\u0430\u044f\u0432\u0438\u0442\u0435\u043b\u0435\u0439',
  subtitle:
    '\u041e\u0442\u0441\u044e\u0434\u0430 \u043c\u043e\u0436\u043d\u043e \u043f\u043e\u0434\u0430\u0442\u044c \u043f\u0438\u0441\u044c\u043c\u043e \u0438\u043b\u0438 \u0437\u0430\u044f\u0432\u043a\u0443, \u0430 \u0442\u0430\u043a\u0436\u0435 \u043e\u0442\u0441\u043b\u0435\u0434\u0438\u0442\u044c \u0441\u0442\u0430\u0442\u0443\u0441.',
  lettersTitle:
    '\u0417\u0430\u044f\u0432\u0438\u0442\u0435\u043b\u044f\u043c \u043f\u0438\u0441\u0435\u043c',
  lettersBody:
    '\u041f\u043e\u0434\u0430\u0439\u0442\u0435 \u043f\u0438\u0441\u044c\u043c\u043e \u0432 \u0441\u0438\u0441\u0442\u0435\u043c\u0443 \u0438\u043b\u0438 \u043e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u0441\u0441\u044b\u043b\u043a\u0443 \u043d\u0430 \u0441\u0442\u0430\u0442\u0443\u0441.',
  letterSubmit: '\u041f\u043e\u0434\u0430\u0442\u044c \u043f\u0438\u0441\u044c\u043c\u043e',
  letterTrack:
    '\u041f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c \u043f\u0438\u0441\u044c\u043c\u043e',
  letterPlaceholder:
    '\u0412\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u0441\u0441\u044b\u043b\u043a\u0443 \u0438\u043b\u0438 \u0442\u043e\u043a\u0435\u043d',
  requestsTitle:
    '\u0417\u0430\u044f\u0432\u0438\u0442\u0435\u043b\u044f\u043c \u0437\u0430\u044f\u0432\u043e\u043a',
  requestsBody:
    '\u041f\u043e\u0434\u0430\u0439\u0442\u0435 \u0437\u0430\u044f\u0432\u043a\u0443 \u0438 \u043e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u0439\u0442\u0435 \u0442\u043e\u043b\u044c\u043a\u043e \u0441\u0432\u043e\u044e \u0437\u0430\u044f\u0432\u043a\u0443 \u043f\u043e \u043d\u043e\u043c\u0435\u0440\u0443.',
  requestSubmit: '\u041f\u043e\u0434\u0430\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443',
  requestTrack:
    '\u041f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443',
  open: '\u041e\u0442\u043a\u0440\u044b\u0442\u044c',
}

const extractPortalPath = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''

  try {
    const url = new URL(trimmed)
    if (url.pathname.startsWith('/portal/')) {
      return `${url.pathname}${url.search || ''}`
    }
  } catch {
    // Not a full URL, handle below.
  }

  const directMatch = trimmed.match(/\/portal\/([A-Za-z0-9-]+)/)
  if (directMatch?.[1]) {
    return `/portal/${directMatch[1]}`
  }

  return `/portal/${trimmed}`
}

export default function ApplicantPortalEntry() {
  const router = useRouter()
  const [letterInput, setLetterInput] = useState('')

  const letterPath = useMemo(() => extractPortalPath(letterInput), [letterInput])

  const handleLetterSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!letterPath) return
    router.push(letterPath)
  }

  return (
    <div className="app-shell min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="panel panel-glass rounded-3xl p-8 sm:p-10">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">{copy.title}</h1>
            <p className="text-sm text-slate-300 sm:text-base">{copy.subtitle}</p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <section className="panel panel-glass rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <div className="app-icon-button app-icon-cta h-10 w-10">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{copy.lettersTitle}</h2>
                  <p className="text-sm text-slate-400">{copy.lettersBody}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/portal/letters/new"
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-400"
                >
                  <Send className="h-4 w-4" />
                  {copy.letterSubmit}
                </Link>
              </div>

              <form onSubmit={handleLetterSubmit} className="mt-6 space-y-3">
                <label className="text-sm text-slate-300">{copy.letterTrack}</label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={letterInput}
                      onChange={(event) => setLetterInput(event.target.value)}
                      placeholder={copy.letterPlaceholder}
                      className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!letterPath}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ClipboardCheck className="h-4 w-4" />
                    {copy.open}
                  </button>
                </div>
              </form>
            </section>

            <section className="panel panel-glass rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <div className="app-icon-button h-10 w-10">
                  <Inbox className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{copy.requestsTitle}</h2>
                  <p className="text-sm text-slate-400">{copy.requestsBody}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/request"
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-800/80 px-4 py-2 text-sm text-white transition hover:bg-slate-700/80"
                >
                  <Send className="h-4 w-4" />
                  {copy.requestSubmit}
                </Link>
                <Link
                  href="/portal/request"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                >
                  <Search className="h-4 w-4" />
                  {copy.requestTrack}
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}

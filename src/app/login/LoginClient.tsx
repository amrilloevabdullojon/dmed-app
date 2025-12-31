'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import Image from 'next/image'

export default function LoginClient() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawNext = searchParams?.get('next')
  const nextUrl =
    rawNext && rawNext.startsWith('/') && !rawNext.startsWith('/login') ? rawNext : '/'

  useEffect(() => {
    if (session) {
      router.replace(nextUrl)
    }
  }, [session, router, nextUrl])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center app-shell">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center app-shell px-4 py-10">
      <div className="w-full max-w-md panel panel-glass rounded-2xl p-6 sm:p-8 text-center">
        <div className="relative w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-6 shadow-lg shadow-teal-500/30">
          <Image src="/logo-mark.svg" alt="DMED" fill className="object-contain" priority />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">DMED Letters</h1>
        <p className="text-slate-300/80 mb-8">
          {'\u0412\u043e\u0439\u0434\u0438\u0442\u0435, \u0447\u0442\u043e\u0431\u044b \u0440\u0430\u0431\u043e\u0442\u0430\u0442\u044c \u0441 \u043f\u0438\u0441\u044c\u043c\u0430\u043c\u0438, \u043e\u0442\u0447\u0451\u0442\u0430\u043c\u0438 \u0438 \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u0435\u043c \u0438\u0441\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u044f.'}
        </p>

        <button
          onClick={() => signIn('google', { callbackUrl: nextUrl })}
          className="inline-flex items-center justify-center gap-3 px-6 py-3 btn-primary rounded-lg w-full"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {'\u0412\u043e\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 Google'}
        </button>

        <p className="mt-6 text-xs text-slate-400/80">
          {'\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 \u0440\u0430\u0431\u043e\u0447\u0438\u0439 \u0430\u043a\u043a\u0430\u0443\u043d\u0442 DMED. \u041d\u0443\u0436\u0435\u043d \u0434\u043e\u0441\u0442\u0443\u043f? \u041e\u0431\u0440\u0430\u0442\u0438\u0442\u0435\u0441\u044c \u043a \u0430\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u0443.'}
        </p>
      </div>
    </div>
  )
}

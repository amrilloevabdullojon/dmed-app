'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ReactNode, useEffect } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ToastWrapper } from '@/components/Toast'
import { TRPCProvider } from '@/lib/trpc'
import { installCsrfFetch } from '@/lib/csrf-client'
import { useLocalStorage } from '@/hooks/useLocalStorage'

installCsrfFetch()

export function Providers({ children }: { children: ReactNode }) {
  const [newYearVibe] = useLocalStorage<boolean>('new-year-vibe', false)

  useEffect(() => {
    const root = document.documentElement
    if (newYearVibe) {
      root.classList.add('new-year')
    } else {
      root.classList.remove('new-year')
    }
  }, [newYearVibe])

  return (
    <TRPCProvider>
      <SessionProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <ToastWrapper>{children}</ToastWrapper>
          </ErrorBoundary>
        </ThemeProvider>
      </SessionProvider>
    </TRPCProvider>
  )
}

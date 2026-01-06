'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ReactNode } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ToastWrapper } from '@/components/Toast'
import { QueryProvider } from '@/lib/react-query'
import { installCsrfFetch } from '@/lib/csrf-client'

installCsrfFetch()

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <SessionProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <ToastWrapper>{children}</ToastWrapper>
          </ErrorBoundary>
        </ThemeProvider>
      </SessionProvider>
    </QueryProvider>
  )
}

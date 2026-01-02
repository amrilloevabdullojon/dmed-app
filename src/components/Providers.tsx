'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useState } from 'react'
import { Toaster } from 'sonner'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 минута
            gcTime: 5 * 60 * 1000, // 5 минут (было cacheTime)
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <Toaster
            position="bottom-right"
            theme="dark"
            richColors
            closeButton
            toastOptions={{
              duration: 4000,
              classNames: {
                toast: 'bg-gray-800 border-gray-700',
                title: 'text-white',
                description: 'text-gray-400',
              },
            }}
          />
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}

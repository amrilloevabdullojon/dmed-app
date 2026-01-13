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

type PersonalizationSettings = {
  backgroundAnimations?: boolean
  wallpaperStyle?: 'aurora' | 'nebula' | 'glow'
  wallpaperIntensity?: number
}

export function Providers({ children }: { children: ReactNode }) {
  const [newYearVibe] = useLocalStorage<boolean>('new-year-vibe', false)
  const [personalization] = useLocalStorage<PersonalizationSettings>('personalization-settings', {
    backgroundAnimations: true,
    wallpaperStyle: 'aurora',
    wallpaperIntensity: 60,
  })
  const backgroundAnimations = personalization?.backgroundAnimations ?? true
  const wallpaperStyle = personalization?.wallpaperStyle ?? 'aurora'
  const wallpaperIntensity =
    typeof personalization?.wallpaperIntensity === 'number'
      ? personalization.wallpaperIntensity
      : 60

  useEffect(() => {
    const root = document.documentElement
    if (newYearVibe) {
      root.classList.add('new-year')
    } else {
      root.classList.remove('new-year')
    }
  }, [newYearVibe])

  useEffect(() => {
    const root = document.documentElement
    if (!backgroundAnimations) {
      root.classList.add('no-bg-animations')
    } else {
      root.classList.remove('no-bg-animations')
    }
  }, [backgroundAnimations])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.wallpaperStyle = wallpaperStyle
  }, [wallpaperStyle])

  useEffect(() => {
    const root = document.documentElement
    const clamped = Math.min(100, Math.max(0, wallpaperIntensity))
    root.style.setProperty('--wallpaper-opacity', (clamped / 100).toFixed(2))
  }, [wallpaperIntensity])

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

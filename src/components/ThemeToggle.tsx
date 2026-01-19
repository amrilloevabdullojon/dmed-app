'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { hapticLight } from '@/lib/haptic'

type ThemeMode = 'LIGHT' | 'DARK' | 'AUTO'

export function ThemeToggle() {
  const { preferences, setPreferences } = useUserPreferences()
  const [prefersDark, setPrefersDark] = useState(false)

  const theme = useMemo<ThemeMode>(() => preferences?.theme ?? 'DARK', [preferences?.theme])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setPrefersDark(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const isDark = theme === 'DARK' || (theme === 'AUTO' && prefersDark)

  const toggleTheme = async () => {
    const nextTheme: ThemeMode = isDark ? 'LIGHT' : 'DARK'
    if (!preferences) {
      return
    }

    const previous = preferences
    setPreferences({ ...preferences, theme: nextTheme })

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: nextTheme }),
      })
      if (!response.ok) {
        throw new Error('Failed to update theme')
      }
    } catch {
      setPreferences(previous)
    }
  }

  return (
    <button
      onClick={() => {
        hapticLight()
        toggleTheme()
      }}
      className="tap-highlight app-icon-button p-2"
      title={isDark ? 'Dark theme' : 'Light theme'}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}

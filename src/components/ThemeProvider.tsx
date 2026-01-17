'use client'

import { useEffect } from 'react'
import { useUserPreferences } from '@/hooks/useUserPreferences'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { preferences } = useUserPreferences()

  useEffect(() => {
    const updateTheme = () => {
      const root = document.documentElement
      const theme = preferences?.theme || 'DARK'

      // Удаляем все классы темы
      root.classList.remove('light', 'dark')

      if (theme === 'AUTO') {
        // Используем системную тему
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.classList.add(prefersDark ? 'dark' : 'light')
      } else {
        // Применяем выбранную тему
        root.classList.add(theme.toLowerCase())
      }
    }

    updateTheme()

    // Слушаем изменения системной темы для AUTO режима
    if (preferences?.theme === 'AUTO') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => updateTheme()

      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }
  }, [preferences?.theme])

  return <>{children}</>
}

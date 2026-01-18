import { useState, useEffect } from 'react'

interface UserPreferences {
  id: string
  userId: string
  theme: 'LIGHT' | 'DARK' | 'AUTO'
  language: string
  density: 'COMPACT' | 'COMFORTABLE' | 'SPACIOUS'
  animations: boolean
  backgroundAnimations: boolean
  pageTransitions: boolean
  microInteractions: boolean
  listAnimations: boolean
  modalAnimations: boolean
  scrollAnimations: boolean
  wallpaperStyle: 'AURORA' | 'NEBULA' | 'GLOW' | 'COSMIC'
  wallpaperIntensity: number
  snowfall: boolean
  particles: boolean
  soundNotifications: boolean
  desktopNotifications: boolean
  createdAt: string
  updatedAt: string
}

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function loadPreferences() {
      try {
        const response = await fetch('/api/user/preferences')
        if (response.ok) {
          const data = await response.json()
          setPreferences(data)
        } else if (response.status === 401) {
          // User not authenticated, use defaults
          setPreferences(null)
        } else {
          throw new Error('Failed to load preferences')
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        setIsLoading(false)
      }
    }

    loadPreferences()
  }, [])

  return { preferences, isLoading, error }
}

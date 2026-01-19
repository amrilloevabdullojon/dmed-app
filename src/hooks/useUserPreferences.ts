import { useCallback, useEffect, useState } from 'react'

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

type PreferencesState = {
  preferences: UserPreferences | null
  isLoading: boolean
  error: Error | null
}

let cachedPreferences: UserPreferences | null = null
let cachedError: Error | null = null
let inFlight: Promise<UserPreferences | null> | null = null
let hasLoaded = false

const listeners = new Set<(state: PreferencesState) => void>()

const getState = (): PreferencesState => ({
  preferences: cachedPreferences,
  isLoading: Boolean(inFlight) || (!hasLoaded && !cachedError),
  error: cachedError,
})

const notify = () => {
  const state = getState()
  listeners.forEach((listener) => listener(state))
}

async function loadPreferences(): Promise<UserPreferences | null> {
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const response = await fetch('/api/user/preferences', { cache: 'no-store' })
      if (response.ok) {
        const data = (await response.json()) as UserPreferences
        cachedPreferences = data
        cachedError = null
        hasLoaded = true
        return data
      }
      if (response.status === 401) {
        cachedPreferences = null
        cachedError = null
        hasLoaded = true
        return null
      }
      throw new Error('Failed to load preferences')
    } catch (error) {
      cachedError = error instanceof Error ? error : new Error('Unknown error')
      hasLoaded = true
      throw cachedError
    } finally {
      inFlight = null
      notify()
    }
  })()

  notify()
  return inFlight
}

export function useUserPreferences() {
  const [state, setState] = useState<PreferencesState>(getState)

  useEffect(() => {
    const listener = (nextState: PreferencesState) => setState(nextState)
    listeners.add(listener)

    if (!hasLoaded && !inFlight) {
      loadPreferences().catch(() => undefined)
    }

    return () => {
      listeners.delete(listener)
    }
  }, [])

  const refresh = useCallback(async () => {
    await loadPreferences().catch(() => undefined)
  }, [])

  const setPreferences = useCallback((next: UserPreferences | null) => {
    cachedPreferences = next
    cachedError = null
    hasLoaded = true
    notify()
  }, [])

  return { ...state, refresh, setPreferences }
}

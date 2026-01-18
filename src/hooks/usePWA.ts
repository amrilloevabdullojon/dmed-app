'use client'

import { useEffect, useState, useCallback } from 'react'

export interface PWAStatus {
  isInstalled: boolean
  isUpdateAvailable: boolean
  isOnline: boolean
  registration: ServiceWorkerRegistration | null
}

export function usePWA() {
  const [status, setStatus] = useState<PWAStatus>({
    isInstalled: false,
    isUpdateAvailable: false,
    isOnline: true,
    registration: null,
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    // Check if installed
    const checkInstalled = () => {
      const isInstalled =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone ||
        document.referrer.includes('android-app://')

      setStatus((prev) => ({ ...prev, isInstalled }))
    }

    checkInstalled()

    // Register service worker
    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        console.log('[PWA] Service Worker registered:', registration)

        setStatus((prev) => ({ ...prev, registration }))

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing

          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                console.log('[PWA] New service worker available')
                setStatus((prev) => ({ ...prev, isUpdateAvailable: true }))
              }
            })
          }
        })

        // Check for updates every hour
        setInterval(
          () => {
            registration.update()
          },
          60 * 60 * 1000
        )
      } catch (error) {
        console.error('[PWA] Service Worker registration failed:', error)
      }
    }

    registerServiceWorker()

    // Listen for online/offline
    const handleOnline = () => setStatus((prev) => ({ ...prev, isOnline: true }))
    const handleOffline = () => setStatus((prev) => ({ ...prev, isOnline: false }))

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Listen for controller change
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA] Controller changed, reloading page')
      window.location.reload()
    })

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const updateServiceWorker = useCallback(() => {
    if (status.registration?.waiting) {
      status.registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    }
  }, [status.registration])

  const unregisterServiceWorker = useCallback(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration) {
      await registration.unregister()
      console.log('[PWA] Service Worker unregistered')
      setStatus((prev) => ({ ...prev, registration: null }))
    }
  }, [])

  const cacheUrls = useCallback(
    async (urls: string[]) => {
      if (status.registration?.active) {
        status.registration.active.postMessage({
          type: 'CACHE_URLS',
          urls,
        })
      }
    },
    [status.registration]
  )

  const clearCache = useCallback(async () => {
    if (status.registration?.active) {
      status.registration.active.postMessage({ type: 'CLEAR_CACHE' })
    }
  }, [status.registration])

  return {
    ...status,
    updateServiceWorker,
    unregisterServiceWorker,
    cacheUrls,
    clearCache,
  }
}

/**
 * Hook для запроса push уведомлений
 */
export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return
    }

    setPermission(Notification.permission)
  }, [])

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('[PWA] Notifications not supported')
      return false
    }

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result === 'granted'
    } catch (error) {
      console.error('[PWA] Permission request failed:', error)
      return false
    }
  }, [])

  const subscribe = useCallback(
    async (vapidPublicKey: string) => {
      try {
        const registration = await navigator.serviceWorker.ready

        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })

        setSubscription(sub)
        console.log('[PWA] Push subscription:', sub)
        return sub
      } catch (error) {
        console.error('[PWA] Push subscription failed:', error)
        return null
      }
    },
    []
  )

  const unsubscribe = useCallback(async () => {
    if (subscription) {
      await subscription.unsubscribe()
      setSubscription(null)
      console.log('[PWA] Push unsubscribed')
    }
  }, [subscription])

  return {
    permission,
    subscription,
    requestPermission,
    subscribe,
    unsubscribe,
  }
}

// Helper function
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

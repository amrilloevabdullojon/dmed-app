import { useCallback, useEffect, useState } from 'react'

interface PushSubscriptionState {
  subscription: PushSubscription | null
  isSupported: boolean
  isSubscribed: boolean
  isLoading: boolean
  error: string | null
}

const urlBase64ToUint8Array = (base64String: string): BufferSource => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer
}

export const usePushNotifications = () => {
  const [state, setState] = useState<PushSubscriptionState>({
    subscription: null,
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    error: null,
  })

  const checkSupport = useCallback(() => {
    if (typeof window === 'undefined') return false
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  }, [])

  const checkPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!checkSupport()) return 'denied'
    return Notification.permission
  }, [checkSupport])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!checkSupport()) {
      setState((prev) => ({ ...prev, error: 'Push notifications not supported' }))
      return false
    }

    try {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      setState((prev) => ({
        ...prev,
        error: 'Failed to request notification permission',
      }))
      return false
    }
  }, [checkSupport])

  const subscribeToPush = useCallback(async (): Promise<PushSubscription | null> => {
    if (!checkSupport()) return null

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const registration = await navigator.serviceWorker.ready
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

      if (!vapidPublicKey) {
        throw new Error('VAPID public key not configured')
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })

      if (!response.ok) {
        throw new Error('Failed to save subscription on server')
      }

      setState((prev) => ({
        ...prev,
        subscription,
        isSubscribed: true,
        isLoading: false,
      }))

      return subscription
    } catch (error) {
      console.error('Error subscribing to push:', error)
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to subscribe',
        isLoading: false,
      }))
      return null
    }
  }, [checkSupport])

  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    if (!state.subscription) return false

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      await state.subscription.unsubscribe()

      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: state.subscription.endpoint }),
      })

      setState((prev) => ({
        ...prev,
        subscription: null,
        isSubscribed: false,
        isLoading: false,
      }))

      return true
    } catch (error) {
      console.error('Error unsubscribing from push:', error)
      setState((prev) => ({
        ...prev,
        error: 'Failed to unsubscribe',
        isLoading: false,
      }))
      return false
    }
  }, [state.subscription])

  const checkExistingSubscription = useCallback(async () => {
    if (!checkSupport()) {
      setState({
        subscription: null,
        isSupported: false,
        isSubscribed: false,
        isLoading: false,
        error: null,
      })
      return
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      setState({
        subscription,
        isSupported: true,
        isSubscribed: !!subscription,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      console.error('Error checking subscription:', error)
      setState({
        subscription: null,
        isSupported: true,
        isSubscribed: false,
        isLoading: false,
        error: 'Failed to check subscription status',
      })
    }
  }, [checkSupport])

  useEffect(() => {
    checkExistingSubscription()
  }, [checkExistingSubscription])

  return {
    ...state,
    requestPermission,
    subscribeToPush,
    unsubscribeFromPush,
    checkPermission,
  }
}

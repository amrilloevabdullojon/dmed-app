// Service Worker for DMED Letters
const CACHE_NAME = 'dmed-letters-v2'
const STATIC_ASSETS = [
  '/favicon.ico',
  '/favicon.svg',
  '/apple-touch-icon.svg',
  '/manifest.webmanifest',
  '/logo-mark.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.filter((name) => name != CACHE_NAME).map((name) => caches.delete(name))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return
  if (!request.url.startsWith('http')) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request))
    return
  }

  if (request.url.includes('/api/')) {
    event.respondWith(fetch(request))
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
    })
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Push Notifications
self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const data = event.data.json()
    const { title, body, icon, badge, tag, data: notificationData } = data

    const options = {
      body: body || '',
      icon: icon || '/logo-mark.svg',
      badge: badge || '/favicon.svg',
      tag: tag || 'notification',
      data: notificationData || {},
      requireInteraction: notificationData?.priority === 'high',
      vibrate: notificationData?.priority === 'high' ? [200, 100, 200] : [100],
      actions: [
        {
          action: 'open',
          title: 'Открыть',
        },
        {
          action: 'dismiss',
          title: 'Закрыть',
        },
      ],
    }

    event.waitUntil(self.registration.showNotification(title, options))
  } catch (error) {
    console.error('Error showing notification:', error)
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') {
    return
  }

  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen)
      }
    })
  )
})

self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('Push subscription changed')
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription.options)
      .then((subscription) => {
        console.log('Resubscribed:', subscription)
        return fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription),
        })
      })
  )
})

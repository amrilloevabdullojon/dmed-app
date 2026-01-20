// Service Worker for DMED Letters
const CACHE_NAME = 'dmed-letters-v3'
const STATIC_ASSETS = [
  '/favicon.svg',
  '/apple-touch-icon.svg',
  '/manifest.json',
  '/logo-mark.svg',
  '/offline.html',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
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
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/offline.html').then((response) => response || new Response('Offline'))
      )
    )
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
    self.registration.pushManager.subscribe(event.oldSubscription.options).then((subscription) => {
      console.log('Resubscribed:', subscription)
      return fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })
    })
  )
})

// Background Sync для offline операций
const SYNC_TAGS = {
  COMMENT_SYNC: 'comment-sync',
  STATUS_UPDATE_SYNC: 'status-update-sync',
  ASSIGNMENT_SYNC: 'assignment-sync',
}

self.addEventListener('sync', (event) => {
  console.log('Background sync event:', event.tag)

  if (event.tag === SYNC_TAGS.COMMENT_SYNC) {
    event.waitUntil(syncComments())
  } else if (event.tag === SYNC_TAGS.STATUS_UPDATE_SYNC) {
    event.waitUntil(syncStatusUpdates())
  } else if (event.tag === SYNC_TAGS.ASSIGNMENT_SYNC) {
    event.waitUntil(syncAssignments())
  }
})

async function syncComments() {
  try {
    const db = await openDB()
    const pendingComments = await db.getAll('pendingComments')

    for (const comment of pendingComments) {
      try {
        const response = await fetch(`/api/letters/${comment.letterId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: comment.text }),
        })

        if (response.ok) {
          await db.delete('pendingComments', comment.id)
          await notifyClient({ type: 'comment-synced', comment })
        }
      } catch (error) {
        console.error('Failed to sync comment:', error)
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error)
  }
}

async function syncStatusUpdates() {
  try {
    const db = await openDB()
    const pendingUpdates = await db.getAll('pendingStatusUpdates')

    for (const update of pendingUpdates) {
      try {
        const response = await fetch(`/api/letters/${update.letterId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: update.status }),
        })

        if (response.ok) {
          await db.delete('pendingStatusUpdates', update.id)
          await notifyClient({ type: 'status-synced', update })
        }
      } catch (error) {
        console.error('Failed to sync status update:', error)
      }
    }
  } catch (error) {
    console.error('Status sync failed:', error)
  }
}

async function syncAssignments() {
  try {
    const db = await openDB()
    const pendingAssignments = await db.getAll('pendingAssignments')

    for (const assignment of pendingAssignments) {
      try {
        const response = await fetch(`/api/letters/${assignment.letterId}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: assignment.userId }),
        })

        if (response.ok) {
          await db.delete('pendingAssignments', assignment.id)
          await notifyClient({ type: 'assignment-synced', assignment })
        }
      } catch (error) {
        console.error('Failed to sync assignment:', error)
      }
    }
  } catch (error) {
    console.error('Assignment sync failed:', error)
  }
}

async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('dmed-offline', 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      if (!db.objectStoreNames.contains('pendingComments')) {
        db.createObjectStore('pendingComments', { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains('pendingStatusUpdates')) {
        db.createObjectStore('pendingStatusUpdates', { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains('pendingAssignments')) {
        db.createObjectStore('pendingAssignments', { keyPath: 'id', autoIncrement: true })
      }
    }
  })
}

async function notifyClient(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  clients.forEach((client) => client.postMessage(message))
}

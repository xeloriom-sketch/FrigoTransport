// ============================================================
// FrigoTransport Service Worker — GPS Background + Cache
// ============================================================

const CACHE = 'frigotransport-v2'
const GPS_QUEUE_KEY = 'gps-queue'

// ── Installation ─────────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// ── Cache réseau-first ────────────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match(e.request))
  )
})

// ── Messages depuis le client ─────────────────────────────────
self.addEventListener('message', async e => {
  const { type, payload } = e.data || {}

  // Forcer mise à jour
  if (type === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }

  // GPS point reçu → notif + sauvegarde en queue
  if (type === 'GPS_POINT') {
    await enqueueGPS(payload)
    await triggerSync()
    updateNotification(payload)
    return
  }

  // Démarrage GPS → afficher notification persistante
  if (type === 'GPS_START') {
    const { truckName, workerName } = payload
    await showGPSNotification(truckName, workerName)
    return
  }

  // Arrêt GPS → supprimer notification
  if (type === 'GPS_STOP') {
    await self.registration.getNotifications({ tag: 'gps-active' })
      .then(notifs => notifs.forEach(n => n.close()))
    return
  }
})

// ── Background Sync — envoyer les points GPS en attente ───────
self.addEventListener('sync', async e => {
  if (e.tag === 'gps-sync') {
    e.waitUntil(flushGPSQueue())
  }
})

// ── Periodic Background Sync (Android Chrome) ────────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'gps-periodic') {
    e.waitUntil(flushGPSQueue())
  }
})

// ── Notification click → ouvre l'app ─────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        if (clients.length > 0) return clients[0].focus()
        return self.clients.openWindow('/FrigoTransport/worker/')
      })
  )
})

// ── Helpers ───────────────────────────────────────────────────

async function showGPSNotification(truckName, workerName) {
  if (self.registration.showNotification) {
    const notifs = await self.registration.getNotifications({ tag: 'gps-active' })
    notifs.forEach(n => n.close())
    await self.registration.showNotification('FrigoTransport — GPS actif', {
      body: `${workerName} · ${truckName} · En service`,
      tag: 'gps-active',
      renotify: false,
      silent: true,
      requireInteraction: true,  // Reste visible, ne disparaît pas
      icon: '/FrigoTransport/icon-192.png',
      badge: '/FrigoTransport/icon-192.png',
      data: { url: '/FrigoTransport/worker/' },
      actions: [
        { action: 'open', title: 'Ouvrir' }
      ]
    })
  }
}

async function updateNotification(pos) {
  const notifs = await self.registration.getNotifications({ tag: 'gps-active' })
  if (notifs.length === 0) return
  const n = notifs[0]
  const speed = pos.speed != null ? ` · ${Math.round(pos.speed * 3.6)} km/h` : ''
  await self.registration.showNotification('FrigoTransport — GPS actif', {
    body: `${n.body.split('·')[0].trim()}${speed} · ${timeAgo(pos.recorded_at)}`,
    tag: 'gps-active',
    renotify: false,
    silent: true,
    requireInteraction: true,
    icon: '/FrigoTransport/icon-192.png',
    badge: '/FrigoTransport/icon-192.png',
    data: { url: '/FrigoTransport/worker/' },
  })
}

// File d'attente IndexedDB (offline)
async function enqueueGPS(point) {
  try {
    const db = await openDB()
    const tx = db.transaction('queue', 'readwrite')
    tx.objectStore('queue').add({ ...point, queued_at: Date.now() })
    await new Promise((ok, err) => { tx.oncomplete = ok; tx.onerror = err })
  } catch {}
}

async function flushGPSQueue() {
  try {
    const db = await openDB()
    const tx = db.transaction('queue', 'readonly')
    const items = await getAllItems(tx.objectStore('queue'))
    if (items.length === 0) return

    // Récupérer les config Supabase depuis le cache
    const config = await getConfig()
    if (!config) return

    for (const item of items) {
      try {
        const res = await fetch(`${config.url}/rest/v1/locations`, {
          method: 'POST',
          headers: {
            'apikey': config.key,
            'Authorization': `Bearer ${config.token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            assignment_id: item.assignment_id,
            truck_id: item.truck_id,
            worker_id: item.worker_id,
            latitude: item.latitude,
            longitude: item.longitude,
            accuracy: item.accuracy,
            speed: item.speed,
            heading: item.heading,
          }),
        })
        if (res.ok) {
          const delTx = db.transaction('queue', 'readwrite')
          delTx.objectStore('queue').delete(item.id)
        }
      } catch {}
    }
  } catch {}
}

async function triggerSync() {
  try {
    await self.registration.sync?.register('gps-sync')
  } catch {}
}

// IndexedDB helpers
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('frigo-gps', 2)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('queue')) {
        const store = db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
        store.createIndex('assignment_id', 'assignment_id', { unique: false })
      }
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'id' })
      }
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = reject
  })
}

function getAllItems(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror   = reject
  })
}

async function getConfig() {
  try {
    const db = await openDB()
    const tx = db.transaction('config', 'readonly')
    return await new Promise((resolve, reject) => {
      const req = tx.objectStore('config').get('supabase')
      req.onsuccess = () => resolve(req.result)
      req.onerror   = reject
    })
  } catch { return null }
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `${m}min`
  return `${Math.floor(m / 60)}h`
}

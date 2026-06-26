// Service Worker FrigoTransport — gestion cache + notifications de mise à jour
const CACHE = 'frigotransport-v1'

// Installation : met en cache les ressources essentielles
self.addEventListener('install', e => {
  self.skipWaiting()
})

// Activation : nettoie les anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Fetch : réseau en priorité, cache en fallback
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

// Message "SKIP_WAITING" depuis le client → force la mise à jour
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting()
})

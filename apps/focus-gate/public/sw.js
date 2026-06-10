const CACHE = 'focus-gate-v2'
const SKIP = ['/api/', '/auth/', 'supabase.co', 'googleapis.com']

self.addEventListener('install', () => self.skipWaiting())

// Take over open pages and drop caches left behind by older SW versions.
self.addEventListener('activate', e =>
  e.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
)

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  if (SKIP.some(p => req.url.includes(p))) return

  e.respondWith(
    fetch(req)
      .then(res => {
        // Cache only good same-origin responses — no errors, no opaque cross-origin bodies.
        if (res.ok && new URL(req.url).origin === self.location.origin) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(req, clone))
        }
        return res
      })
      // Offline: serve from cache, or a proper network error — never resolve undefined.
      .catch(() => caches.match(req).then(r => r ?? Response.error()))
  )
})

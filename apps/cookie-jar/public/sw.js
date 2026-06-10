const CACHE = 'cookie-jar-v2'
const SKIP = ['/api/', '/auth/', 'supabase.co', 'googleapis.com']

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e =>
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
)

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  if (SKIP.some(p => e.request.url.includes(p))) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // only cache good same-origin responses — never errors or opaque cross-origin bodies
        if (res.ok && new URL(e.request.url).origin === self.location.origin) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match(e.request).then(r => r ?? Response.error()))
  )
})

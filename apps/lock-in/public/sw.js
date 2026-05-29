const CACHE = 'lock-in-v1'
const SKIP = ['/api/', 'supabase.co', 'googleapis.com']

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  if (SKIP.some(p => e.request.url.includes(p))) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return res
      })
      .catch(() => caches.match(e.request))
  )
})

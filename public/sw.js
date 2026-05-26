// Minimal service worker so the app is installable as a PWA.
// Intentionally cache-less for v1 — Vercel CDN is fast enough that offline
// support hasn't been a felt need yet. When it becomes one, replace this
// with serwist or a hand-tuned cache strategy.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Pass-through. Browsers only consider the app installable when the SW
  // is registered AND has a fetch handler, even if the handler is a no-op.
});

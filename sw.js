// NEON POS — sw.js (Service Worker)
const CACHE_NAME    = 'neonpos-v1.0.0';
const RUNTIME_CACHE = 'neonpos-runtime-v1';
const PRECACHE_ASSETS = [
  './', './index.html', './style.css', './app.js', './manifest.json',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;800;900&family=Share+Tech+Mono&family=Exo+2:wght@300;400;500;600&display=swap',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(PRECACHE_ASSETS.map(url => cache.add(url).catch(e => console.warn('[SW] Skip:', url, e))))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;
  if (url.hostname.includes('firebaseio.com')) return;

  if (url.hostname === 'cdn.tailwindcss.com' || url.hostname === 'fonts.gstatic.com' ||
      url.hostname.includes('gstatic.com') || url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request)); return;
  }
  if (url.hostname === 'fonts.googleapis.com') {
    event.respondWith(staleWhileRevalidate(request)); return;
  }
  event.respondWith(networkFirst(request));
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) { const c = await caches.open(RUNTIME_CACHE); c.put(req, res.clone()); }
    return res;
  } catch { return new Response('Offline', { status: 503 }); }
}
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) { const c = await caches.open(RUNTIME_CACHE); c.put(req, res.clone()); }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    if (req.mode === 'navigate') { const shell = await caches.match('./index.html'); if (shell) return shell; }
    return new Response('Offline', { status: 503 });
  }
}
async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const netFetch = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => null);
  return cached || netFetch;
}

self.addEventListener('sync', event => {
  if (event.tag === 'sync-offline-sales') {
    event.waitUntil(
      self.clients.matchAll().then(clients =>
        clients.forEach(c => c.postMessage({ type: 'BACKGROUND_SYNC' }))
      )
    );
  }
});

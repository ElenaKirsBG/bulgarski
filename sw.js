/* Офлайн-режим: приложение целиком хранится на устройстве.
   При обновлении файлов на GitHub увеличьте номер версии ниже. */
const CACHE = 'bg-course-v13';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('message', e => { if (e.data === 'ver') e.source && e.source.postMessage({ ver: CACHE }); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
/* Сначала из памяти устройства (мгновенно и без интернета), параллельно — тихое обновление из сети. */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  const isPage = req.mode === 'navigate';
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(isPage ? './index.html' : req, { ignoreSearch: true });
    const net = fetch(isPage ? new Request('./index.html', { cache: 'no-cache' }) : new Request(req, { cache: 'no-cache' })).then(r => { if (r && r.ok) cache.put(isPage ? './index.html' : req, r.clone()); return r; }).catch(() => null);
    if (cached) { e.waitUntil(net); return cached; }
    const r = await net;
    return r || (isPage ? cache.match('./index.html') : new Response('', { status: 504 }));
  }));
});

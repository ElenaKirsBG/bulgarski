/* Офлайн-кэш. При обновлении файлов увеличьте номер версии. */
const CACHE = 'bg-course-v1';
const FILES = ['./', 'index.html', 'app.js', 'manifest.webmanifest',
  'data/course-1.js', 'data/course-2.js', 'data/course-3.js', 'data/course-4.js', 'data/grammar.js',
  'data/dict-1.js', 'data/dict-2.js', 'data/dict-3.js', 'data/dict-4.js', 'data/dict-5.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});

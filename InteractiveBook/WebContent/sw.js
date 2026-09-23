const CACHE_NAME = 'interactive-book-v13';
const ASSETS = [
  './app-shell.html',
  './index.html',
  './system-design-tpm.html',
  './mobile.css',
  './reader.js',
  './manifest.json',
  './tts.js',
  './progress.js',
  './ai-voice.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isHtml(request) {
  return request.mode === 'navigate' || (request.destination === 'document') || request.url.endsWith('.html');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (isHtml(event.request)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => cached);
    })
  );
});

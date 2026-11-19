/* ShuShu Service Worker — Offline-First PWA App Shell Cache */
const CACHE_NAME = 'shushu-cache-v11';

const APP_SHELL = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/favicon.png',
  '/public/manifest.json',
  '/public/images/calendar-bg.jpg',
  '/public/icons/logo-circle.png',
  '/public/icons/icon-192.png',
  '/public/icons/icon-512.png',
  '/src/css/variables.css',
  '/src/css/base.css',
  '/src/css/layout.css',
  '/src/css/modules.css',
  '/src/js/app.js',
  '/src/js/auth.js',
  '/src/js/utils.js',
  '/src/js/mock-data.js',
  '/src/js/storage.js',
  '/src/js/notifications.js',
  '/src/js/audio-engine.js',
  '/src/js/command-palette.js',
  '/src/js/focus-mode.js',
  '/src/js/modules/tasks.js',
  '/src/js/modules/dashboard.js',
  '/src/js/modules/reminders.js',
  '/src/js/modules/finance.js',
  '/src/js/modules/notes.js',
  '/src/js/modules/projects.js',
  '/src/js/modules/relax.js',
  '/src/js/modules/theme.js',
  '/src/js/modules/storage-settings.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ offline: true }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});

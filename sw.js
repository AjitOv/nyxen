// ============================================================================
// NYXEN — Progressive Web App Service Worker
// Offline resilience, instant launch caching, stale-while-revalidate strategy.
// ============================================================================

const CACHE_NAME = 'nyxen-ocean-v1.0.1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './src/math.js',
  './src/species.js',
  './src/fish_physics.js',
  './src/world.js',
  './src/renderer.js',
  './src/audio.js',
  './src/controls.js',
  './src/game.js',
  './src/royale.js'
];

// 1. Install Phase — Cache all local core resources
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline ocean assets...');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// 2. Activate Phase — Purge stale cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing legacy cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Phase — Stale-While-Revalidate with Offline Fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Ignore cross-origin telemetry or chrome-extension URLs
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Fetch fresh version in background to update cache
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and request is navigation, fallback to index.html
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });

      // Return cached immediately if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});

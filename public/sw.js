/**
 * BeBig 2.0 PWA Service Worker
 * Version: bebig-pwa-v1
 *
 * Conservative static app shell cache.
 * STRICT SECURITY INVARIANTS:
 * - NEVER caches Supabase API requests (cross-origin or /rest/ /auth/)
 * - NEVER caches authenticated requests (Authorization / apikey headers)
 * - NEVER caches private user data, workouts, templates, exercises, or sync records
 * - NEVER modifies or synchronizes offline mutations (IndexedDB handles persistence)
 * - NEVER force-reloads client pages (active workouts are never disrupted)
 */

const CACHE_NAME = 'bebig-pwa-v1';

// Minimal core assets precached on install
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        // Pre-cache failures should not abort installation
        console.warn('[SW] Precache item error:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key.startsWith('bebig-') && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 1. Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // 2. Only handle http / https requests
  if (!request.url.startsWith('http')) {
    return;
  }

  const url = new URL(request.url);

  // 3. SECURITY: Cross-origin requests (Supabase cloud, Wger API, external services)
  // must NEVER be intercepted or cached. Let browser handle directly via network.
  if (url.origin !== self.location.origin) {
    return;
  }

  // 4. SECURITY: Explicitly bypass any request containing authentication headers
  if (request.headers.has('authorization') || request.headers.has('apikey')) {
    return;
  }

  // 5. SECURITY: Bypass any internal API or sync endpoints
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/auth/')
  ) {
    return;
  }

  // 6. Navigation requests (HTML documents):
  // Network-First with cache fallback. Always attempt fresh HTML from server first
  // so deep routes and fresh builds stay current. Fall back to cached page or app shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Fallback to cached root index app shell
            return caches.match('/');
          });
        })
    );
    return;
  }

  // 7. Static Application Assets (JS bundles, CSS, icons, fonts):
  // Cache-First with network fallback. Content-hashed JS bundles and static assets
  // are safely loaded from cache first for instant mobile performance.
  const isStaticAsset =
    url.pathname.startsWith('/_expo/static/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ico)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 8. Default: Network-only for any other same-origin requests
  return;
});
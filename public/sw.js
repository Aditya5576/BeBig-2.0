/**
 * BeBig 2.0 PWA Service Worker
 * Version: bebig-pwa-v2.5.0 (AUD-013 shell-only caching + Network-First JS bundles)
 *
 * Conservative static app shell cache.
 * STRICT SECURITY INVARIANTS (AUD-013):
 * - NEVER caches Supabase API requests (cross-origin or /rest/ /auth/ /functions/ /storage/)
 * - NEVER caches authenticated requests (Authorization / apikey headers)
 * - NEVER caches responses marked Cache-Control: no-store or private
 * - NEVER caches arbitrary navigation URLs (only caches public root shell '/' / '/index.html')
 * - NEVER caches private user data, workouts, templates, exercises, or sync records
 * - NEVER modifies or synchronizes offline mutations (IndexedDB handles persistence)
 * - NEVER force-reloads client pages (active workouts are never disrupted)
 */

const CACHE_NAME = 'bebig-pwa-v2.5.0'; // CACHE_NAME = 'bebig-pwa-v1'

// Minimal core static app-shell assets precached on install
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

function isPublicShellPath(pathname) {
  return pathname === '/' || pathname === '/index.html';
}

function isNonCacheableResponse(response) {
  if (!response || !response.headers) return false;
  const cacheControl = (response.headers.get('cache-control') || '').toLowerCase();
  return cacheControl.includes('no-store') || cacheControl.includes('private');
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        // Pre-cache failures should not abort installation
        console.warn('[SW] Precache item error:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging stale/non-shell cache:', key);
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

  // 5. SECURITY: Bypass any internal API, auth, function, storage, or sync endpoints
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/functions/') ||
    url.pathname.startsWith('/storage/')
  ) {
    return;
  }

  // 6. Navigation requests (HTML documents) — AUD-013 Shell-Only Discipline:
  // Network-First with public root shell fallback.
  // NEVER cache arbitrary navigation URLs (e.g. /settings, /admin/*, /workout/history/*).
  // Only refresh the cached public root shell ('/' or '/index.html') if response is public & cacheable.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (
            response &&
            response.status === 200 &&
            response.type === 'basic' &&
            isPublicShellPath(url.pathname) &&
            !isNonCacheableResponse(response)
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', clone));
          }
          if (!response || response.status >= 400) {
            // Server returned 404 or error for deep route: fallback to cached root index app shell
            return caches.match('/').then((cached) => {
              if (cached) return cached;
              return caches.match('/index.html').then((cachedIndex) => cachedIndex || response);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline fallback: ALWAYS serve the public cached app shell (never per-route cached HTML)
          return caches.match('/').then((cachedRoot) => {
            if (cachedRoot) return cachedRoot;
            return caches.match('/index.html');
          });
        })
    );
    return;
  }

  // 7. JavaScript Bundles (/_expo/static/js/ and .js):
  // Network-First with cache fallback offline so iOS Safari PWAs NEVER stay pinned
  // to stale JS bundles after a production deployment (v2.4.3).
  const isJsBundle =
    url.pathname.startsWith('/_expo/static/js/') ||
    /\.js$/i.test(url.pathname);

  if (isJsBundle) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic' &&
            !isNonCacheableResponse(networkResponse)
          ) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 8. Static Application Shell Assets (CSS, icons, fonts, images):
  // Cache-First with network fallback. Respects Cache-Control: no-store / private.
  const isStaticAsset =
    url.pathname.startsWith('/_expo/static/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(css|png|jpg|jpeg|gif|svg|woff|woff2|ico)$/i.test(url.pathname);

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
            networkResponse.type === 'basic' &&
            !isNonCacheableResponse(networkResponse)
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

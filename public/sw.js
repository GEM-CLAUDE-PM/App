/**
 * sw.js — GEM&CLAUDE PM Pro Service Worker
 * Đặt tại: /public/sw.js
 *
 * Features:
 *   - Cache-first cho static assets (shell caching)
 *   - Network-first cho API calls
 *   - Offline fallback page
 *   - Background Sync cho offline queue
 *   - Push notification (FCM via Zalo/Firebase)
 *   - SKIP_WAITING message handler
 */

const CACHE_NAME    = 'gem-pm-v2';
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── Install — pre-cache shell ─────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  // Take control immediately khi có SKIP_WAITING message
  self.skipWaiting();
});

// ── Activate — clean old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch — strategy by request type ─────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin (Supabase, Gemini API)
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // API calls — network-first, fallback offline.html nếu navigate
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        request.mode === 'navigate'
          ? caches.match('/offline.html')
          : new Response(JSON.stringify({ error: 'offline' }), {
              headers: { 'Content-Type': 'application/json' },
            })
      )
    );
    return;
  }

  // SPA navigation — network-first, fallback index.html (SPA routing)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html').then(r => r ?? caches.match('/offline.html'))
      )
    );
    return;
  }

  // Static assets — cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        // Cache JS/CSS/image assets
        if (
          response.ok &&
          (url.pathname.endsWith('.js') ||
           url.pathname.endsWith('.css') ||
           url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?)$/))
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return response;
      }).catch(() => caches.match('/offline.html'));
    })
  );
});

// ── Background Sync — flush offline queue khi có mạng ────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'gem-offline-sync') {
    event.waitUntil(
      // Notify all clients để trigger OfflineQueue.processQueue()
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client =>
          client.postMessage({ type: 'SYNC_QUEUE' })
        );
      })
    );
  }
});

// ── Push Notification (FCM) ───────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'GEM PM Pro', body: event.data.text() };
  }

  const options = {
    body:    payload.body   ?? '',
    icon:    payload.icon   ?? '/icons/icon-192.png',
    badge:   '/icons/icon-72.png',
    tag:     payload.tag    ?? 'gem-notif',
    data:    payload.data   ?? {},
    actions: payload.actions ?? [],
    vibrate: [100, 50, 100],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'GEM PM Pro', options)
  );
});

// ── Notification click — navigate to relevant tab ────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { tab, sub } = event.notification.data ?? {};
  const targetUrl = tab
    ? `${self.location.origin}?tab=${tab}${sub ? `&sub=${sub}` : ''}`
    : self.location.origin;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        const existing = clients.find(c => c.url.startsWith(self.location.origin));
        if (existing) {
          existing.focus();
          existing.postMessage({ type: 'NAVIGATE', tab, sub });
        } else {
          self.clients.openWindow(targetUrl);
        }
      })
  );
});

// ── Message handler (từ app) ─────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'REGISTER_SYNC') {
    self.registration.sync?.register('gem-offline-sync').catch(() => {});
  }
});

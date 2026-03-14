/**
 * sw.js — GEM&CLAUDE PM Pro Service Worker
 * Strategy: Cache-first for assets, Network-first for API calls.
 * Offline fallback page for navigation requests.
 *
 * SETUP: Place this file in /public/sw.js
 * It is registered automatically by usePWA.ts hook.
 */

const CACHE_VERSION = 'gem-pm-v1';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const API_CACHE     = `${CACHE_VERSION}-api`;

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('[SW] Pre-cache partial failure:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('gem-pm-') && key !== STATIC_CACHE && key !== API_CACHE)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin (Supabase API, Gemini API)
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Navigation requests → Network first, fallback to /index.html (SPA routing)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(c => c.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match('/index.html').then(cached => cached || caches.match('/offline.html'))
        )
    );
    return;
  }

  // JS/CSS/fonts/images → Cache first, network fallback
  if (
    url.pathname.match(/\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|ico|webp)$/)
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(c => c.put(request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 408, statusText: 'Offline' }));
      })
    );
    return;
  }

  // Default: network only (API calls handled by app-level offline queue)
});

// ─── Background Sync ──────────────────────────────────────────────────────────
// Triggered when connectivity returns — processes offline queue from IndexedDB
self.addEventListener('sync', (event) => {
  if (event.tag === 'gem-offline-sync') {
    event.waitUntil(processOfflineQueue());
  }
});

async function processOfflineQueue() {
  console.log('[SW] Processing offline queue...');
  // The actual queue processing is done in offlineQueue.ts (IndexedDB)
  // SW just signals to the app via postMessage
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_QUEUE', ts: Date.now() });
  });
}

// ─── Push Notifications (Phase 6 — Zalo OA) ──────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { return; }

  const options = {
    body:    data.body    || 'Có thông báo mới từ GEM PM Pro',
    icon:    data.icon    || '/icons/icon-192.png',
    badge:   data.badge   || '/icons/icon-72.png',
    tag:     data.tag     || 'gem-notif',
    renotify: true,
    data:    { url: data.url || '/' },
    actions: data.actions || [
      { action: 'open',    title: 'Mở ứng dụng' },
      { action: 'dismiss', title: 'Bỏ qua' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'GEM PM Pro', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.navigate(url); }
      else self.clients.openWindow(url);
    })
  );
});

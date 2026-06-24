// ══════════════════════════════════════════════
//  BigHero PS — Service Worker v1.4.1
// ══════════════════════════════════════════════

const CACHE_NAME = 'bighero-ps-v1.4.1';

// Asset yang di-cache untuk offline
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32x32.png',
  // Google Fonts (akan di-cache saat pertama load)
];

// External assets yang boleh di-cache (fonts, Firebase SDK)
const CACHE_ALLOWLIST = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.gstatic.com',        // Firebase JS SDK
];

// ── INSTALL ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching assets');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ── (hapus cache lama)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Jangan cache Firebase Firestore requests (butuh realtime)
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.pathname.includes('firestore')) {
    return; // Biarkan network langsung
  }

  // Strategy: Network First untuk index.html (selalu fresh)
  if (url.pathname === '/' || url.pathname.endsWith('index.html')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Strategy: Cache First untuk fonts & icons
  const isAllowed = CACHE_ALLOWLIST.some(h => url.hostname.includes(h));
  if (isAllowed || event.request.destination === 'image' || event.request.destination === 'font') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (!res || res.status !== 200) return res;
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Default: Network with cache fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// ── PUSH NOTIFICATION (opsional, untuk masa depan) ──
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'BigHero PS';
  const options = {
    body: data.body || 'Ada notifikasi baru',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-96x96.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || './' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || './')
  );
});

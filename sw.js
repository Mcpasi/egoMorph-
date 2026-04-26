// Service Worker fuer PWABuilder/Android: cached die Shell, liefert
// Navigationen offline aus und aktualisiert alte Caches kontrolliert.
const CACHE_NAME = 'egomorph-pwa-v2';
const URLS_TO_CACHE = [
  './',
  'index.html',
  'manifest.json',
  'style.css',
  'load-screen.css',
  'loader.js',
  'resourceProfile.js',
  'vectorizeEmotion.js',
  'emotionModel.js',
  'Safetyfilter.js',
  'chatModel.js',
  'ltmManager.js',
  'ego_settings.js',
  'thinkingMode.js',
  'ego_icon_192.png',
  'ego_icon_512.png',
  'logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request).then(networkResponse => {
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return networkResponse;
      }))
  );
});

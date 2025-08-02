// A simple service worker to enable offline capabilities for EgoMorph.
// The service worker caches core assets so the web app can load
// even without a network connection.  When fetching resources, it
// attempts to serve cached content first and falls back to the
// network if the resource is not in the cache.

const CACHE_NAME = 'egomorph-cache-v1';
const URLS_TO_CACHE = [
  './',
  'index (2) (2) (1).html',
  'manifest.json',
  'ego_icon_192.png',
  'ego_icon_512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
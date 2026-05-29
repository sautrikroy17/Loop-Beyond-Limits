/**
 * Loop Service Worker — Cache Buster
 * This SW immediately clears all old caches and unregisters itself.
 * Fixes stale CSP headers that were cached and blocking thumbnails.
 */

// Install immediately, skip waiting
self.addEventListener("install", () => {
  self.skipWaiting();
});

// On activate: nuke every cache, then unregister this SW entirely
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister()),
  );
});

// Pass every fetch straight to the network — no caching
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

/**
 * Loop Service Worker — App Shell + Offline Support
 * Caches the app shell so Loop loads on airplane mode / offline.
 * Offline-downloaded tracks are stored in IndexedDB (offlineDB.ts) — not here.
 */

const CACHE_NAME = "loop-shell-v3";

// Assets to pre-cache on install (app shell)
const SHELL_ASSETS = [
  "/",
  "/favicon.svg",
  "/favicon-32.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.json",
  "/silent.mp3",
];

// ── Install: cache the app shell ──────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: remove stale caches ────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: smart routing ──────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ── 1. Skip non-GET & cross-origin requests (YouTube, Supabase, etc.) ──
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // ── 2. Skip TanStack Start API/server functions — always need network ──
  if (url.pathname.startsWith("/_server") || url.pathname.startsWith("/api/")) return;

  // ── 3. For HTML navigation requests: network-first, fall back to cached "/" ──
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Cache a fresh copy of the shell
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() =>
          // Offline: serve cached shell so the app loads
          caches.match("/").then(
            (cached) =>
              cached ||
              new Response(
                "<html><body><h1>Loop is offline</h1><p>Open the app when online first to enable offline mode.</p></body></html>",
                { headers: { "Content-Type": "text/html" } }
              )
          )
        )
    );
    return;
  }

  // ── 4. For static assets (JS, CSS, fonts, images): cache-first ──
  const isStaticAsset =
    url.pathname.match(/\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico|gif|mp3|wav)$/) ||
    url.pathname.startsWith("/assets/");

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            }
            return res;
          })
      )
    );
    return;
  }

  // ── 5. Everything else: network-first, no caching ──
  // (dynamic data, recommendations, search results — always fresh)
  event.respondWith(
    fetch(request).catch(() =>
      caches.match(request).then(
        (cached) =>
          cached ||
          new Response(JSON.stringify({ error: "offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          })
      )
    )
  );
});

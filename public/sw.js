// Warehouse Inventory service worker.
// Bump VERSION to invalidate every cache on next install.
const VERSION = "v3";
const STATIC_CACHE = `inv-static-${VERSION}`;
const PAGES_CACHE = `inv-pages-${VERSION}`;
const OFFLINE_URL = "/";

const STATIC_EXT = /\.(png|jpe?g|svg|webp|ico|webmanifest|woff2?|ttf|css|js|map)$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGES_CACHE).then((cache) =>
      cache.add(OFFLINE_URL).catch(() => {})
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== PAGES_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Never intercept API calls (Gemini scan endpoint).
  if (url.pathname.startsWith("/api/")) return;

  // Skip range requests (video/audio) and large uploads.
  if (req.headers.get("range")) return;

  if (
    url.pathname.startsWith("/_next/static/") ||
    STATIC_EXT.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  const accept = req.headers.get("accept") || "";
  if (req.mode === "navigate" || accept.includes("text/html")) {
    event.respondWith(staleWhileRevalidate(req, PAGES_CACHE));
  }
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type !== "opaque") {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => null);
  if (cached) {
    network.catch(() => {});
    return cached;
  }
  const fresh = await network;
  if (fresh) return fresh;
  const fallback = await cache.match(OFFLINE_URL);
  if (fallback) return fallback;
  return new Response("Offline", {
    status: 503,
    headers: { "Content-Type": "text/plain" },
  });
}

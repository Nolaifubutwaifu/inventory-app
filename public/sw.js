// Warehouse Inventory service worker.
// Bump VERSION to invalidate every cache on next install. Required when the
// worker script itself changes. App-code deploys are picked up without a bump
// because document navigations are network-first (see below).
const VERSION = "v14";
const STATIC_CACHE = `inv-static-${VERSION}`;
const PAGES_CACHE = `inv-pages-${VERSION}`;
const OFFLINE_URL = "/";

const STATIC_EXT = /\.(png|jpe?g|svg|webp|ico|webmanifest|woff2?|ttf|css|js|map)$/;

self.addEventListener("install", (event) => {
  // Activate the new worker immediately instead of waiting for every old tab to
  // close. A new SW calling skipWaiting() in its own install takes over even if
  // the previously-installed SW didn't — so stuck browsers auto-upgrade to the
  // latest build on their next reload, no "Update" tap required.
  self.skipWaiting();
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

  // The browser checks this URL to decide whether to install a new worker.
  // Serving it from the static cache would pin an old worker forever.
  if (url.pathname === "/sw.js") return;

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
    // Network-first. The previous worker returned the cached document and
    // refreshed it in the background, so the first open after a deploy still
    // ran the previous JavaScript. That is why a re-export kept the old
    // Summary filter (dropping zero and negative SKUs) after the fix shipped.
    event.respondWith(networkFirst(req, PAGES_CACHE));
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

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    const fallback = await cache.match(OFFLINE_URL);
    if (fallback) return fallback;
    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

const CACHE_VERSION = "greymens-v3";
const STATIC_ASSETS = ["/", "/offline.html", "/manifest.json", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

function isCacheableStatic(url) {
  // Same-origin static only: Next static, fonts, icons, images. Never API/auth.
  if (url.origin !== self.location.origin) return false;
  const p = url.pathname;
  if (p.startsWith("/api/")) return false;
  if (p.startsWith("/_next/static/")) return true;
  if (p === "/" || p === "/offline.html" || p === "/manifest.json" || p === "/favicon.ico") return true;
  if (p.startsWith("/icons/")) return true;
  return /\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(p);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Never cache API or authenticated navigations: network-first, no put.
  if (url.pathname.startsWith("/api/")) return;

  // Documents: network-first -> cache -> offline page.
  if (request.destination === "document" || request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => caches.match("/offline.html")),
    );
    return;
  }

  // Static: stale-while-revalidate, bounded to allowlist.
  if (!isCacheableStatic(url)) return;
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetched;
    }),
  );
});

/* Only static assets are persisted. Dynamic pages, RSC payloads, APIs and
   private data always go to the network. Offline never implies fresh care data. */
const CACHE = "vetnear-v1.36-static";
const CACHE_PREFIX = "vetnear-";
const OFFLINE = "/offline.html";
const MAX_ENTRIES = 160;
const MAX_ASSET_BYTES = 3 * 1024 * 1024;
const STATIC_FILES = new Set([OFFLINE, "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/apple-touch-icon.png", "/og.png"]);
const SHELL = [OFFLINE, "/icon-192.png", "/icon-512.png"];

function isStaticAsset(url) {
  return !url.search && (STATIC_FILES.has(url.pathname) || url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/visuals/"));
}

let cacheQueue = Promise.resolve();
function remember(request, response) {
  // Serialize writes so parallel loads cannot bypass the cache bound.
  cacheQueue = cacheQueue.catch(() => {}).then(async () => {
    if (!response.ok || response.type !== "basic" || response.redirected) return;
    if (/no-store|private/i.test(response.headers.get("cache-control") || "")) return;
    if (/text\/html|text\/x-component/i.test(response.headers.get("content-type") || "") && new URL(request.url).pathname !== OFFLINE) return;
    if (Number(response.headers.get("content-length")) > MAX_ASSET_BYTES) return;
    if ((await response.clone().blob()).size > MAX_ASSET_BYTES) return;
    const cache = await caches.open(CACHE);
    await cache.put(request, response);
    const keys = await cache.keys();
    const removable = keys.filter((key) => !SHELL.includes(new URL(key.url).pathname));
    const excess = Math.max(0, keys.length - MAX_ENTRIES);
    await Promise.all(removable.slice(0, excess).map((key) => cache.delete(key)));
  });
  return cacheQueue.catch(() => {});
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.cache === "no-store") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/^\/(api|admin|partner)(\/|$)/.test(url.pathname)) return;
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc") || request.headers.has("Next-Router-State-Tree")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(OFFLINE)) || new Response("Немає зʼєднання. Перевірте інтернет і перезавантажте сторінку.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }));
    return;
  }

  if (!isStaticAsset(url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    event.waitUntil(remember(request, response.clone()));
    return response;
  })());
});

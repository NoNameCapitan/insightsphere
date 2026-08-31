const CACHE_NAME = "vlk-402-shell-v3";
const SHELL = ["/", "/manifest.webmanifest", "/favicon.svg"];

// Ресурси зі стабільним хешем в імені: їх достатньо взяти з кешу один раз.
const IMMUTABLE_ASSET = /\/assets\/[^/]+-[A-Za-z0-9_-]{6,}\.(?:js|css|woff2?)$/;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isCacheable(response) {
  return Boolean(response) && response.ok && response.type === "basic";
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheable(response)) {
    const copy = response.clone();
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, copy);
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      const copy = response.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, copy);
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const shell = await caches.match("/");
      if (shell) return shell;
    }
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Постатейні модулі пояснень і решта хешованих ресурсів беруться з кешу
  // одразу — саме це дозволяє відкривати будь-яку статтю офлайн.
  event.respondWith(IMMUTABLE_ASSET.test(url.pathname) ? cacheFirst(request) : networkFirst(request));
});

// Registration includes the build hash, so every build updates the worker.
const RELEASE = new URL(self.location.href).searchParams.get("release");
const CACHE_PREFIX = "vlk-402-release-";
const CACHE_NAME = CACHE_PREFIX + RELEASE;
const SHELL = ["/", "/manifest.webmanifest", "/vlk-command-emblem.png", "/vlk-command-header.png"];
const IMMUTABLE_ASSET = /^\/(?:assets|_next\/static)\/[^?#]+\.(?:js|css|woff2?)$/;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    if (!/^[a-f0-9]{64}$/.test(RELEASE ?? "")) throw new Error("Missing offline release");
    const response = await fetch("/offline-manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Offline manifest unavailable");
    const manifest = await response.json();
    if (manifest.version !== RELEASE || !Array.isArray(manifest.assets) || !manifest.assets.length ||
      !manifest.assets.every((asset) => typeof asset === "string" && IMMUTABLE_ASSET.test(asset) && !asset.includes(".."))) {
      throw new Error("Offline manifest does not match this release");
    }
    const cache = await caches.open(CACHE_NAME);
    // addAll is atomic: a missing chunk leaves the previous release intact.
    try { await cache.addAll([...SHELL, ...manifest.assets]); }
    catch (error) {
      // An incomplete install must not be mistaken for a usable previous release.
      if (!(await cache.match("/"))) await caches.delete(CACHE_NAME);
      throw error;
    }
    // Updates wait for the doctor's action; no automatic reload during a review.
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE_UPDATE") event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const own = keys.filter((key) => key.startsWith(CACHE_PREFIX) || /^vlk-402-shell-v\d+$/.test(key));
    // Keep one previous release for tabs still running its chunks.
    const previous = own.filter((key) => key !== CACHE_NAME).at(-1);
    await Promise.all(own.filter((key) => key !== CACHE_NAME && key !== previous).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function previousAsset(request) {
  for (const key of (await caches.keys()).reverse()) {
    if (key === CACHE_NAME || !(key.startsWith(CACHE_PREFIX) || /^vlk-402-shell-v\d+$/.test(key))) continue;
    const response = await (await caches.open(key)).match(request);
    if (response) return response;
  }
}

async function cachedAsset(request) {
  const current = await caches.open(CACHE_NAME);
  const cached = await current.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      // Quota failure must not break a successful online response.
      try { await current.put(request, response.clone()); } catch { /* Keep online response. */ }
    }
    if (response.ok) return response;
    return await previousAsset(request) ?? response;
  } catch (error) {
    const previous = await previousAsset(request);
    if (previous) return previous;
    throw error;
  }
}

async function navigation(request) {
  // Serve the installed release as a whole. A deployment or stalled connection
  // must not replace its HTML before the doctor accepts the waiting update.
  try {
    const cached = await (await caches.open(CACHE_NAME)).match("/");
    if (cached) return cached;
  } catch { /* A blocked/evicted cache must not prevent online recovery. */ }
  try {
    const response = await fetch(request);
    if (response.ok) return response;
  } catch { /* No usable copy is available. */ }
  return new Response("Немає з’єднання. Відкрийте навігатор онлайн для підготовки офлайн-копії.", {
    status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache React Server Component responses or user/API requests as HTML.
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") return;
  if (request.mode === "navigate" && url.pathname === "/") event.respondWith(navigation(request));
  else if (IMMUTABLE_ASSET.test(url.pathname) || SHELL.includes(url.pathname) && url.pathname !== "/") {
    event.respondWith(cachedAsset(request));
  }
});

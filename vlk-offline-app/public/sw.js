// Service worker ВЛК Offline / Standby.
//
// У кеш потрапляють ЛИШЕ незмінні файли інтерфейсу (/_next/static) і статична
// сторінка «сервер недоступний». HTML сторінок, потоки RSC, /api та будь-які
// запити з медичними даними НІКОЛИ не кешуються і не зберігаються у браузері.
// Мета — щоб оболонка відкривалася, коли локальний сервер тимчасово недоступний,
// а не щоб тримати картки пацієнтів поза сервером установи.
// Версію задає сторінка під час реєстрації: /sw.js?v=<стамп збірки>.
// Інший стамп — інший URL скрипта — браузер ставить новий worker і кеш.
const VERSION =
  new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = "vlk-shell-" + VERSION;
const SHELL = [
  "/offline",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        SHELL.map((path) => cache.add(path).catch(() => undefined)),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith("vlk-shell-") && name !== CACHE)
          await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "vlk-skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Незмінні файли збірки: віддаємо з кешу, інакше завантажуємо й зберігаємо.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })(),
    );
    return;
  }

  if (SHELL.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const hit = await caches.match(request);
          if (hit) return hit;
          throw new Error("offline");
        }
      })(),
    );
    return;
  }

  // Навігація: тільки мережа. Якщо локальний сервер не відповідає —
  // показуємо статичну сторінку з поясненням, а не збережену копію картки.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(CACHE);
          const fallback = await cache.match("/offline");
          return (
            fallback ||
            new Response(
              "<!doctype html><meta charset=utf-8><title>Сервер недоступний</title><p>Локальний сервер ВЛК недоступний.",
              { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
            )
          );
        }
      })(),
    );
  }
  // Решта запитів — без участі service worker.
});

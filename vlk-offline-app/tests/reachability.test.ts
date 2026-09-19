import test from "node:test";
import assert from "node:assert/strict";
import { probeHealth, isLocalHost } from "../src/lib/reachability";

// 503 від /api/health означає «сервер живий, база не готова».
// Трактування його як втрати зв'язку давало банер, що суперечив
// екрану очікування на тій самій сторінці.
test("503 від health не вважається втратою зв'язку", async () => {
  const fetcher = (async () =>
    new Response(JSON.stringify({ status: "misconfigured" }), {
      status: 503,
    })) as unknown as typeof fetch;
  assert.equal(await probeHealth(fetcher), "degraded");
});

test("200 від health означає робочий стан", async () => {
  const fetcher = (async () =>
    new Response(JSON.stringify({ status: "ok" }))) as unknown as typeof fetch;
  assert.equal(await probeHealth(fetcher), "ok");
});

test("помилка запиту означає недоступний сервер", async () => {
  const fetcher = (async () => {
    throw new TypeError("fetch failed");
  }) as unknown as typeof fetch;
  assert.equal(await probeHealth(fetcher), "offline");
});

test("зависання запиту не блокує перевірку", async () => {
  const fetcher = ((_url: string, init?: { signal?: AbortSignal }) =>
    new Promise((_resolve, reject) =>
      init?.signal?.addEventListener("abort", () =>
        reject(new Error("aborted")),
      ),
    )) as unknown as typeof fetch;
  assert.equal(await probeHealth(fetcher, 50), "offline");
});

test("адреси локальної мережі відрізняються від публічних", () => {
  for (const host of [
    "localhost",
    "127.0.0.1",
    "192.168.1.10",
    "10.0.0.5",
    "172.16.4.2",
    "vlk-server.local",
  ])
    assert.equal(isLocalHost(host), true, host);
  for (const host of ["vlk-offline.vercel.app", "example.com", "172.32.0.1"])
    assert.equal(isLocalHost(host), false, host);
});

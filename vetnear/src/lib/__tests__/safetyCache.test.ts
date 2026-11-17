import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const serviceWorker = readFileSync(new URL("../../../public/sw.js", import.meta.url), "utf8");
const activeCache = serviceWorker.match(/const CACHE = "([^"]+)"/)![1];
function harness() {
  const handlers: Record<string, (event: unknown) => void> = {};
  const cache = { match: vi.fn(async () => new Response("cached icon")) };
  const caches = { keys: vi.fn(async () => ["vetnear-v1", "vetnear-v1.30", activeCache, "other-app-cache"]), delete: vi.fn(async () => true), match: vi.fn(async () => ({})), open: vi.fn(async () => cache) };
  runInNewContext(serviceWorker, {
    URL, caches, fetch: vi.fn(),
    self: { location: { origin: "https://vetnear.test" }, skipWaiting: vi.fn(), clients: { claim: vi.fn() },
      addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler; } },
  });
  return { handlers, caches };
}

describe("PWA safety cache", () => {
  it.each(["/api/safety/alert", "/api/safety/shelters?lat=50.45&lng=30.52", "/api/places"])("never caches or intercepts %s", (path) => {
    const { handlers, caches } = harness();
    const respondWith = vi.fn();
    handlers.fetch({ request: new Request(`https://vetnear.test${path}`), respondWith });
    expect(respondWith).not.toHaveBeenCalled();
    expect(caches.match).not.toHaveBeenCalled();
  });
  it("still serves cached static app assets", async () => {
    const { handlers } = harness();
    const respondWith = vi.fn();
    handlers.fetch({ request: new Request("https://vetnear.test/icon-192.png"), respondWith });
    expect(respondWith).toHaveBeenCalled();
    expect(await (await respondWith.mock.calls[0][0]).text()).toBe("cached icon");
  });
  it("purges the legacy cache containing potentially stale active alerts on upgrade", async () => {
    const { handlers, caches } = harness();
    const waitUntil = vi.fn();
    handlers.activate({ waitUntil });
    await waitUntil.mock.calls[0][0];
    expect(caches.delete).toHaveBeenCalledWith("vetnear-v1");
    expect(caches.delete).toHaveBeenCalledWith("vetnear-v1.30");
    expect(caches.delete).not.toHaveBeenCalledWith(activeCache);
    expect(caches.delete).not.toHaveBeenCalledWith("other-app-cache");
  });
});

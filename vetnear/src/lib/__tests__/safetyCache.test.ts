import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const serviceWorker = readFileSync(new URL("../../../public/sw.js", import.meta.url), "utf8");
function harness() {
  const handlers: Record<string, (event: unknown) => void> = {};
  const caches = { keys: vi.fn(async () => ["vetnear-v1", "vetnear-v1.30"]), delete: vi.fn(async () => true), match: vi.fn(async () => ({})) };
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
    handlers.fetch({ request: { url: `https://vetnear.test${path}`, method: "GET", mode: "cors" }, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
    expect(caches.match).not.toHaveBeenCalled();
  });
  it("still caches static app assets", () => {
    const { handlers } = harness();
    const respondWith = vi.fn();
    handlers.fetch({ request: { url: "https://vetnear.test/icon-192.png", method: "GET", mode: "cors" }, respondWith });
    expect(respondWith).toHaveBeenCalled();
  });
  it("purges the legacy cache containing potentially stale active alerts on upgrade", async () => {
    const { handlers, caches } = harness();
    const waitUntil = vi.fn();
    handlers.activate({ waitUntil });
    await waitUntil.mock.calls[0][0];
    expect(caches.delete).toHaveBeenCalledWith("vetnear-v1");
    expect(caches.delete).not.toHaveBeenCalledWith("vetnear-v1.30");
  });
});

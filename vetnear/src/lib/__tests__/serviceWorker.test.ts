import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const origin = "https://vetnear.test";
const script = readFileSync("public/sw.js", "utf8");
function basic(body = "asset", headers: Record<string, string> = {}) {
  const response = new Response(body, { headers });
  Object.defineProperty(response, "type", { value: "basic" });
  Object.defineProperty(response, "clone", { value: () => basic(body, headers) });
  return response;
}
function harness() {
  const handlers: Record<string, (event: { request: Request; respondWith: (value: Promise<Response>) => void; waitUntil: (value: Promise<unknown>) => void }) => void> = {};
  const stores = new Map<string, Map<string, Response>>();
  const fetcher = vi.fn(async () => basic());
  const deleted: string[] = [];
  const key = (input: string | Request) => new URL(typeof input === "string" ? input : input.url, origin).href;
  const cacheApi = {
    keys: async () => [...stores.keys()],
    delete: async (name: string) => { deleted.push(name); return stores.delete(name); },
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const data = stores.get(name)!;
      return {
        addAll: async (paths: string[]) => { paths.forEach((path) => data.set(key(path), basic(path === "/offline.html" ? "Offline notice" : "icon"))); },
        match: async (request: string | Request) => data.get(key(request)),
        put: async (request: string | Request, response: Response) => { data.set(key(request), response); },
        keys: async () => [...data.keys()].map((url) => new Request(url)),
        delete: async (request: string | Request) => data.delete(key(request)),
      };
    },
  };
  runInNewContext(script, { URL, Response, Set, Promise, caches: cacheApi, fetch: fetcher,
    self: { location: { origin }, skipWaiting: vi.fn(), clients: { claim: vi.fn() }, addEventListener: (name: string, callback: typeof handlers[string]) => { handlers[name] = callback; } },
  });
  async function dispatch(type: string, request = new Request(origin)) {
    let response: Promise<Response> | undefined;
    const pending: Promise<unknown>[] = [];
    handlers[type]({ request, respondWith: (value) => { response = value; }, waitUntil: (value) => { pending.push(value); } });
    const result = response ? await response : undefined;
    await Promise.all(pending);
    return result;
  }
  return { dispatch, stores, deleted, fetcher };
}

describe("service-worker cache boundaries", () => {
  it("removes only old VetNear caches", async () => {
    const h = harness();
    h.stores.set("other-product-cache", new Map());
    h.stores.set("vetnear-v1.30", new Map());
    await h.dispatch("install");
    await h.dispatch("activate");
    expect(h.deleted).toEqual(["vetnear-v1.30"]);
    expect(h.stores.has("other-product-cache")).toBe(true);
  });
  it.each(["/nearby?_rsc=abc", "/api/safety/alert", "/admin", "/partner/dashboard", "/place/clinic-1"])("does not cache dynamic GET %s", async (path) => {
    const h = harness();
    expect(await h.dispatch("fetch", new Request(origin + path))).toBeUndefined();
    expect(h.fetcher).not.toHaveBeenCalled();
  });
  it("bypasses header-only RSC requests even to an asset-looking URL", async () => {
    const h = harness();
    expect(await h.dispatch("fetch", new Request(origin + "/visuals/example.webp", { headers: { RSC: "1" } }))).toBeUndefined();
    expect(h.fetcher).not.toHaveBeenCalled();
  });
  it("never stores navigation HTML and serves an explicit offline notice", async () => {
    const h = harness();
    await h.dispatch("install");
    const request = new Request(origin + "/place/clinic-1");
    Object.defineProperty(request, "mode", { value: "navigate" });
    h.fetcher.mockResolvedValueOnce(basic("Live clinic", { "content-type": "text/html" }));
    expect(await (await h.dispatch("fetch", request))!.text()).toBe("Live clinic");
    expect([...h.stores.values()].some((cache) => cache.has(request.url))).toBe(false);
    h.fetcher.mockRejectedValueOnce(new TypeError("offline"));
    expect(await (await h.dispatch("fetch", request))!.text()).toBe("Offline notice");
  });
  it("bounds asset cache entries and keeps the offline shell", async () => {
    const h = harness();
    await h.dispatch("install");
    for (let i = 0; i < 165; i++) await h.dispatch("fetch", new Request(`${origin}/visuals/test-${i}.webp`));
    const cache = [...h.stores.values()][0];
    expect(cache.size).toBeLessThanOrEqual(160);
    expect(cache.has(origin + "/offline.html")).toBe(true);
  });
  it.each<Record<string, string>>([{ "cache-control": "no-store" }, { "content-type": "text/x-component" }])("rejects responses inappropriate for static storage %j", async (headers) => {
    const h = harness();
    h.fetcher.mockResolvedValue(basic("private", headers));
    const request = new Request(origin + "/visuals/example.webp");
    await h.dispatch("fetch", request);
    await h.dispatch("fetch", request);
    expect(h.fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not persist oversized static assets", async () => {
    const h = harness();
    h.fetcher.mockResolvedValue(basic("x".repeat(3 * 1024 * 1024 + 1)));
    const request = new Request(origin + "/visuals/large.webp");
    await h.dispatch("fetch", request);
    expect([...h.stores.values()].some((cache) => cache.has(request.url))).toBe(false);
  });
});

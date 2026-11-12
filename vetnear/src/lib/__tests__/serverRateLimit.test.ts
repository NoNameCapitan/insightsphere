import { afterEach, describe, it, expect, vi } from "vitest";
import {
  createServerFailureTracker,
  createServerRateLimiter,
  clientKeyFromRequest,
} from "@/lib/security/serverRateLimit";

afterEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  vi.unstubAllGlobals();
});

describe("createServerRateLimiter", () => {
  it("allows up to the limit, then blocks", async () => {
    const check = createServerRateLimiter({ limit: 3, windowMs: 60_000 });
    const t = 1_000_000;
    expect((await check("ip1", t)).allowed).toBe(true);
    expect((await check("ip1", t)).allowed).toBe(true);
    expect((await check("ip1", t)).allowed).toBe(true);
    const fourth = await check("ip1", t);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks keys independently", async () => {
    const check = createServerRateLimiter({ limit: 1, windowMs: 60_000 });
    const t = 1_000_000;
    expect((await check("ip1", t)).allowed).toBe(true);
    expect((await check("ip1", t)).allowed).toBe(false);
    expect((await check("ip2", t)).allowed).toBe(true); // different client unaffected
  });

  it("resets after the window passes", async () => {
    const check = createServerRateLimiter({ limit: 1, windowMs: 60_000 });
    const t = 1_000_000;
    expect((await check("ip1", t)).allowed).toBe(true);
    expect((await check("ip1", t + 30_000)).allowed).toBe(false); // inside window
    expect((await check("ip1", t + 61_000)).allowed).toBe(true); // window expired
  });

  it("reports decreasing remaining", async () => {
    const check = createServerRateLimiter({ limit: 3, windowMs: 60_000 });
    const t = 1_000_000;
    expect((await check("ip1", t)).remaining).toBe(2);
    expect((await check("ip1", t)).remaining).toBe(1);
    expect((await check("ip1", t)).remaining).toBe(0);
  });

  it("uses the shared REST counter when Upstash is configured", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "secret";
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ result: [2, 30_000] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const check = createServerRateLimiter({ namespace: "assistant", limit: 3, windowMs: 60_000 });
    const result = await check("1.2.3.4", 1_000_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("https://redis.example");
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain("vetnear:rl:assistant:1.2.3.4");
  });
});

describe("createServerFailureTracker", () => {
  it("blocks after the configured number of failures and clears on success", async () => {
    const tracker = createServerFailureTracker({ namespace: "test-auth", limit: 2, windowMs: 60_000 });
    await tracker.recordFailure("ip", 1000);
    expect(await tracker.isBlocked("ip", 1000)).toBe(false);
    await tracker.recordFailure("ip", 1000);
    expect(await tracker.isBlocked("ip", 1000)).toBe(true);
    await tracker.clear("ip");
    expect(await tracker.isBlocked("ip", 1000)).toBe(false);
  });
});

describe("clientKeyFromRequest", () => {
  const req = (headers: Record<string, string>) =>
    new Request("http://localhost/api/assistant", { headers });

  it("uses first hop of x-forwarded-for", () => {
    expect(
      clientKeyFromRequest(req({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })),
    ).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    expect(clientKeyFromRequest(req({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
  });

  it("falls back to a shared key without headers", () => {
    expect(clientKeyFromRequest(req({}))).toBe("anonymous");
  });
});

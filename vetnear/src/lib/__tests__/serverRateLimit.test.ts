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
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
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
    const body = String(fetchMock.mock.calls[0][1]?.body);
    expect(body).toMatch(/vetnear:rl:assistant:[a-f0-9]{64}/);
    expect(body).not.toContain("1.2.3.4");
  });

  it("uses the same opaque shared key across instances without a lead salt", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "stable-test-credential");
    vi.stubEnv("LEAD_HASH_SALT", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ result: [1, 60_000] })));
    vi.stubGlobal("fetch", fetchMock);
    await createServerRateLimiter({ namespace: "test", limit: 3, windowMs: 60_000 })("1.2.3.4");
    vi.resetModules();
    const fresh = await import("@/lib/security/serverRateLimit");
    await fresh.createServerRateLimiter({ namespace: "test", limit: 3, windowMs: 60_000 })("1.2.3.4");
    const keys = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body))[3]);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).not.toContain("1.2.3.4");
  });

  it("separates identifiers by namespace and configured salt", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-credential");
    vi.stubEnv("LEAD_HASH_SALT", "first-test-salt");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ result: [1, 60_000] })));
    vi.stubGlobal("fetch", fetchMock);
    await createServerRateLimiter({ namespace: "one", limit: 3, windowMs: 60_000 })("1.2.3.4");
    await createServerRateLimiter({ namespace: "two", limit: 3, windowMs: 60_000 })("1.2.3.4");
    vi.stubEnv("LEAD_HASH_SALT", "second-test-salt");
    await createServerRateLimiter({ namespace: "one", limit: 3, windowMs: 60_000 })("1.2.3.4");
    const digests = fetchMock.mock.calls.map((call) => String(JSON.parse(String(call[1]?.body))[3]).split(":").at(-1));
    expect(new Set(digests).size).toBe(3);
  });
});

describe("createServerFailureTracker", () => {
  it("uses one opaque key for recording, blocking and clearing failures", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-credential");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ result: command[0] === "EVAL" ? [2, 60_000] : command[0] === "GET" ? "2" : 1 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const tracker = createServerFailureTracker({ namespace: "moderator", limit: 2, windowMs: 60_000 });
    await tracker.recordFailure("1.2.3.4");
    expect(await tracker.isBlocked("1.2.3.4")).toBe(true);
    await tracker.clear("1.2.3.4");
    const commands = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)));
    expect(commands[0][3]).toBe(commands[1][1]);
    expect(commands[1][1]).toBe(commands[2][1]);
    expect(JSON.stringify(commands)).not.toContain("1.2.3.4");
    expect(commands[0][4]).toBe(60_000);
  });
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

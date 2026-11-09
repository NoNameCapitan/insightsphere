import { describe, it, expect } from "vitest";
import {
  createServerRateLimiter,
  clientKeyFromRequest,
} from "@/lib/security/serverRateLimit";

describe("createServerRateLimiter", () => {
  it("allows up to the limit, then blocks", () => {
    const check = createServerRateLimiter({ limit: 3, windowMs: 60_000 });
    const t = 1_000_000;
    expect(check("ip1", t).allowed).toBe(true);
    expect(check("ip1", t).allowed).toBe(true);
    expect(check("ip1", t).allowed).toBe(true);
    const fourth = check("ip1", t);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks keys independently", () => {
    const check = createServerRateLimiter({ limit: 1, windowMs: 60_000 });
    const t = 1_000_000;
    expect(check("ip1", t).allowed).toBe(true);
    expect(check("ip1", t).allowed).toBe(false);
    expect(check("ip2", t).allowed).toBe(true); // different client unaffected
  });

  it("resets after the window passes", () => {
    const check = createServerRateLimiter({ limit: 1, windowMs: 60_000 });
    const t = 1_000_000;
    expect(check("ip1", t).allowed).toBe(true);
    expect(check("ip1", t + 30_000).allowed).toBe(false); // inside window
    expect(check("ip1", t + 61_000).allowed).toBe(true); // window expired
  });

  it("reports decreasing remaining", () => {
    const check = createServerRateLimiter({ limit: 3, windowMs: 60_000 });
    const t = 1_000_000;
    expect(check("ip1", t).remaining).toBe(2);
    expect(check("ip1", t).remaining).toBe(1);
    expect(check("ip1", t).remaining).toBe(0);
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

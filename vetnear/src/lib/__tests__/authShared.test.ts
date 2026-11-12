import { describe, expect, it } from "vitest";
import { isSameOriginRequest, normalizeEmail, resolveGate, safeNextPath } from "@/lib/auth/shared";

describe("auth helpers", () => {
  it("only allows same-site paths as the post-login destination", () => {
    expect(safeNextPath("/my-pets/new")).toBe("/my-pets/new");
    expect(safeNextPath("/nearby?category=grooming")).toBe("/nearby?category=grooming");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined, "/auth/callback", "/api/pets", "/x".repeat(200)]) {
      expect(safeNextPath(bad as string | null), String(bad)).toBe("/my-pets");
    }
  });

  it("normalises and validates e-mail addresses", () => {
    expect(normalizeEmail("  Ivan@Example.COM ")).toBe("ivan@example.com");
    for (const bad of ["", "ivan", "ivan@", "@example.com", "a b@example.com", "ivan@example", 42, null, `${"a".repeat(200)}@example.com`]) {
      expect(normalizeEmail(bad), String(bad)).toBeNull();
    }
  });

  it("treats only same-origin requests as trusted for cookie-authenticated writes", () => {
    const req = (headers: Record<string, string>) => new Request("https://vetnear.example/api/pets/x", { method: "PUT", headers });
    expect(isSameOriginRequest(req({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOriginRequest(req({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOriginRequest(req({ "sec-fetch-site": "same-site" }))).toBe(false);
    expect(isSameOriginRequest(req({ origin: "https://vetnear.example", host: "vetnear.example" }))).toBe(true);
    expect(isSameOriginRequest(req({ origin: "https://evil.example", host: "vetnear.example" }))).toBe(false);
    expect(isSameOriginRequest(req({}))).toBe(false);
  });

  it("gates the pets area by session state", () => {
    expect(resolveGate(null)).toBe("loading");
    expect(resolveGate({ configured: false, user: null })).toBe("local");
    expect(resolveGate({ configured: true, user: null })).toBe("signed-out");
    expect(resolveGate({ configured: true, user: { id: "u1" } })).toBe("signed-in");
  });
});

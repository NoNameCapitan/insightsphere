import { describe, it, expect } from "vitest";
import { isSafeUrl, safeUrl, isValidEmail, isValidPhone } from "@/lib/security/url";

describe("isSafeUrl", () => {
  it.each([
    "https://vetnear.example",
    "http://clinic.kyiv.ua/about",
    "tel:+380441234567",
    "mailto:info@clinic.ua",
  ])("allows safe: %s", (u) => {
    expect(isSafeUrl(u)).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "  javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "ftp://example.com/file",
    "not a url",
    "",
    null,
    undefined,
  ])("rejects unsafe: %s", (u) => {
    expect(isSafeUrl(u as string | null | undefined)).toBe(false);
  });
});

describe("safeUrl", () => {
  it("returns trimmed URL when safe", () => {
    expect(safeUrl("  https://ok.example  ")).toBe("https://ok.example");
  });
  it("returns undefined when unsafe so callers omit the link", () => {
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
  });
});

describe("isValidEmail / isValidPhone", () => {
  it("accepts a normal email and rejects junk", () => {
    expect(isValidEmail("info@clinic.ua")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("a b@c.d")).toBe(false);
  });

  it("accepts UA phone formats", () => {
    expect(isValidPhone("+380 44 123 45 67")).toBe(true);
    expect(isValidPhone("(044) 123-45-67")).toBe(true);
  });

  it("rejects too-short / too-long numbers", () => {
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidPhone("1234567890123456")).toBe(false);
  });
});

// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  THEME_BOOTSTRAP_SCRIPT,
  THEME_CHANGED_EVENT,
  THEME_STORAGE_KEY,
  applyThemePreference,
  isThemePreference,
  nextPreference,
  readThemePreference,
  resolveTheme,
} from "@/lib/theme/theme";

const root = () => document.documentElement;

function mockSystemDark(dark: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("dark") ? dark : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function runBootstrap() {
  // The same string the root layout inlines into <head>.
  new Function(THEME_BOOTSTRAP_SCRIPT)();
}

beforeEach(() => {
  localStorage.clear();
  root().removeAttribute("data-theme");
  root().removeAttribute("data-theme-preference");
  root().style.colorScheme = "";
  document.head.innerHTML = '<meta name="theme-color" content="#F7F4ED">';
  mockSystemDark(false);
});

afterEach(() => vi.restoreAllMocks());

describe("theme preference logic", () => {
  it("accepts only the three preferences", () => {
    expect(["system", "light", "dark"].every(isThemePreference)).toBe(true);
    expect(isThemePreference("sepia")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });

  it("resolves system against the OS setting", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("cycles system → light → dark → system", () => {
    expect(nextPreference("system")).toBe("light");
    expect(nextPreference("light")).toBe("dark");
    expect(nextPreference("dark")).toBe("system");
  });

  it("ignores a tampered stored value", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "<script>");
    expect(readThemePreference()).toBe("system");
  });

  it("applies, persists and announces a choice", () => {
    const heard = vi.fn();
    window.addEventListener(THEME_CHANGED_EVENT, heard);
    expect(applyThemePreference("dark")).toBe("dark");
    expect(root().dataset.theme).toBe("dark");
    expect(root().dataset.themePreference).toBe("dark");
    expect(root().style.colorScheme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe("#14130F");
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener(THEME_CHANGED_EVENT, heard);
  });

  it("forgets the stored value when returning to system", () => {
    applyThemePreference("light");
    applyThemePreference("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });
});

describe("bootstrap script (runs before first paint)", () => {
  it("follows the OS when nothing is stored", () => {
    mockSystemDark(true);
    runBootstrap();
    expect(root().dataset.theme).toBe("dark");
    expect(root().dataset.themePreference).toBe("system");
  });

  it("honours a stored choice over the OS", () => {
    mockSystemDark(true);
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    runBootstrap();
    expect(root().dataset.theme).toBe("light");
  });

  it("never throws when storage or matchMedia are unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    // @ts-expect-error — simulate an old browser
    window.matchMedia = undefined;
    expect(runBootstrap).not.toThrow();
    expect(root().dataset.theme).toBe("light");
  });
});

// ── palette contrast (WCAG 2.x) ─────────────────────────────────────────────
type RGB = [number, number, number];
const css = readFileSync(path.resolve(__dirname, "../../app/theme.css"), "utf8");

function block(selector: string) {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf("\n}", start);
  if (start < 0 || end < 0) throw new Error(`no block ${selector}`);
  return css.slice(start, end);
}

function tokens(selector: string) {
  const body = block(selector);
  const read = (name: string): RGB => {
    const channel = new RegExp(`${name}:\\s*(\\d+) (\\d+) (\\d+);`).exec(body);
    if (channel) return [Number(channel[1]), Number(channel[2]), Number(channel[3])];
    const hex = new RegExp(`${name}:\\s*#([0-9a-fA-F]{6});`).exec(body);
    if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) as RGB;
    throw new Error(`no ${name} in ${selector}`);
  };
  return read;
}

const luminance = (rgb: RGB) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const over = (fg: RGB, alpha: number, bg: RGB): RGB => fg.map((v, i) => v * alpha + bg[i] * (1 - alpha)) as RGB;

describe("dark palette meets WCAG AA", () => {
  const dark = tokens('html[data-theme="dark"]');
  const canvas = dark("--c-canvas");
  const surface = dark("--c-surface");

  it.each([
    ["ink on canvas", "--c-ink", "--c-canvas"],
    ["ink on surface", "--c-ink", "--c-surface"],
    ["brand-700 text on canvas", "--c-brand-700", "--c-canvas"],
    ["brand-700 text on brand-50 tint", "--c-brand-700", "--c-brand-50"],
    ["emergency-700 text on emergency-50 tint", "--c-emergency-700", "--c-emergency-50"],
    ["peach-700 text on peach-50 tint", "--c-peach-700", "--c-peach-50"],
    ["care ink on care paper", "--care-ink", "--care-paper"],
    ["care muted on care surface", "--care-muted", "--care-surface"],
    ["link on surface", "--theme-link", "--c-surface"],
    ["danger text on canvas", "--theme-danger-text", "--c-canvas"],
  ])("%s", (_label, fg, bg) => {
    expect(contrast(dark(fg), dark(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it("white on filled brand and emergency buttons", () => {
    expect(contrast([255, 255, 255], dark("--c-brand"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast([255, 255, 255], dark("--c-emergency"))).toBeGreaterThanOrEqual(4.5);
  });

  it("raised muted text (ink at 66 %) on canvas and surface", () => {
    const ink = dark("--c-ink");
    expect(contrast(over(ink, 0.66, canvas), canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(over(ink, 0.66, surface), surface)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("light palette stays AA for muted text", () => {
  const light = tokens(":root");
  it("ink at 72 % on canvas", () => {
    const canvas = light("--c-canvas");
    expect(contrast(over(light("--c-ink"), 0.72, canvas), canvas)).toBeGreaterThanOrEqual(4.5);
  });
});

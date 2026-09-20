import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const css = read("app/globals.css");
const page = read("app/page.tsx");
const tokens = (selector) => Object.fromEntries([...css.match(new RegExp(`${selector} \\{([\\s\\S]*?)\\n\\}`))[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1], m[2]]));
function luminance(hex) {
  const values = hex.slice(1).match(/../g).map((v) => parseInt(v, 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
}

test("light and dark primary text, secondary text and outcome badges meet AA contrast", () => {
  for (const selector of [":root", "\\.dark"]) {
    const palette = tokens(selector);
    for (const [foreground, background] of [["foreground", "card"], ["ink-soft", "surface-muted"], ["ink-muted", "card"], ["primary-foreground", "primary"], ["warning-ink", "warning-badge"], ["critical-ink", "critical-badge"], ["positive-ink", "positive-badge"]]) {
      const a = luminance(palette[foreground]), b = luminance(palette[background]);
      assert.ok((Math.max(a, b) + .05) / (Math.min(a, b) + .05) >= 4.5, `${selector}: ${foreground}/${background}`);
    }
  }
});

test("theme is class-based, persisted and available directly in the header", () => {
  const theme = read("components/vlk/theme-controls.tsx");
  assert.match(theme, /storageKey="vlk-theme"/);
  for (const value of ["light", "dark", "system"]) assert.ok(theme.includes(`value="${value}"`));
  assert.match(css, /@custom-variant dark/);
  assert.match(read("app/layout.tsx"), /<VlkThemeProvider>/);
  assert.match(page, /<ThemeToggle/);
});

test("compact navigation reserves remaining space for articles and no longer assumes header height", () => {
  assert.match(page, /id="specialty-picker"/);
  assert.match(page, /className="article-list min-h-0 flex-1 overflow-y-auto/);
  assert.doesNotMatch(page, /330px_minmax|100vh-105px|sm:grid sm:grid-cols-2 sm:overflow-visible/);
  assert.match(css, /270px minmax\(0, 1fr\) 228px/);
  assert.doesNotMatch(css, /font:\s*inherit/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

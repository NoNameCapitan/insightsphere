import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  APPEARANCE_BOOT_SCRIPT,
  APPEARANCE_KEY,
  DEFAULT_APPEARANCE,
  DENSITY_OPTIONS,
  readAppearance,
  resolveTheme,
  serializeAppearance,
  THEME_OPTIONS,
} from "../lib/vlk-appearance.ts";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("appearance defaults to the system theme and comfortable density", () => {
  assert.deepEqual(DEFAULT_APPEARANCE, { theme: "system", density: "comfortable" });
  assert.deepEqual(THEME_OPTIONS.map((item) => item.id), ["system", "light", "dark"]);
  assert.deepEqual(DENSITY_OPTIONS.map((item) => item.id), ["comfortable", "compact"]);
});

test("appearance survives a round trip and rejects damaged values", () => {
  for (const appearance of [
    { theme: "dark", density: "compact" },
    { theme: "light", density: "comfortable" },
    { theme: "system", density: "compact" },
  ]) {
    assert.deepEqual(readAppearance(serializeAppearance(appearance)), appearance);
  }

  for (const broken of ["", "{", "null", "[]", '{"theme":"neon","density":"tiny"}', undefined, 42]) {
    assert.deepEqual(readAppearance(broken), DEFAULT_APPEARANCE);
  }
});

test("the system preference decides only when no explicit theme is stored", () => {
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
});

test("the boot script sets both attributes before the first paint", () => {
  assert.ok(APPEARANCE_BOOT_SCRIPT.includes(JSON.stringify(APPEARANCE_KEY)));
  assert.match(APPEARANCE_BOOT_SCRIPT, /setAttribute\("data-theme"/);
  assert.match(APPEARANCE_BOOT_SCRIPT, /setAttribute\("data-density"/);
  assert.match(APPEARANCE_BOOT_SCRIPT, /prefers-color-scheme: dark/);
  // Скрипт не має падати на приватному режимі, де localStorage кидає помилку.
  assert.match(APPEARANCE_BOOT_SCRIPT, /try\{/);
  assert.match(source("app/layout.tsx"), /APPEARANCE_BOOT_SCRIPT/);
});

test("the night theme redefines every surface and ink token it needs", () => {
  const css = source("app/globals.css");
  const dark = css.slice(css.indexOf(':root[data-theme="dark"]'));
  const scope = dark.slice(0, dark.indexOf("}"));
  for (const token of [
    "--background",
    "--surface",
    "--panel",
    "--panel-head",
    "--rail",
    "--row",
    "--row-active",
    "--foreground",
    "--ink-body",
    "--ink-soft",
    "--ink-muted",
    "--ink-faint",
    "--primary",
    "--primary-foreground",
    "--accent-ink",
    "--hairline",
    "--badge-critical-bg",
    "--badge-critical-ink",
    "--badge-warning-bg",
    "--badge-positive-bg",
    "--badge-neutral-bg",
  ]) {
    assert.ok(scope.includes(`${token}:`), `нічна тема не перевизначає ${token}`);
  }
  assert.match(css, /html\[data-theme="dark"\]\s*\{\s*color-scheme: dark;/);
});

test("the page keeps theme and density on the document element", () => {
  const page = source("app/page.tsx");
  assert.match(page, /root\.setAttribute\("data-theme", resolveTheme\(appearance\.theme, systemDark\)\)/);
  assert.match(page, /root\.setAttribute\("data-density", appearance\.density\)/);
  assert.match(page, /localStorage\.setItem\(\s*APPEARANCE_KEY/);
});

test("compact density trims space without shrinking the medical text", () => {
  const css = source("app/globals.css");
  const compact = css.match(/\[data-density="compact"\][\s\S]*?\.command-header \{/)?.[0] ?? "";
  assert.ok(compact.includes('[data-panel-head]'));
  assert.ok(compact.includes('[data-panel-body]'));
  assert.ok(compact.includes('[data-point-row]'));
  assert.ok(compact.includes('[data-article-row]'));
  // Щільність не змінює кегль: жодного font-size у правилах режиму.
  assert.doesNotMatch(compact, /font-size/);
});

test("colour is driven by tokens, not by hardcoded hex values in the markup", () => {
  for (const path of [
    "app/page.tsx",
    "components/vlk/tdv-dialog.tsx",
    "components/vlk/citizen-preparation.tsx",
    "components/vlk/normative-passport-dialog.tsx",
    "lib/vlk-outcomes.ts",
  ]) {
    assert.doesNotMatch(source(path), /\[#[0-9a-fA-F]{6}\]/, `${path} містить прямий hex у класах`);
  }
});

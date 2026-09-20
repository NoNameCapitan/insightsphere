import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("command artwork exists as real PNG assets and is included in the shell cache", () => {
  const sw = source("public/sw.js");
  for (const name of ["vlk-command-emblem.png", "vlk-command-header.png"]) {
    const bytes = readFileSync(new URL(`../public/${name}`, import.meta.url));
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.ok(bytes.readUInt32BE(16) > 0);
    assert.ok(bytes.readUInt32BE(20) > 0);
    assert.ok(sw.includes(`"/${name}"`));
  }
});

test("the command header leaves responsive sticky positioning to layout utilities", () => {
  const css = source("app/globals.css");
  const headerRule = css.match(/\.command-header\s*\{([^}]+)\}/)?.[1];
  assert.ok(headerRule);
  assert.doesNotMatch(headerRule, /position\s*:/);
  assert.match(source("app/page.tsx"), /command-header sticky top-0[^"\n]*xl:relative/);
});

test("both decorative animations have an explicit reduced-motion opt-out", () => {
  const css = source("app/globals.css");
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.command-header::before,\s*\.command-selected-rule\s*\{\s*animation:\s*none\s*!important;/);
});

test("the emblem has text alternatives and decorative instances are hidden", () => {
  const component = source("components/vlk/command-brand.tsx");
  assert.match(component, /if\(decorative\) return <Image[^;]+alt="" aria-hidden/);
  assert.match(component, /<svg[^>]+role="img" aria-label="Емблема VLK Навігатора 402"/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { attachClinicalMotion } from "../components/vlk/clinical-motion-controller.ts";

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const page = read("app/page.tsx");
const css = read("app/globals.css");
const icons = read("components/vlk/specialty-icon.tsx");
const controller = read("components/vlk/clinical-motion-controller.ts");
const ticker = read("components/vlk/edition-ticker.tsx");
const glyph = (from, to) => icons.slice(icons.indexOf(`function ${from}`), icons.indexOf(to));

test("the DOM controller imports natively from TypeScript under the real test runner", () => {
  assert.equal(typeof attachClinicalMotion, "function");
});

test("edition ticker is unconditional immediately after the header, before dashboard branching", () => {
  const body = page.slice(page.indexOf("</header>"));
  assert.equal((page.match(/<EditionTicker\s*\/>/g) ?? []).length, 1);
  assert.ok(body.indexOf("<EditionTicker />") > 0);
  assert.ok(body.indexOf("<EditionTicker />") < body.indexOf("{showDashboard ? ("));
});

test("recorded edition and source-check metadata are distinct and never replaced with today's date", () => {
  assert.match(ticker, /\{EDITION\}/);
  assert.match(ticker, /\{SOURCE_CHECK\.checkedAt\}/);
  assert.match(ticker, /не перевірка в реальному часі/);
  assert.doesNotMatch(ticker, /new Date|Date\.now|fetch\(/);
});

test("static ticker neither duplicates content nor implicitly announces a live status", () => {
  assert.doesNotMatch(ticker, /aria-live|role="(?:status|alert|log|marquee)"|data-moving|ResizeObserver/);
  assert.match(ticker, /role="region"/);
  assert.match(ticker, /aria-label="Редакція нормативного корпусу"/);
  assert.equal((ticker.match(/className="edition-ticker-copy"/g) ?? []).length, 1);
  assert.match(css, /\.edition-ticker-viewport[^}]*overflow-wrap: anywhere/s);
  assert.match(css, /\.edition-ticker-link\s*\{[^}]*min-height: 44px/s);
  assert.doesNotMatch(css, /@keyframes ticker-drift/);
});

test("icon growth has a fixed-size heading, not a card-scale or grid-size change", () => {
  assert.match(page, /specialty-card-heading mb-3 flex items-center justify-between/);
  assert.match(css, /\.specialty-card-heading \{ height: 44px; \}/);
  assert.match(css, /\.specialty-card-heading \{ height: 40px; \}/);
  assert.match(css, /\.specialty-icon \.si\s*\{\s*width: 38px;\s*height: 38px;/);
  assert.match(css, /\.specialty-icon \.si \{ width: 34px; height: 34px; \}/);
  assert.match(css, /\.specialty-card \.specialty-icon\s*\{\s*width: 50px;\s*height: 50px;/);
  assert.match(css, /\.specialty-card \.specialty-icon \{ width: 46px; height: 46px; \}/);
});

test("psychiatry has two equal-length dialog strokes and no neural nodes", () => {
  const source = glyph("Psychiatrist", "function Ophthalmologist");
  assert.equal((source.match(/si-dialog-(?:one|two)/g) ?? []).length, 2);
  assert.equal((source.match(/h3\.8"/g) ?? []).length, 2);
  assert.match(source, /si-dialog-bubble/);
  assert.match(source, /si-psy-brain/);
  assert.doesNotMatch(source, /si-neural|<circle/);
});

test("dermatology has surface + two skin layers, at most two texture dots, and a lens", () => {
  const source = glyph("Dermatologist", "const GLYPHS");
  for (const cls of ["si-magnifier", "si-skin-surface", "si-skin-layer-one", "si-skin-layer-two"]) {
    assert.match(source, new RegExp(cls));
  }
  assert.equal((source.match(/<circle/g) ?? []).length, 3, "one lens and two texture dots");
  assert.match(source, /r="6\.5"/);
});

test("surgery separates the short handle, broad blade and neck without mixing tools", () => {
  const source = glyph("Surgeon", "function Neurologist");
  for (const cls of ["si-scalpel-handle", "si-scalpel-blade", "si-scalpel-neck", "si-gleam"]) {
    assert.match(source, new RegExp(cls));
  }
  assert.doesNotMatch(source, /scissor|blood|sparkle/);
});

test("arrow remains a secondary 2px transition rather than a long animation", () => {
  const arrow = css.match(/\.specialty-card:hover \.specialty-arrow,[\s\S]*?\}/)?.[0];
  assert.ok(arrow);
  assert.match(arrow, /translateX\(2px\)/);
  assert.match(arrow, /opacity: \.5/);
  assert.doesNotMatch(arrow, /animation:/);
});

test("clinical signature travels as a short highlight, not a growing progress bar", () => {
  const signature = css.match(/\.clinical-signature\s*\{[\s\S]*?\}/)?.[0];
  assert.match(signature, /width: 14px/);
  const frames = css.slice(css.indexOf("@keyframes clinical-signature {"), css.indexOf("@media (prefers-reduced-motion: no-preference)", css.indexOf("@keyframes clinical-signature {")));
  assert.match(frames, /translateX/);
  assert.doesNotMatch(frames, /scaleX/);
});

test("ear waves are not accidentally dotted by an unnormalised stroke-dasharray", () => {
  const dashed = css.match(/\.si :is\(([^)]*)\)\s*\{\s*stroke-dasharray: 1;/)?.[1];
  assert.ok(dashed);
  assert.doesNotMatch(dashed, /si-sound-wave/);
});

test("animation terminal opacity agrees with the idle styling", () => {
  assert.match(css, /\.si :is\(\.si-neural-signal, \.si-psy-center, \.si-skin-layer-one, \.si-skin-layer-two\) \{ opacity: \.72; \}/);
  assert.match(css, /\.si \.si-pulp \{ opacity: \.65; \}/);
  assert.match(css, /\.si \.si-enamel-glint \{ opacity: \.5; \}/);
});

test("motion lifecycle handles completion, cancellation, blur and detach without timers", () => {
  for (const event of ["animationend", "animationcancel", "pointercancel", "visibilitychange", "blur"]) {
    assert.match(controller, new RegExp(`addEventListener\\("${event}"`));
    assert.match(controller, new RegExp(`removeEventListener\\("${event}"`));
  }
  assert.match(controller, /observer\.disconnect\(\)/);
  assert.match(controller, /!root\.contains\(active\)/);
  assert.match(controller, /if \(!running\) settle\(false\)/);
  assert.doesNotMatch(controller, /setTimeout\(|setInterval\(|localStorage|preventDefault\(|stopPropagation\(/);
});

test("child-to-child crossings cannot restart a completed card", () => {
  assert.match(controller, /targetFor\(event\.relatedTarget\) !== target/);
  assert.match(controller, /targetFor\(event\.target\) === active/);
});

test("reduced motion removes signature, arrow transforms and dash phases but retains controls", () => {
  const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduced, /\.specialty-card \.specialty-arrow \{ transform: none !important/);
  assert.match(reduced, /\.specialty-card \.clinical-signature \{ display: none;/);
  assert.match(reduced, /stroke-dasharray: none !important/);
  assert.match(reduced, /focus-visible/);
});

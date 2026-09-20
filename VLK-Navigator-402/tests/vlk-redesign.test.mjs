import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const css = read("app/globals.css");
const page = read("app/page.tsx");
const icons = read("components/vlk/specialty-icon.tsx");
const motion = read("components/vlk/clinical-motion.tsx") + read("components/vlk/clinical-motion-controller.ts");
const pkg = JSON.parse(read("package.json"));
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const ticker = strip(read("components/vlk/edition-ticker.tsx"));

const SPECIALTIES = [
  "therapist",
  "surgeon",
  "neurologist",
  "psychiatrist",
  "ophthalmologist",
  "ent",
  "dentist",
  "dermatologist",
];

test("Clinical Motion Atlas має всі 8 specialty icons на спільному 24×24 контурі", () => {
  for (const id of SPECIALTIES) assert.match(icons, new RegExp(`${id}:`), id);
  assert.match(icons, /viewBox: "0 0 24 24"/);
  assert.match(icons, /fill: "none"/);
  assert.match(icons, /stroke: "currentColor"/);
  assert.match(icons, /strokeWidth: 1\.9/);
  assert.match(icons, /strokeLinecap: "round"/);
  assert.match(icons, /strokeLinejoin: "round"/);
  assert.match(icons, /aria-hidden="true"/);
  assert.match(icons, /focusable="false"/);
});

test("SVG не використовують декоративні fill і зберігають один SpecialtyIcon API", () => {
  assert.doesNotMatch(icons, /fill="(?!none)/);
  assert.match(page, /<SpecialtyIcon id=\{item\.id\} \/>/);
  assert.match(page, /data-specialty=\{item\.id\}/);
});

test("кожна specialty має окремі клінічно осмислені motion-класи", () => {
  for (const name of [
    "si-stethoscope-tube", "si-chest-piece", "si-ecg",
    "si-scalpel-blade", "si-gleam", "si-incision",
    "si-brain-core", "si-neural-signal", "si-neural-node",
    "si-dialog-one", "si-dialog-two", "si-dialog-bubble",
    "si-pupil", "si-eye-glint",
    "si-ear-inner", "si-sound-wave-one", "si-sound-wave-two",
    "si-tooth", "si-enamel-glint", "si-pulp",
    "si-magnifier", "si-skin-layer-one", "si-skin-layer-two",
  ]) assert.match(icons, new RegExp(name), name);
});

test("усі specialty animation declarations мають 1700–2400 мс і не loop-яться", () => {
  const rules = [...css.matchAll(/animation: (si-[\w-]+) (\d+)ms ([^;]*);/g)];
  assert.ok(rules.length >= 20, "очікуються фазові анімації восьми спеціальностей");
  for (const [rule, , duration, tail] of rules) {
    const ms = Number(duration);
    assert.ok(ms >= 1700 && ms <= 2400, `тривалість поза 1700–2400 мс: ${rule}`);
    assert.doesNotMatch(tail, /infinite/, `нескінченна анімація: ${rule}`);
  }
});

test("hover і focus-visible використовують один і той самий motion trigger", () => {
  assert.match(css, /\.specialty-card:is\(:hover, :focus-visible, \[data-motion-active\]\)/);
  for (const id of SPECIALTIES) assert.match(css, new RegExp(`\\.si-${id}`), id);
  assert.match(motion, /root\.addEventListener\("focusin", focusIn\)/);
  assert.match(motion, /root\.addEventListener\("pointerover", pointerOver\)/);
});

test("Clinical Signature присутній, одноразовий і не є progress bar", () => {
  assert.match(page, /className="clinical-signature" aria-hidden="true"/);
  assert.match(css, /@keyframes clinical-signature/);
  assert.match(css, /animation: clinical-signature 1100ms/);
  assert.doesNotMatch(css, /clinical-signature[^\n]*infinite/);
});

test("стоматолог не має emoji-like sparkle", () => {
  const dentist = icons.slice(icons.indexOf("function Dentist"), icons.indexOf("function Dermatologist"));
  assert.doesNotMatch(dentist, /sparkle|star/i);
  assert.match(dentist, /si-enamel-glint/);
  assert.match(dentist, /si-pulp/);
});

test("психіатр відрізняється від невролога через dialog signal", () => {
  const psychiatrist = icons.slice(icons.indexOf("function Psychiatrist"), icons.indexOf("function Ophthalmologist"));
  assert.match(psychiatrist, /si-dialog-one/);
  assert.match(psychiatrist, /si-dialog-two/);
  assert.match(psychiatrist, /si-dialog-bubble/);
  assert.doesNotMatch(psychiatrist, /si-neural-signal/);
});

test("дерматолог має magnifier і спрощені шари шкіри", () => {
  const derm = icons.slice(icons.indexOf("function Dermatologist"), icons.indexOf("const GLYPHS"));
  assert.match(derm, /si-magnifier/);
  assert.match(derm, /si-skin-layer-one/);
  assert.match(derm, /si-skin-layer-two/);
});

test("ЛОР має ear-specific inner contour і максимум дві motion-хвилі", () => {
  const ent = icons.slice(icons.indexOf("function Ent"), icons.indexOf("function Dentist"));
  assert.match(ent, /si-ear-inner/);
  assert.match(ent, /si-sound-wave-one/);
  assert.match(ent, /si-sound-wave-two/);
  assert.equal((ent.match(/si-sound-wave-/g) ?? []).length, 2);
});

test("prefers-reduced-motion прибирає decorative motion, але не focus state", () => {
  const blocks = css.split("@media (prefers-reduced-motion: reduce)").slice(1).join("\n");
  assert.match(blocks, /\.specialty-card \.si \*/);
  assert.match(blocks, /\.clinical-signature/);
  assert.match(blocks, /animation: none !important/);
  assert.match(blocks, /focus-visible/);
  assert.match(blocks, /background: var\(--si-hover-bg\)/);
});

test("motion не змінює геометрію карток і не створює layout shift", () => {
  const atlas = css.slice(css.indexOf("Clinical Motion Atlas v27"), css.indexOf("Доступність: іконки"));
  const keyframes = [...atlas.matchAll(/@keyframes[\s\S]*?\n\}/g)].map((m) => m[0]).join("\n");
  assert.doesNotMatch(keyframes, /\b(?:width|height|margin|padding|top|left|right|bottom)\s*:/);
  assert.match(atlas, /transform:/);
  assert.match(atlas, /opacity:/);
});

test("touch target та dark/light specialty surfaces збережені", () => {
  const coarse = css.slice(css.indexOf("@media (pointer: coarse)"));
  assert.match(coarse, /min-height: 44px/);
  assert.match(css, /\.specialty-icon \{[\s\S]*?--si-ink:/);
  assert.match(css, /\.dark \.specialty-icon \{[\s\S]*?--si-ink:/);
});

test("specialty manager yields to the independently completing snake cycle", () => {
  assert.match(motion, /let active: HTMLElement \| null = null/);
  assert.match(motion, /settle\(false\);[\s\S]*active = target/);
  assert.match(motion, /const selector = "\.specialty-card"/);
  assert.match(motion, /\[data-snake-running\]/);
});

test("npm test використовує Node TypeScript stripping для .mjs → .ts imports", () => {
  assert.match(pkg.scripts.test, /--experimental-strip-types/);
  assert.match(pkg.scripts.test, /node .*--test tests\/\*\.test\.mjs/);
});

test("стрічка редакції розділяє дату корпусу і дату перевірки джерела", () => {
  assert.match(ticker, /у корпусі навігатора — редакція від/);
  assert.match(ticker, /остання перевірка офіційного джерела/);
  assert.match(ticker, /SOURCE_CHECK\.checkedAt/);
  assert.match(ticker, /\{EDITION\}/);
  assert.doesNotMatch(ticker, /актуальн/i);
});

test("стрічка — статичний labelled region, без явного або implicit live-region", () => {
  assert.doesNotMatch(ticker, /aria-live|role="(?:status|alert|log)"/);
  assert.match(ticker, /role="region"/);
  assert.match(ticker, /aria-label="Редакція нормативного корпусу"/);
  assert.match(ticker, /Відкрити джерело/);
  assert.match(ticker, /LIVE_EDITION_SOURCE_URL/);
});

test("emblem uses connected vector layers and an accessible name", () => {
  const brand = read("components/vlk/command-brand.tsx");
  assert.match(brand, /aria-label="Емблема VLK Навігатора 402"/);
  assert.match(brand, /data-snake-body/);
  assert.match(brand, /data-snake-head/);
  assert.match(brand, /data-static-cup/);
  assert.doesNotMatch(brand, /<image|SNAKE_COILS|SNAKE_HEAD/);
  assert.match(brand, /prefers-reduced-motion: reduce/);
  assert.match(brand, /cancelAnimationFrame/);
});

test("червоний лишається тільки для критичних статусів", () => {
  assert.doesNotMatch(css, /--brand-(bar|rule|tint):\s*#[a-f0-9]*(c|d|e|f)[0-9a-f]{1}[0-2]{2}[0-2]{2};/i);
  assert.match(css, /--critical-ink/);
});

#!/usr/bin/env node
// Derives dark-theme overrides from the light stylesheets (v1.35).
//
//   npm run theme:dark          regenerate
//   npm run theme:check         fail if the generated output is stale
//
// Why: many v1.2x–1.34 styles hard-code light colours. Instead of a hand-kept
// copy of every rule, this script reads each stylesheet and, for every rule
// that sets a colour, emits the same rule for <html data-theme="dark"> with
// the colour mapped by role:
//   text  (color, outline, caret, text-decoration; SVG fill/stroke are left as drawn)
//         dark ink becomes light ink of the same hue; light text stays.
//   fill  (background*)   light surfaces become night surfaces; dark fills
//         (buttons, the hero) stay as they are.
//   line  (border*)       light hairlines become dark hairlines.
// Shadows, keyframes and already-dark rules are left alone. A rule can opt
// out explicitly with the declaration `--dark-keep: 1`.
//
// Output: global sheets → src/app/theme-dark.generated.css (imported after the
// light sheets and before the hand-written src/app/theme.css). CSS modules get
// a marked block at the END of the same file.
//
// Specificity: generated selectors use :where(html[data-theme="dark"]), which
// adds nothing, so every override has exactly the specificity of the light rule
// it mirrors and wins only by coming later. State precedence is therefore the
// same in both themes (a pressed button still beats the base button), and any
// hand-written html[data-theme="dark"] rule always beats the generated one.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const GLOBAL_SOURCES = ["src/app/globals.css", "src/app/care-system.css"];
const GLOBAL_OUT = "src/app/theme-dark.generated.css";
const START = "/* @generated dark-theme:start — do not edit; run `npm run theme:dark` */";
const END = "/* @generated dark-theme:end */";
const DARK = 'html[data-theme="dark"]';
const DARK_WHERE = `:where(${DARK})`;
/** Hue of the evening palette's surfaces (--c-surface 29 27 22 ≈ 44°). */
const WARM_HUE = 44;

// ── colour maths ────────────────────────────────────────────────────────────
const NAMED = { white: "#ffffff", black: "#000000" };
const COLOR_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|rgba?\([^)]*\)|\b(?:white|black)\b/g;

function parseColor(token) {
  if (NAMED[token]) token = NAMED[token];
  if (token.startsWith("#")) {
    let h = token.slice(1);
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  const m = /rgba?\(([^)]*)\)/.exec(token);
  if (!m || m[1].includes("var(")) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const channel = (v) => (v.endsWith("%") ? (parseFloat(v) * 255) / 100 : parseFloat(v));
  const alpha = parts[3] === undefined ? 1 : parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
  const c = { r: channel(parts[0]), g: channel(parts[1]), b: channel(parts[2]), a: alpha };
  return [c.r, c.g, c.b, c.a].some(Number.isNaN) ? null : c;
}

function toHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function fromHsl({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

const hex = (n) => n.toString(16).padStart(2, "0");
function format({ r, g, b }, a) {
  const base = `#${hex(r)}${hex(g)}${hex(b)}`;
  return a >= 1 ? base : `${base}${hex(Math.round(a * 255))}`;
}

/**
 * Deep pine fills (heroes, feature cards) move towards evening olive-pine:
 * a little warmer, a little less saturated, the same depth. Null otherwise.
 */
function warmPine(c) {
  const { h, s, l } = toHsl(c);
  if (l > 0.3 || h < 140 || h > 190 || s <= 0.2 || c.a < 0.6) return null;
  return format(fromHsl({ h: h - 24, s: s * 0.6, l: l * 0.92 }), c.a);
}

/** Maps one colour for a role; returns null when it should stay as is. */
export function mapColor(token, role) {
  const c = parseColor(token);
  if (!c || c.a === 0) return null;
  const { h, s, l } = toHsl(c);
  if (role === "text") {
    if (l >= 0.62) return null; // already light: sits on a dark fill
    return format(fromHsl({ h, s: Math.min(s, 0.55) * 0.55, l: Math.min(0.92, 0.97 - 0.55 * l) }), c.a);
  }
  if (role === "fill") {
    // Dark fills (buttons, the hero) and vivid accents (the emergency
    // gradient) already work on a night canvas: keep them.
    const pine = warmPine(c);
    if (pine) return pine;
    if (l <= 0.5 || (l < 0.82 && s >= 0.3)) return null;
    // Translucent white washes become faint light washes on the night canvas.
    if (c.a < 0.6 && s < 0.25) return format({ r: 241, g: 234, b: 221 }, Math.min(c.a, 0.12));
    // Near-neutral surfaces take the warm umber of --c-surface ("Вечірній дім").
    const neutral = s < 0.12 || l > 0.93;
    return format(fromHsl({ h: neutral ? WARM_HUE : h, s: neutral ? 0.16 : Math.min(s, 0.45) * 0.4, l: 0.1 + (1 - l) * 0.45 }), c.a);
  }
  if (role === "line") {
    if (l <= 0.5 || (l < 0.82 && s >= 0.3)) return null;
    const neutral = s < 0.12 || l > 0.93;
    return format(fromHsl({ h: neutral ? WARM_HUE : h, s: neutral ? 0.12 : Math.min(s, 0.35) * 0.5, l: 0.19 + (1 - l) * 0.4 }), c.a);
  }
  return null;
}

/** True when a fill value holds an opaque light colour the mapper leaves as is. */
function keptLightFill(value) {
  return (value.match(COLOR_RE) ?? []).some((token) => {
    const c = parseColor(token);
    if (!c || c.a < 0.6) return false;
    return toHsl(c).l > 0.5 && mapColor(token, "fill") === null;
  });
}

function roleOf(property) {
  const p = property.toLowerCase();
  // Colour custom properties (e.g. --events-ink) take their role from the name.
  if (p.startsWith("--")) {
    if (/(ink|text|muted|fg|foreground|accent-text|heading)$/.test(p)) return "text";
    if (/(line|border|rule|hairline)$/.test(p)) return "line";
    if (/(bg|background|paper|surface|canvas|wash|tint)$/.test(p)) return "fill";
    return null;
  }
  if (/^(color|caret-color|outline|outline-color|text-decoration|text-decoration-color|-webkit-text-fill-color|column-rule-color|accent-color)$/.test(p)) return "text";
  if (/^background(-color|-image)?$/.test(p)) return "fill";
  if (/^border(-(top|right|bottom|left|block|inline)(-start|-end)?)?(-color)?$/.test(p)) return "line";
  return null;
}

function mapDeclaration(property, value) {
  const role = roleOf(property);
  if (!role || value.includes("var(")) return null;
  // A gradient that fades to transparent is light (a glow, beam, sheen) over a
  // surface: the light stays as is; only opaque deep-pine stops are warmed.
  const glow = role === "fill" && /gradient\(/.test(value) && /\btransparent\b|#0000\b|rgb\([^)]*\/\s*0\)/.test(value);
  let changed = false;
  const mapped = value.replace(COLOR_RE, (token) => {
    const parsed = glow ? parseColor(token) : null;
    const next = glow ? (parsed ? warmPine(parsed) : null) : mapColor(token, role);
    if (!next) return token;
    changed = true;
    return next;
  });
  return changed ? mapped : null;
}

// ── a small CSS walker (enough for this codebase's flat rules + @media) ─────
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function parseBlocks(css) {
  const out = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) break;
    const head = css.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < css.length && depth) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    if (head.startsWith("@")) out.push({ at: head, children: /^@(media|supports|layer)\b/.test(head) ? parseBlocks(body) : null });
    else out.push({ selector: head, body });
    i = j;
  }
  return out;
}

function splitDeclarations(body) {
  const decls = [];
  let depth = 0, start = 0;
  for (let i = 0; i <= body.length; i++) {
    const ch = body[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if ((ch === ";" || i === body.length) && depth === 0) {
      const part = body.slice(start, i).trim();
      start = i + 1;
      const colon = part.indexOf(":");
      if (colon > 0) decls.push([part.slice(0, colon).trim(), part.slice(colon + 1).trim()]);
    }
  }
  return decls;
}

function splitSelectors(selector) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i <= selector.length; i++) {
    const ch = selector[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if ((ch === "," || i === selector.length) && depth === 0) {
      parts.push(selector.slice(start, i).trim());
      start = i + 1;
    }
  }
  return parts.filter(Boolean);
}

function prefixSelector(sel, isModule) {
  if (/data-theme/.test(sel) || sel.startsWith("@")) return null; // already themed / not a selector
  // The page canvas (html, body) is owned by the hand-written theme.css.
  if (/^(:root|html|body)$/.test(sel)) return null;
  if (/^html[\s.:[]/.test(sel)) return isModule ? null : DARK + sel.slice(4);
  if (/^:root[\s.:[]/.test(sel)) return isModule ? null : DARK + sel.slice(5);
  return isModule ? `:global(${DARK_WHERE}) ${sel}` : `${DARK_WHERE} ${sel}`;
}

function emit(blocks, isModule, indent = "") {
  let css = "";
  for (const block of blocks) {
    if (block.at) {
      if (!block.children) continue; // @keyframes, @font-face…
      if (/^@media\s+print\b/.test(block.at)) continue; // paper stays light
      const inner = emit(block.children, isModule, indent + "  ");
      if (inner.trim()) css += `${indent}${block.at} {\n${inner}${indent}}\n`;
      continue;
    }
    if (/data-theme/.test(block.selector)) continue;
    const all = splitDeclarations(block.body);
    // Opt-out: a rule that declares `--dark-keep: 1` already works on both
    // canvases (e.g. a layer that always sits on the dark hero stage).
    if (all.some(([p]) => p === "--dark-keep")) continue;
    // A rule that keeps its own light fill (a gold button, a pale chip on the
    // dark hero) keeps its dark text too, or the pair would lose contrast.
    // Gradient-filled type (background-clip: text) is glyph colour on an
    // always-dark hero, not a surface: leave its fill alone.
    const clipsText = all.some(([p, v]) => /background-clip$/i.test(p) && /\btext\b/.test(v));
    const keepsLightFill = all.some(([p, v]) => roleOf(p) === "fill" && !v.includes("var(") && keptLightFill(v));
    const decls = all
      .map(([p, v]) => [p, (keepsLightFill && roleOf(p) === "text") || (clipsText && roleOf(p) === "fill") ? null : mapDeclaration(p, v)])
      .filter(([, v]) => v !== null);
    // The `background` shorthand resets every background longhand, so re-state
    // the rule's own longhands (e.g. background-clip: text on gradient type).
    if (decls.some(([p]) => p.toLowerCase() === "background")) {
      for (const [p, v] of all) {
        if (/^(-webkit-)?background-(clip|size|position|repeat|origin|attachment)$/i.test(p)) decls.push([p, v]);
      }
    }
    if (!decls.length) continue;
    const selectors = splitSelectors(block.selector).map((s) => prefixSelector(s, isModule)).filter(Boolean);
    if (!selectors.length) continue;
    css += `${indent}${selectors.join(", ")} { ${decls.map(([p, v]) => `${p}: ${v};`).join(" ")} }\n`;
  }
  return css;
}

function moduleFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...moduleFiles(path));
    else if (name.endsWith(".module.css")) files.push(path);
  }
  return files;
}

function withoutGenerated(css) {
  const a = css.indexOf(START);
  if (a < 0) return css;
  const b = css.indexOf(END, a);
  const rest = (css.slice(0, a) + css.slice(b + END.length).replace(/^\n+/, "")).replace(/\s+$/, "");
  return `${rest}\n`;
}

export function buildOutputs() {
  const outputs = new Map();
  let globalCss = `/* Generated by scripts/gen-dark-theme.mjs from ${GLOBAL_SOURCES.join(", ")}.\n   Do not edit: run \`npm run theme:dark\`. Hand-written dark rules live in theme.css. */\n`;
  for (const file of GLOBAL_SOURCES) {
    const source = readFileSync(join(ROOT, file), "utf8");
    globalCss += `\n/* ── from ${file} ── */\n` + emit(parseBlocks(stripComments(source)), false);
  }
  outputs.set(GLOBAL_OUT, globalCss);
  for (const path of moduleFiles(join(ROOT, "src"))) {
    const file = relative(ROOT, path);
    const source = withoutGenerated(readFileSync(path, "utf8"));
    const generated = emit(parseBlocks(stripComments(source)), true);
    outputs.set(file, generated.trim() ? `${source}\n${START}\n${generated}${END}\n` : source);
  }
  return outputs;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes("--check");
  const stale = [];
  for (const [file, content] of buildOutputs()) {
    const path = join(ROOT, file);
    let current = "";
    try { current = readFileSync(path, "utf8"); } catch { /* new file */ }
    if (current === content) continue;
    if (check) stale.push(file);
    else writeFileSync(path, content);
  }
  if (check) {
    if (stale.length) {
      console.error(`Dark theme is out of date in: ${stale.join(", ")}\nRun: npm run theme:dark`);
      process.exit(1);
    }
    console.log("Dark theme overrides are up to date.");
  } else {
    console.log("Dark theme overrides generated.");
  }
}

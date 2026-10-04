import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const css = read('app/globals.css');
const page = read('app/page.tsx');
const sheet = postcss.parse(css);

// Resolve repeated exact root selectors in source order, not only the first block.
function palette(dark = false) {
  const values = {};
  sheet.walkRules(rule => {
    if (rule.parent.type !== 'root' || ![':root', ...(dark ? ['.dark'] : [])].includes(rule.selector)) return;
    rule.walkDecls(/^--/, decl => { values[decl.prop.slice(2)] = decl.value; });
  });
  return values;
}
function lum(hex) {
  assert.match(hex, /^#[0-9a-f]{6}$/i);
  const c = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
}
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
function declarations(selector, width, coarse = false) {
  const values = {};
  sheet.walkRules(rule => {
    if (!rule.selectors.includes(selector)) return;
    let node = rule.parent;
    while (node?.type === 'atrule') {
      if (node.name === 'media') {
        for (const [, edge, limit] of node.params.matchAll(/(min|max)-width:\s*(\d+)px/g)) {
          if ((edge === 'min' && width < +limit) || (edge === 'max' && width > +limit)) return;
        }
        if (node.params.includes('pointer: coarse') && !coarse) return;
        if (node.params.includes('prefers-reduced-motion')) return;
      }
      node = node.parent;
    }
    rule.walkDecls(decl => { values[decl.prop] = decl.value; });
  });
  return values;
}

test('effective light/dark palettes retain AA body, muted, action, brand and status text', () => {
  const pairs = [
    ['foreground', 'background'], ['foreground', 'surface'], ['ink-soft', 'surface-muted'],
    ['ink-muted', 'background'], ['ink-muted', 'surface'], ['ink-muted', 'surface-muted'],
    ['primary-foreground', 'primary'], ['primary-foreground', 'primary-hover'],
    ['accent-ink', 'surface'], ['accent-ink-strong', 'secondary'],
    ['brand-bar-ink', 'brand-bar'], ['brand-bar-soft', 'brand-bar'], ['brand-tint', 'brand-bar'],
    ['hero-ink', 'hero-surface'], ['hero-muted', 'hero-surface'], ['hero-gold', 'hero-surface'],
    ...['warning', 'critical', 'positive'].flatMap(t => [[`${t}-ink`, `${t}-bg`], [`${t}-ink`, `${t}-badge`]]),
  ];
  for (const dark of [false, true]) {
    const p = palette(dark);
    for (const [a, b] of pairs) assert.ok(ratio(p[a], p[b]) >= 4.5, `${dark ? 'dark' : 'light'} ${a}/${b}: ${ratio(p[a], p[b]).toFixed(2)}`);
  }
});

test('focus is explicit on restored graphite chrome and neutral reading controls', () => {
  for (const dark of [false, true]) {
    const p = palette(dark);
    assert.ok(ratio(p['brand-tint'], p['brand-bar']) >= 3);
    assert.ok(ratio(p['ring'], p['surface']) >= 3);
  }
  assert.match(css, /\.command-header \.header-actions button:focus-visible \{ outline: 2px solid var\(--brand-tint\)/);
  assert.match(css, /\.reader-find-toolbar :is\(input, button\):focus-visible/);
});

test('national symbol preserves exact sourced geometry and only occurs on the home banner', () => {
  const symbol = read('components/vlk/ukraine-trident.tsx');
  const original = read('review/assets/ukraine-trident-source.svg');
  assert.equal(symbol.match(/data-trident-symbol fill="currentColor" d="([^"]+)"/)[1], original.match(/ d="([^"]+)"/)[1]);
  assert.match(symbol, /viewBox="0 0 56 68"/);
  assert.match(symbol, /role="img" aria-label="Тризуб України на щиті" focusable="false"/);
  assert.match(symbol, /fill="currentColor"/);
  assert.doesNotMatch(symbol, /useEffect|useState|fetch\(|onClick|animate|href=/);
  assert.equal((page.match(/<UkraineTrident/g) ?? []).length, 1);
  assert.ok(page.indexOf('<UkraineTrident') > page.indexOf('<div className="welcome-screen'));
  assert.match(page, /Довідкова навігація, не рішення ВЛК/);
  assert.match(page, /<HeroEmblem \/>/);
  assert.match(page, /<CommandBrand size=\{96\} priority/);
});

test('hero winning cascade is compact and width-bounded at 390, 1024 and 1366', () => {
  for (const width of [390, 1024, 1366]) {
    const hero = declarations('.welcome-screen .vlk-brand-hero', width);
    assert.equal(hero.background, 'var(--hero-surface)');
    assert.equal(hero['min-height'], '144px');
    assert.equal(hero['grid-template-columns'], width < 640 ? 'minmax(0, 1fr) 76px' : 'minmax(240px, 1fr) minmax(220px, 1.1fr) 116px');
    assert.equal(declarations('.welcome-screen .vlk-brand-hero h2', width)['font-size'], width < 640 ? '30px' : '36px');
  }
  assert.equal(declarations('.welcome-screen .vlk-brand-hero', 768)['grid-template-columns'], 'minmax(0, 1fr) 92px');
  assert.equal(declarations('.vlk-brand-guide', 390)['grid-column'], '1 / -1');
  assert.equal(declarations('.app-shell[data-workspace="true"] .command-brand-vector', 1366).width, '44px');
});

test('mobile touch controls and first-use reading widths are not reduced for visual density', () => {
  assert.equal(declarations('#vlk-search', 390)['min-height'], '44px');
  assert.equal(declarations('.header-actions > button', 390)['min-height'], '44px');
  assert.equal(declarations('.home-search-examples button', 390)['min-height'], '44px');
  assert.equal(declarations('.home-search-examples button', 1366, true)['min-height'], '44px');
  assert.match(css, /\.article-content \.normative-context-result p,[\s\S]*?max-width: 82ch/);
  assert.match(css, /\.reader-find-input input \{ font-size: 16px; \}/);
  assert.match(css, /\.article-content \[data-point-row\]\[aria-expanded="true"\]|\[data-point-row\]\[aria-expanded="true"\] \.point-preview/);
});

test('expanded point uses theme surface without changing clinical markup and warnings', () => {
  assert.match(page, /className="point-detail-surface border-t/);
  assert.doesNotMatch(page, /bg-white\/70|vlk-brand-network/);
  assert.equal(declarations('.point-detail-surface', 1366).background, 'var(--surface)');
  for (const content of ['<ReviewContextResult', '<PointTdvDetails', 'Це не постанова ВЛК', '<FullExplanationDialog', '<OutcomeBadge']) assert.ok(page.includes(content));
});

test('no new ambient motion or altered medical emblem controller', () => {
  assert.doesNotMatch(css, /\banimation:[^;]*infinite/);
  assert.match(css, /\.welcome-screen \{ animation: sheet-in 320ms var\(--ease-standard\); \}/);
  const hero = read('components/vlk/hero-emblem.tsx');
  assert.match(hero, /prefers-reduced-motion: reduce/);
  assert.match(hero, /sessionStorage\.getItem\(HERO_INTRO_KEY\)/);
  assert.match(css, /animation-iteration-count: 1 !important/);
  const mark = read('components/vlk/command-brand.tsx');
  assert.match(mark, /<KalynaMark/);
});


test('v38.6 restores every original v38.4 color token in both themes', () => {
  const reference = JSON.parse(read('review/v38.6-palette-reference.json'));
  for (const [selector, original] of Object.entries(reference.color_tokens)) {
    const actual = palette(selector === '.dark');
    for (const [key, value] of Object.entries(original)) assert.equal(actual[key.slice(2)], value, `${selector} ${key}`);
    for (const [key, value] of Object.entries(reference.hero_colors)) assert.equal(actual[key.slice(2)], value, `${selector} ${key}`);
  }
  assert.equal(palette()['hero-surface'], '#102b29');
  assert.equal(palette()['brand-bar'], '#16212c');
  assert.equal(palette(true)['brand-bar'], '#0c131a');
});

test('shield is a restrained static backdrop around an undistorted trident', () => {
  const symbol = read('components/vlk/ukraine-trident.tsx');
  const shield = symbol.indexOf('className="trident-shield"');
  const mark = symbol.indexOf('data-trident-symbol');
  assert.ok(shield >= 0 && shield < mark);
  assert.match(symbol, /transform="translate\(14 9\) scale\(0\.116\)"/);
  assert.equal(declarations('.ukraine-trident', 390).width, '36px');
  assert.equal(declarations('.ukraine-trident', 1366).width, '42px');
  assert.equal(declarations('.trident-shield', 1366).fill, '#13372e');
  assert.equal(declarations('.trident-shield', 1366)['stroke-width'], '1');
  assert.doesNotMatch(symbol, /filter=|linearGradient|animate|crown|seal|setInterval/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const css = read('app/globals.css');
const page = read('app/page.tsx');
const context = read('components/vlk/review-context.tsx');
const sheet = postcss.parse(css);
// Source-cascade invariants only. A browser must confirm computed geometry after deployment.
function declarations(selector) {
  const values = {};
  sheet.walkRules(rule => {
    if (rule.parent.type !== 'root' || !rule.selectors.includes(selector)) return;
    rule.walkDecls(decl => { values[decl.prop] = decl.value; });
  });
  return values;
}

test('review context grid and nested TDV children can shrink to a narrow sidebar', () => {
  assert.equal(declarations('.review-context-controls')['grid-template-columns'], 'minmax(0, 1fr)');
  for (const selector of ['.review-context-controls > *', '.review-context-controls .review-tdv-settings > div']) {
    const d = declarations(selector);
    assert.equal(d['min-width'], '0'); assert.equal(d['max-width'], '100%');
  }
  assert.equal(declarations('.review-context-controls :is(label, p, summary)')['overflow-wrap'], 'anywhere');
});

test('selected context value wraps in an auto-height control instead of hiding or clipping its label', () => {
  const trigger = declarations('.review-context-controls [data-slot="select-trigger"]');
  for (const [key, value] of Object.entries({width: '100%', 'min-width': '0', 'max-width': '100%', height: 'auto', 'min-height': '44px', 'white-space': 'normal', 'text-align': 'left'})) assert.equal(trigger[key], value);
  const value = declarations('.review-context-controls [data-slot="select-value"]');
  for (const [key, expected] of Object.entries({flex: '1', 'min-width': '0', display: 'block', 'white-space': 'normal', 'overflow-wrap': 'anywhere', overflow: 'visible', 'text-overflow': 'clip', '-webkit-line-clamp': 'unset'})) assert.equal(value[key], expected);
  assert.match(context, /\{context.examineeType === EDUCATION \? \(c.id === 9 \? 'Без офіцерського звання · ТДВ 9' : 'Офіцерське звання · ТДВ 10'\) : `\$\{c.id\}\. \$\{c.label\}`\}/);
  assert.match(read('components/ui/select.tsx'), /\[&_svg\]:shrink-0/);
});

test('TDV menu is width bounded, retains full options and supports keyboard and touch selection', () => {
  assert.match(context, /<SelectContent className="tdv-context-picker" position="popper" align="start">/);
  assert.equal(declarations('.tdv-context-picker').width, 'min(34rem, calc(100vw - 2rem))');
  const option = declarations('.tdv-context-picker [data-slot="select-item"]');
  assert.equal(option['min-height'], '44px'); assert.equal(option['white-space'], 'normal'); assert.equal(option['overflow-wrap'], 'anywhere');
  assert.match(context, /value=\{String\(context.tdvColumn \?\? 'none'\)\}/);
  assert.match(context, /tdvColumn: value === 'none' \? undefined : Number\(value\)/);
  assert.match(context, /TDV_COLUMNS.filter\(c => \[9, 10\].includes\(c.id\)\)/);
});

test('home keeps existing search and resume primary without introducing another action or section', () => {
  assert.equal(declarations('.app-shell[data-workspace="false"] #vlk-search').border, '2px solid var(--brand-tint)');
  assert.equal(declarations('.home-resume-action')['min-height'], '44px');
  assert.equal(declarations('.welcome-screen .home-tdv-action').background, 'transparent');
  assert.equal(declarations('.welcome-screen .home-tdv-action')['min-height'], '44px');
  assert.match(page, /className="home-resume-action[^\"]*"/);
  assert.match(page, /onClick=\{\(\) => changeSpecialty\(lastSpecialty\)\}/);
  assert.match(page, /className="home-tdv-action[^\"]*"/);
});

test('reading explanation remains filled primary while source and comparison are quiet but readable', () => {
  const primary = declarations('.article-toolbar > .explanation-action');
  assert.equal(primary.background, 'var(--primary)'); assert.equal(primary.color, 'var(--primary-foreground)'); assert.equal(primary['min-height'], '44px');
  for (const selector of ['.article-toolbar > .article-source-action', '.article-tools-body .comparison-action']) {
    const secondary = declarations(selector);
    assert.equal(secondary.background, 'transparent'); assert.equal(secondary.color, 'var(--ink-soft)'); assert.equal(secondary['box-shadow'], 'none');
  }
  assert.equal(declarations('.article-tools-body .comparison-action:hover:not(:disabled)').background, 'var(--surface-muted)');
  assert.equal(declarations('.article-tools-body [data-slot="button"]')['min-height'], '44px');
});

test('hierarchy changes add no palette, motion, hiding or diagnostic behavior', () => {
  const layer = css.split('/* v38.8')[1].split('/* v38.9')[0];
  postcss.parse('/* v38.8' + layer).walkDecls(decl => {
    assert.doesNotMatch(decl.prop, /^--|^animation|^transition/);
    assert.doesNotMatch(decl.value, /#[0-9a-f]{3,8}\b/i);
    if (decl.prop === 'display') assert.notEqual(decl.value, 'none');
    if (/^overflow(?:-[xy])?$/.test(decl.prop)) assert.doesNotMatch(decl.value, /hidden|clip/);
  });
  assert.equal(declarations('.command-header #vlk-search:focus-visible').outline, '2px solid var(--brand-tint)');
  assert.equal(declarations('.article-toolbar > .explanation-action:focus-visible').outline, '2px solid var(--accent-ink)');
  assert.match(page, /Це не постанова ВЛК/);
  assert.match(context, /Відсутність позначки не підтверджує придатність/);
});

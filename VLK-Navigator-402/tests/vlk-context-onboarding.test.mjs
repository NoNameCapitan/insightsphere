import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { nextContextControl, revealContextControl } from '../lib/vlk-context-navigation.ts';
import { resolveReviewContext, CONTRACT, EDUCATION } from '../lib/vlk-review-context.ts';
import { ARTICLE_RULES } from '../lib/vlk-rules.ts';
import { GRAPH_DESCRIPTIONS } from '../lib/vlk-category-data.ts';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('app/page.tsx');
const controls = read('components/vlk/review-context.tsx');
const css = read('app/globals.css');
const ctx = (scheduleGraph = 'all', examineeType = 'Військовозобов’язаний', tdvColumn) => ({ scheduleGraph, examineeType, tdvColumn });
const result = (article, point, context) => resolveReviewContext(article, ARTICLE_RULES[article].find(rule => rule.point === point), context);

test('a next-click hint follows real graph differences, not merely an unselected graph', () => {
  for (const [article, point] of [['73','а'], ['73','б'], ['82','а'], ['82','б']]) {
    const c = ctx(); const before = result(article, point, c);
    assert.equal(nextContextControl(c, before.scheduleNeedsGraph), 'schedule-graph');
    assert.deepEqual(result(article, point, c), before);
  }
  const c = ctx();
  assert.equal(nextContextControl(c, result('39', 'б', c).scheduleNeedsGraph), undefined);
  assert.equal(nextContextControl(c, result('38', 'б', c).scheduleNeedsGraph), undefined);
});

test('empty graph cells and category restrictions remain exact after following navigation', () => {
  for (const graph of ['II', 'III']) for (const point of ['а', 'б']) {
    const c = ctx(graph);
    assert.equal(result('82', point, c).scheduleText, '');
    assert.equal(nextContextControl(c, result('82', point, c).scheduleNeedsGraph), undefined);
  }
  const c = ctx('II'); assert.equal(result('73', 'б', c).scheduleText, 'Придатні');
  assert.equal(result('73', 'б', ctx('II', CONTRACT)).label, 'Контракт · не приймаються');
  assert.match(page, /\{contextual.scheduleText \|\| "— \(клітинка цієї графи порожня\)"\}/);
  assert.match(page, /Це не постанова ВЛК/);
});

test('legacy incompatible context and education TDV gaps get one relevant navigation target', () => {
  assert.equal(nextContextControl(ctx('I', CONTRACT), false), 'schedule-graph');
  assert.equal(nextContextControl(ctx('III', EDUCATION, 12), false), 'tdv-column');
  assert.equal(nextContextControl(ctx('III', EDUCATION), false), 'tdv-column');
  assert.equal(nextContextControl(ctx('all', EDUCATION), true), 'schedule-graph');
  for (const tdv of [9, 10]) assert.equal(nextContextControl(ctx('III', EDUCATION, tdv), false), undefined);
  const c = ctx('III', EDUCATION); const before = JSON.stringify(c);nextContextControl(c, false);assert.equal(JSON.stringify(c), before);
});

function fixture(nested = false) {
  let focused;
  const container = { scrollTop: 0, clientHeight: 200, scrollHeight: 1200, getBoundingClientRect: () => ({ top: 0 }) };
  const disclosure = { isConnected: true, open: false, querySelector: () => control, closest: () => container };
  const inner = { tagName: 'DETAILS', open: false, parentElement: disclosure };
  const control = { parentElement: nested ? inner : disclosure, getBoundingClientRect: () => ({ top: 600 - container.scrollTop, bottom: 644 - container.scrollTop }), focus: value => { focused = value; } };
  return { disclosure, inner, container, getFocused: () => focused };
}

test('jump opens outer/nested disclosures, reveals within own panel and focuses without document scroll', () => {
  for (const nested of [false, true]) {
    const f = fixture(nested);
    assert.equal(revealContextControl(f.disclosure, nested ? 'tdv-column' : 'schedule-graph'), true);
    assert.equal(f.disclosure.open, true); if (nested) assert.equal(f.inner.open, true);
    assert.equal(f.container.scrollTop, 452);
    assert.deepEqual(f.getFocused(), { preventScroll: true });
    assert.equal(revealContextControl(f.disclosure, 'schedule-graph'), true);
    assert.equal(f.container.scrollTop, 452, 'repeated reveal does not keep scrolling');
  }
});

test('jump handles detached/missing fields safely and never changes workspace or clinical state', () => {
  assert.equal(revealContextControl(null, 'schedule-graph'), false);
  assert.equal(revealContextControl({ isConnected: false }, 'schedule-graph'), false);
  const f = fixture();f.disclosure.querySelector = () => null;
  assert.equal(revealContextControl(f.disclosure, 'schedule-graph'), false);assert.equal(f.getFocused(), undefined);
  const handler = page.split('function showReviewControl(')[1].split('\n  }')[0];
  assert.match(handler, /max-width: 1023px/);assert.match(handler, /readingContextRef.current : sidebarContextRef.current/);
  assert.doesNotMatch(handler, /setQuery|setSelected|setScheduleGraph|setTdv|setSpecialty/);
  assert.doesNotMatch(read('lib/vlk-context-navigation.ts'), /scrollIntoView|localStorage|sessionStorage|window\.scroll|document\.[A-Za-z_]/);
});

test('graph options use every full original description, a short trigger and visible distinction from TDV', () => {
  assert.equal(Object.keys(GRAPH_DESCRIPTIONS).length, 3);
  assert.match(controls, /GRAPH_DESCRIPTIONS\[item.id\]/);
  assert.match(controls, /<SelectValue>\{SCHEDULE_GRAPHS.find/);
  assert.match(controls, /disabled=\{context.examineeType === CONTRACT && item.id === 'I'\}/);
  assert.match(controls, /id=\{`\$\{prefix\}graph-distinction`\}/);
  assert.ok(controls.indexOf('Графи Розкладу I–III не є графами ТДВ 1–12.') < controls.indexOf('<details className="context-help">'));
  assert.match(css, /\.graph-picker-content \{ width: min\(34rem, calc\(100vw - 2rem\)\)/);
  assert.match(css, /\.graph-picker-option \{[^}]*white-space: normal/);
});

test('secondary tools are one native disclosure while explanation and official source remain direct', () => {
  const toolbar = page.slice(page.indexOf('<div className="article-toolbar'), page.indexOf('<div key={selected.id} ref={articleContentRef}'));
  const secondary = toolbar.slice(toolbar.indexOf('<details className="article-tools">'), toolbar.indexOf('</details>'));
  for (const token of ['<QuickAccessDialog', '<PinArticleButton showLabel', 'aria-label="Попередня стаття"', 'aria-label="Наступна стаття"', '<PointComparisonDialog']) assert.ok(secondary.includes(token));
  assert.match(secondary, /Порівняння та інші дії/);
  assert.doesNotMatch(secondary, /<FullExplanationDialog|href=\{sourceUrl\}/);
  assert.ok(toolbar.indexOf('<FullExplanationDialog') < toolbar.indexOf('<details'));
  assert.ok(toolbar.indexOf('href={sourceUrl}') < toolbar.indexOf('<details'));
  assert.doesNotMatch(toolbar, /<details[^>]*\bopen[ =>]|<details[^>]*key=/);
  assert.match(page, /Мої статті/);
  const pagination = secondary.slice(secondary.indexOf('<div className="article-pagination'), secondary.indexOf('</div>'));
  assert.doesNotMatch(pagination, /QuickAccessDialog|PinArticleButton/);
  assert.match(read('components/vlk/quick-access.tsx'), /showLabel \? \(pinned \? "Відкріпити" : "Закріпити"\)/);
});

test('disclosure, jump and nested actions retain focus, 44px targets and readable type', () => {
  assert.match(css, /\.article-tools > summary \{[^}]*min-height: 44px/);
  assert.match(css, /\.context-next-action \{[^}]*min-height: 44px/);
  assert.match(css, /\.article-tools-body \[data-slot="button"\] \{ min-width: 44px; min-height: 44px/);
  assert.match(css, /\.article-tools > summary:focus-visible, \.context-next-action:focus-visible/);
  assert.match(css, /\.graph-picker-copy > span \{ font-size: 13px; line-height: 1.55/);
});

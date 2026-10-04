import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import postcss from 'postcss';
import { attachClinicalMotion } from '../components/vlk/clinical-motion-controller.ts';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const source = read('components/vlk/specialty-icon.tsx'), css = read('app/globals.css');
const sheet = postcss.parse(css);
const require = createRequire(import.meta.url), exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require });
const ids = ['therapist','surgeon','neurologist','psychiatrist','ophthalmologist','ent','dentist','dermatologist'];
const render = id => renderToStaticMarkup(React.createElement(exports.SpecialtyIcon, { id }));

test('all eight refined glyphs render as decorative inline vectors using the existing API', () => {
  for (const id of ids) {
    const svg = render(id);
    assert.match(svg, /viewBox="0 0 24 24"/); assert.match(svg, /aria-hidden="true" focusable="false"/);
    assert.ok(svg.includes(`si-${id}`)); assert.doesNotMatch(svg, /<image|<foreignObject|<filter|<animate|href=|id=/);
  }
});

test('psychiatry keeps separate brain, inner folds, dialogue bubble and two equal strokes', () => {
  const svg = render('psychiatrist');
  for (const cls of ['si-psy-brain','si-psy-center','si-dialog-bubble','si-dialog-one','si-dialog-two']) assert.equal((svg.match(new RegExp(cls, 'g')) ?? []).length, 1);
  assert.equal((svg.match(/h3\.8"/g) ?? []).length, 2);
  assert.doesNotMatch(svg, /si-neural|<circle/);
  assert.match(svg, /class="si-psy-center" stroke-width="1.3"/);
});

test('surgery has a complementary clamp outside the moving scalpel and clear optical anchors', () => {
  const svg = render('surgeon');
  assert.match(svg, /<g class="si-scalpel">[\s\S]+<\/g><g class="si-clamp si-accent"/);
  assert.equal((svg.match(/<circle/g) ?? []).length, 2);
  for (const part of ['si-scalpel-handle','si-scalpel-blade','si-scalpel-neck','si-gleam']) assert.ok(svg.includes(part));
  assert.match(css, /\.si \.si-scalpel \{ transform-box: view-box; transform-origin: 9px 12px; \}/);
  assert.match(css, /\.si \.si-tooth \{ transform-box: view-box; transform-origin: 12px 12px; \}/);
});

test('solid neural and skin details retain stroke-free styling while active, without filling open brain subpaths', () => {
  assert.match(css, /\.specialty-card \.specialty-icon \.si \.si-solid \{ fill: var\(--si-ink\); stroke: none; \}/);
  assert.ok(css.lastIndexOf('.specialty-card .specialty-icon .si .si-solid') > css.indexOf('.specialty-card:is(:hover, :focus-visible, [data-motion-active]) .si .si-accent'));
  assert.doesNotMatch(render('neurologist'), /class="si-brain-core si-tint"/);
  assert.match(render('neurologist'), /M12\.9 11\.1l2\.2-1\.7/);
  assert.equal((render('neurologist').match(/si-solid/g) ?? []).length, 5);
  assert.equal((render('dermatologist').match(/si-solid/g) ?? []).length, 2);
  for (const key of ['si-tint','si-solid']) assert.ok(css.includes(key));
});

test('complete specialty timelines are 1.8 seconds without delays and even interrupted return stays within 2 seconds', () => {
  const seen = new Set();
  sheet.walkDecls('animation', decl => {
    if (!decl.value.startsWith('si-')) return;
    const [, duration, easing, iterations, fill] = decl.value.split(/\s+/);
    assert.equal(duration, '1800ms'); assert.equal(easing, 'cubic-bezier(.2,.72,.2,1)'); assert.equal(iterations, '1'); assert.equal(fill, 'both');
    assert.equal(decl.value.split(/\s+/).length, 5, 'no hidden shorthand delay');
    const id = ids.find(id => decl.parent.selector.includes(`.si-${id} `)); assert.ok(id); seen.add(id);
  });
  assert.equal(seen.size, 8);
  sheet.walkDecls(/animation-delay/, decl => { if (decl.parent.selector?.includes('.si')) assert.equal(decl.value, '0ms'); });
  assert.match(read('components/vlk/clinical-motion-controller.ts'), /duration: 200,/);
  assert.ok(1800 + 200 <= 2000);
  sheet.walkAtRules('keyframes', at => { if (at.params.startsWith('si-')) at.walkDecls('fill', () => assert.fail('fill must remain static during interrupted return')); });
});

test('glyph-only styling preserves current display sizes, colors, reduced motion and controls', () => {
  const layer = css.split('/* v38.9')[1].split('/* v38.10')[0];
  assert.doesNotMatch(layer, /#[0-9a-f]{3,8}\b|\b(width|height|display|animation)\s*:/i);
  assert.match(css, /\.specialty-icon \.si \{ width: 40px; height: 40px; \}/);
  assert.match(css, /\.specialty-icon \.si \{ width: 36px; height: 36px; \}/);
  assert.match(css, /\.si \* \{ animation: none !important; transition: none !important; \}/);
  assert.match(css, /stroke-dasharray: none !important/);
});

test('motion lifecycle finishes once, permits deliberate re-entry, and returns smoothly on interruption', () => {
  const previous = new Map();
  const install = (name, value) => { previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, { value, configurable: true }); };
  const events = () => ({ listeners: new Map(), addEventListener(n, fn) { this.listeners.set(n, fn); }, removeEventListener(n) { this.listeners.delete(n); } });
  let observer, reducedChange, returnCount = 0, lastReturn;
  const reduced = { matches: false, addEventListener(n,fn) { reducedChange = fn; }, removeEventListener() {} };
  class ElementMock { constructor(card) { this.card = card; this.isConnected = true; } closest() { return this.card; } animate(frames, options) { returnCount++; lastReturn = options; return { cancel() {}, onfinish: null, oncancel: null }; } }
  class Effect { constructor(target) { this.target = target; } }
  class Animation { constructor(target) { this.animationName='si-surgeon-tool';this.playState='running';this.pending=false;this.effect=new Effect(target); } }
  const root = { ...events(), dataset: {}, contains: x => x.isConnected, querySelector: () => null };
  const card = new ElementMock();card.card = card;card.dataset = {};const part = new ElementMock(card);const animation = new Animation(part);card.getAnimations = () => [animation];
  install('Element', ElementMock);install('CSSAnimation', Animation);install('KeyframeEffect', Effect);
  install('window', { ...events(), matchMedia: q => q.includes('reduced') ? reduced : { matches: true } });
  install('document', { ...events(), hidden: false });
  install('MutationObserver', class { constructor(fn) { observer = fn; } observe() {} disconnect() {} });
  install('getComputedStyle', () => ({transform:'none',opacity:'1',stroke:'#123456',strokeDashoffset:'0',filter:'none'}));
  let cleanup;
  try {
    cleanup = attachClinicalMotion(root);
    const send = (name, extra = {}) => root.listeners.get(name)?.({ target: part, relatedTarget: null, pointerType:'mouse', animationName:'si-surgeon-tool', ...extra });
    send('pointerover');assert.equal(card.dataset.motionActive, 'true');
    send('pointerover', { relatedTarget: new ElementMock(card) });assert.equal(returnCount, 0);
    send('animationend', { animationName:'clinical-signature' });assert.equal(card.dataset.motionActive, 'true', 'short signature cannot end the full cycle');
    animation.playState='finished';send('animationend');assert.equal(card.dataset.motionActive, undefined);
    animation.playState='running';send('pointerover');assert.equal(card.dataset.motionActive,'true');
    send('pointerout');assert.equal(card.dataset.motionActive,undefined);assert.equal(lastReturn.duration,200);assert.match(lastReturn.easing,/cubic-bezier/);
    send('focusin');reduced.matches=true;reducedChange();assert.equal(card.dataset.motionActive,undefined);const count=returnCount;send('focusin');assert.equal(card.dataset.motionActive,undefined);assert.equal(returnCount,count);
    reduced.matches=false;send('focusin');card.isConnected=false;observer();assert.equal(card.dataset.motionActive,undefined);
    cleanup();cleanup=null;assert.equal(root.listeners.size,0);assert.equal(root.dataset.motionManaged,undefined);
  } finally { cleanup?.(); for (const [name, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis,name,descriptor); else delete globalThis[name]; } }
});

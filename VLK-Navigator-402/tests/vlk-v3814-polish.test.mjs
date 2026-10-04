import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ARTICLES } from '../lib/vlk-sample-data.ts';
import { articleIcdLabel } from '../lib/vlk-search.ts';
import { otherSpecialtyLabels, specialtyLabels } from '../lib/vlk-session.ts';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const page = read('app/page.tsx');
const css = read('app/globals.css');
const article = (number) => ARTICLES.find((item) => item.article === number);

/** v38.14: прибрані дублі, накладання та малі цілі дотику. Нормативний шар не змінювався. */

test('the article path names only the other specialties of the article', () => {
  // Стаття 1 веде до трьох спеціальностей: у шляху терапевта лишаються дві інші.
  assert.equal(specialtyLabels(article('1')), 'Терапевт, Невропатолог, Дерматовенеролог');
  assert.equal(otherSpecialtyLabels(article('1'), 'therapist'), 'Невропатолог, Дерматовенеролог');
  // Стаття 4 належить лише терапевту: підпис зникає повністю.
  assert.equal(otherSpecialtyLabels(article('4'), 'therapist'), '');
  // Без вибраної спеціальності показується повний перелік.
  assert.equal(otherSpecialtyLabels(article('4'), ''), 'Терапевт');
  assert.match(page, /також \$\{otherSpecialtyLabels\(selected, specialty\)\}/);
});

test('choosing a specialty opens the article registry, not the first article', () => {
  const body = page.match(/function changeSpecialty\(next: SpecialtyId\) \{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(body.includes('showListPanel()'), 'вибір спеціальності показує реєстр статей');
  assert.ok(!body.includes('showArticlePanel()'), 'аркуш не перехоплює вузький екран');
});

test('the article count is not printed twice in the registry', () => {
  assert.equal((page.match(/articleCountLabel\(listArticles\.length\)/g) ?? []).length, 1);
  assert.match(page, /className="sidebar-hint/);
  assert.match(css, /\.sidebar-hint kbd \{/);
  // На дотику підказка клавіатури прибирається разом із підвалом.
  assert.match(css, /@media \(pointer: coarse\) \{[\s\S]*?\.sidebar-hint \{ display: none; \}/);
});

test('rows without a code show a short caption while the official wording stays in place', () => {
  const uncoded = article('7');
  assert.equal(articleIcdLabel(uncoded), 'окремий код у Розкладі не зазначено');
  assert.match(page, /return label\.startsWith\("окремий код"\) \? "без окремого коду" : label;/);
  // Рядок реєстру несе короткий підпис, підказка рядка — повне формулювання.
  assert.match(page, /title=\{articleIcdLabel\(article\)\}[\s\S]{0,120}articleIcdListLabel\(article\)/);
  // Шапка статті не скорочується.
  assert.match(page, /МКХ-10: <Highlighted text=\{articleIcdLabel\(selected\)\}/);
});

test('the passive offline notice never swallows a tap meant for the content under it', () => {
  assert.match(css, /\.offline-ready-toast \{ pointer-events: none; \}/);
});

test('a very wide monitor keeps the sheet in one reading field', () => {
  const rule = css.match(/@media \(min-width: 1600px\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(rule, /\.article-content > \* \{ max-width: 1180px; margin-inline: auto; \}/);
  assert.match(rule, /\.article-header > \*/);
  // Міра читання нормативного тексту лишається тією самою.
  assert.match(css, /\.article-content \.normative-measure/);
});

test('help disclosures keep a full touch target and the case window fits its content', () => {
  assert.match(css, /\.context-help > summary \{ min-height: 44px;/);
  assert.match(css, /\.case-dialog\[data-vlk-dialog\] \{ height: fit-content !important; \}/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ARTICLE_RULES } from '../lib/vlk-rules.ts';
import { TDV_RULES, TDV_COLUMNS } from '../lib/vlk-tdv.ts';
import { getPointTdv } from '../lib/vlk-point-tdv.ts';
import { CATEGORY_SOURCE } from '../lib/vlk-category-data.ts';
import { classifyOutcome } from '../lib/vlk-outcomes.ts';
import { matchesRuleFilters } from '../lib/vlk-view-filters.ts';
import { EMPTY_DIRECTORY, restoreSession, serializeSession } from '../lib/vlk-session.ts';
import { CONTRACT, EDUCATION, CONTRACT_GUIDANCE, resolveReviewContext, scheduleOutcome, categoryGuidance } from '../lib/vlk-review-context.ts';

const official = JSON.parse(readFileSync(new URL('../review/normative-context-2026-09-29.json', import.meta.url)));
const ctx = (examineeType, scheduleGraph = 'II', tdvColumn) => ({ examineeType, scheduleGraph, tdvColumn });
const rule = (a, p) => ARTICLE_RULES[a].find(r => r.point === p);
const clean = x => x.replace(/\s/g, '');

test('all 206 extant schedule rows match all three official graph cells; 87 remains absent', () => {
  assert.equal(official.schedule.length, 206);
  for (const row of official.schedule) {
    const point = row.condition.match(/^([а-яіїєґ])\)\s*(.*)/u);
    const local = rule(row.article, point?.[1] ?? '—');
    assert.ok(local, row.article);
    assert.equal(clean(local.condition), clean(point?.[2] ?? row.condition));
    for (const graph of ['I', 'II', 'III']) assert.equal(clean(scheduleOutcome(row.article, local, graph)), clean(row[graph]), `${row.article}-${local.point}/${graph}`);
  }
  for (const graph of ['all','I','II','III']) assert.notEqual(classifyOutcome(resolveReviewContext('87', ARTICLE_RULES['87'][0],ctx(CONTRACT,graph)).outcome).kind,'fit');
});

test('category source quotes and all 75 TDV rows match independently extracted official evidence', () => {
  for (const [anchor, source] of Object.entries(CATEGORY_SOURCE)) {
    assert.equal(source.text, official.clauses[anchor]); assert.ok(source.url.endsWith('#'+anchor));
  }
  assert.equal(Object.keys(official.tdvRows).length,75);
  assert.deepEqual(TDV_RULES,official.tdvRows);
  assert.deepEqual(TDV_COLUMNS.map(c=>c.label),official.tdvColumns);
});

test('18.5 excludes exactly the seven stated b points from contract, without changing general service', () => {
  for (const a of ['5','14','15','16','17','18','19']) {
    for (const graph of ['all','II','III']) {
      const r=resolveReviewContext(a,rule(a,'б'),ctx(CONTRACT,graph));
      assert.equal(r.outcome,'непридатний до військової служби за контрактом');
      assert.ok(r.sourceUrl.endsWith('#n7418'));
      assert.equal(r.scheduleText,rule(a,'б').outcome);
    }
    for(const category of ['Військовослужбовець','Військовозобов’язаний']) {
      assert.equal(resolveReviewContext(a,rule(a,'б'),ctx(category)).outcome,rule(a,'б').outcome);
    }
  }
  // A neighbouring support-services point is not part of the exception.
  assert.equal(classifyOutcome(resolveReviewContext('39',rule('39','б'),ctx(CONTRACT)).outcome).kind,'limited');
  assert.equal(classifyOutcome(resolveReviewContext('14',rule('14','в'),ctx(CONTRACT)).outcome).kind,'fit');
  assert.equal(classifyOutcome(resolveReviewContext('49',rule('49','в'),ctx(CONTRACT)).outcome).kind,'fit');
});

test('all unfit and explicitly temporary points map to the 18.5 contract norm, not to permanent general unfitness', () => {
  for(const row of official.schedule) {
    const p=row.condition.match(/^([а-яіїєґ])\)/u)?.[1] ?? '—';
    if(/^(?:Непридат|Тимчасово непридат)/iu.test(row.II)) {
      const r=resolveReviewContext(row.article,rule(row.article,p),ctx(CONTRACT));
      assert.equal(r.outcome,'непридатний до військової служби за контрактом',row.article+'-'+p);
      assert.equal(clean(r.scheduleText),clean(row.II));
    }
  }
  assert.equal(classifyOutcome(resolveReviewContext('17',rule('17','г'),ctx(CONTRACT)).outcome).kind,'unknown','treatment alone is not inferred to mean permanent unfitness');
});

test('pregnancy and empty graph cells cannot become false positive contract outcomes', () => {
  for(const p of ['а','б']) for(const category of [CONTRACT,EDUCATION]) {
    assert.equal(classifyOutcome(resolveReviewContext('73',rule('73',p),ctx(category)).outcome).kind,'unfit');
  }
  assert.equal(scheduleOutcome('73',rule('73','б'),'I'),'-');
  assert.equal(scheduleOutcome('73',rule('73','б'),'II'),'Придатні');
  for(const p of ['а','б'])for(const graph of ['II','III']) {
    assert.equal(scheduleOutcome('82',rule('82',p),graph),'');
    assert.equal(classifyOutcome(resolveReviewContext('82',rule('82',p),ctx(CONTRACT,graph)).outcome).kind,'unknown');
  }
  assert.equal(classifyOutcome(resolveReviewContext('14',rule('14','б'),ctx(CONTRACT,'I')).outcome).kind,'unknown','legacy incompatible graph is explicit, not silently accepted');
});

test('education distinguishes TDV 9/10 and never treats a blank as fit, across every article and point', () => {
  for(const [a,rs] of Object.entries(ARTICLE_RULES))for(const r of rs)for(const graph of ['all','I','II','III'])for(const col of [undefined,9,10]) {
    const result=resolveReviewContext(a,r,ctx(EDUCATION,graph,col));
    assert.notEqual(classifyOutcome(result.outcome).kind,'fit', `${a}-${r.point}/${graph}/${col}: cannot assert admission from one point`);
    if(getPointTdv(a,r.point)?.marks[col]==='НП') assert.equal(classifyOutcome(result.outcome).kind,'unfit',`${a}-${r.point}/TDV${col}`);
  }
  const r=rule('13','б');
  assert.equal(resolveReviewContext('13',r,ctx(EDUCATION,'III',9)).label,'Вступ · НП за ТДВ');
  assert.equal(resolveReviewContext('13',r,ctx(EDUCATION,'III',10)).label,'Вступ · звірте вимоги');
});

test('filters use the same contextual point outcome, with no change to literal rule data', () => {
  const r=rule('14','б'), original=JSON.stringify(r);
  const result=resolveReviewContext('14',r,ctx(CONTRACT));
  assert.equal(matchesRuleFilters(r,'б','unfit',result.outcome),true);
  assert.equal(matchesRuleFilters(r,'б','limited',result.outcome),false);
  assert.equal(matchesRuleFilters(r,'в','unfit',result.outcome),false);
  assert.equal(JSON.stringify(r),original);
});

test('category guidance preserves full original paragraphs and all explicit contract links resolve',async () => {
  for(const [a,indices] of Object.entries(CONTRACT_GUIDANCE)) {
    const {EXPLANATION:e}=await import(`../lib/explanations/article-${a}.ts`);
    const paragraphs=categoryGuidance(a,e.paragraphs,CONTRACT);
    assert.equal(paragraphs.length,indices.length,a);
    assert.deepEqual(paragraphs,indices.map(i=>e.paragraphs[i]));
    assert.ok(paragraphs.every(p=>p.length>40));
  }
  const {EXPLANATION:e}=await import('../lib/explanations/article-51.ts');
  assert.ok(categoryGuidance('51',e.paragraphs,EDUCATION).some(p=>p.includes('6-9 місяців')));
  assert.deepEqual(categoryGuidance('51',e.paragraphs,CONTRACT),[],'serving contract personnel are not automatically treated as candidates');
});

test('new TDV destination survives reload while old session keys and absent fields are preserved',()=>{
  const state={...ctx(CONTRACT,'III',12),directory:EMPTY_DIRECTORY};
  assert.deepEqual(restoreSession(serializeSession(state)),state);
  for(const value of [0,13,-1,1.5,'9',null,{},true])assert.equal(restoreSession({tdvColumn:value}).tdvColumn,undefined);
  assert.equal(restoreSession({examineeType:CONTRACT,scheduleGraph:'II'}).tdvColumn,undefined);
});

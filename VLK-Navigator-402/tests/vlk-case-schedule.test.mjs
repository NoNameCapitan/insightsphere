import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { caseScheduleOutcomes, scopeCaseDestination } from '../lib/vlk-case-schedule.ts';
import { caseCardView } from '../lib/vlk-case-presentation.ts';
import { emptyCaseDraft, evaluateCase, parseCasePoints } from '../lib/vlk-case.ts';
import { ARTICLE_RULES } from '../lib/vlk-rules.ts';
const context={examineeType:'Військовозобов’язаний',scheduleGraph:'II'};
const draft=(codes,other={})=>({...emptyCaseDraft(),points:parseCasePoints(codes).points,...other});
const schedule=(codes,c=context)=>caseScheduleOutcomes(parseCasePoints(codes).points,c);
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('schedule outcomes are exact per point; no-row TDV does not hide 39a unfit or support-only wording',()=>{
 const a=schedule('39а')[0];assert.equal(a.classification.kind,'unfit');assert.equal(a.result.outcome,ARTICLE_RULES['39'][0].outcome);
 const b=schedule('28б')[0];assert.equal(b.classification.kind,'limited');assert.match(b.result.outcome,/частинах забезпечення/);
 const d=draft('28б',{height:'180',weight:'80',vehicleRole:'crew'}),column=evaluateCase(d)[0],original=JSON.stringify(column);
 assert.equal(column.status,'no-detected-restriction');assert.equal(caseCardView(column,d).tone,'checked');assert.equal(scopeCaseDestination(caseCardView(column,d),schedule('28б')).tone,'neutral');assert.equal(JSON.stringify(column),original);
 for(const col of evaluateCase(draft('39а')))assert.ok(col.findings.some(f=>f.kind==='no-row'));
});

test('missing rows and graph-dependent empty schedule cells never inherit sibling points or become green',()=>{
 const d=draft('40в13в',{height:'180',weight:'80'});
 for(const col of evaluateCase(d)){assert.equal(col.findings.filter(f=>f.kind==='no-row').length,2);assert.notEqual(scopeCaseDestination(caseCardView(col,d),caseScheduleOutcomes(d.points,context)).tone,'checked');}
 for(const graph of ['all','II','III'])for(const codes of ['82а','82б']){const s=schedule(codes,{...context,scheduleGraph:graph});assert.notEqual(s[0].classification.kind,'fit');}
 assert.equal(schedule('73б',{...context,scheduleGraph:'I'})[0].classification.kind,'none');assert.equal(schedule('73б',{...context,scheduleGraph:'II'})[0].classification.kind,'fit');
 assert.equal(schedule('73б',{...context,scheduleGraph:'all'})[0].result.scheduleNeedsGraph,true);
 assert.notEqual(schedule('87')[0]?.classification.kind,'fit');
});

test('contract and educational outcomes keep destination scope and expose separate schedule text',()=>{
 const contract=schedule('14б',{...context,examineeType:'Кандидат на контракт'})[0];assert.equal(contract.classification.kind,'unfit');assert.match(contract.result.label,/Контракт/);assert.match(contract.result.scheduleText,/частинах забезпечення/);assert.notEqual(contract.result.outcome,contract.result.scheduleText);
 const school=schedule('13б',{...context,examineeType:'Кандидат до ВВНЗ',scheduleGraph:'I',tdvColumn:9})[0];assert.match(school.result.label,/Вступ/);assert.match(school.result.outcome,/ТДВ/);
 const school10=schedule('13б',{...context,examineeType:'Кандидат до ВВНЗ',scheduleGraph:'I',tdvColumn:10})[0];assert.notEqual(school10.classification.kind,'fit');
 const incompatible=schedule('39в',{...context,examineeType:'Кандидат на контракт',scheduleGraph:'I'})[0];assert.equal(incompatible.classification.kind,'unknown');
});

test('conservative colour gate preserves raw findings and never conceals mixed/unknown schedule evidence',()=>{
 const checked={tone:'checked',heading:'H',summary:'S',prompts:[],sourceNote:''};
 assert.equal(scopeCaseDestination(checked,[]).tone,'neutral');assert.equal(scopeCaseDestination(checked,schedule('39в')).tone,'checked');
 assert.equal(scopeCaseDestination(checked,schedule('39в73б',{...context,scheduleGraph:'all'})).tone,'neutral');
 for(const tone of ['restriction','attention','neutral'])assert.equal(scopeCaseDestination({...checked,tone},[]).tone,tone);
 for(const graph of ['all','I','II','III'])for(const [article,rules]of Object.entries(ARTICLE_RULES))for(const rule of rules){
  const d={...emptyCaseDraft(),points:[{article,point:rule.point}],height:'175',weight:'70',vehicleRole:'crew',harmfulFactor:'other'};
  const s=caseScheduleOutcomes(d.points,{...context,scheduleGraph:graph});
  for(const c of evaluateCase(d)){const before=JSON.stringify(c),v=scopeCaseDestination(caseCardView(c,d),s);assert.equal(JSON.stringify(c),before);if(v.tone==='checked'){assert.equal(s[0].classification.kind,'fit');assert.ok(!c.findings.some(f=>['conditional','blank-cell','no-row','missing-measurement','invalid-measurement','invalid-point'].includes(f.kind)));}}
 }
});

test('Case uses the active examination context with distinct schedule and TDV regions and literal disclosures',()=>{
 const ui=read('components/vlk/case-dialog.tsx'),page=read('app/page.tsx');
 assert.match(page,/reviewContext=\{reviewContext\} onReviewContextChange=\{changeReviewContext\}/);
 assert.match(ui,/caseScheduleOutcomes\(previewDraft.points, reviewContext\)/);assert.match(ui,/scopeCaseDestination/);
 assert.match(ui,/case-schedule-heading/);assert.match(ui,/item.result\?\.scheduleText/);assert.match(ui,/label=\{item.result\?\.label\}/);
 assert.match(ui,/Категорію «обмежено придатний» не застосовуємо/);assert.doesNotMatch(ui,/strictestOutcome/);
 assert.match(ui,/ReviewContextControls context=\{reviewContext\}/);
});

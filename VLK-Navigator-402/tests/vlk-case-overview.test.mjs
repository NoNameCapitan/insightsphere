import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { emptyCaseDraft, evaluateCase, parseCasePoints } from '../lib/vlk-case.ts';
import { caseCardView, CASE_DESTINATIONS, CASE_RESULT_GROUPS, caseRowReason } from '../lib/vlk-case-presentation.ts';
import { ARTICLE_RULES } from '../lib/vlk-rules.ts';
const read = p => readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const draft = (codes='',extras={}) => ({...emptyCaseDraft(),points:parseCasePoints(codes).points,...extras});
const cards = d => evaluateCase(d).map(c=>caseCardView(c,d));

test('overview always has 12 meaningful destinations with explicit empty action and no green empty status',()=>{
  assert.equal(CASE_DESTINATIONS.length,12);
  for(const destination of CASE_DESTINATIONS){assert.ok(destination.title.length>5);assert.ok(destination.subtitle);}
  for(const c of cards(emptyCaseDraft())){assert.equal(c.tone,'neutral');assert.equal(c.heading,'Очікує введення');assert.deepEqual(c.prompts,[{target:'points',label:'Додайте статтю та пункт'}]);}
});

test('presentation never changes the evidence or promotes a blank/missing source cell to a checked card across the corpus',()=>{
  for(const [article,rules]of Object.entries(ARTICLE_RULES))for(const rule of rules){
    const d={...draft('',{height:'170',weight:'70',vehicleRole:'crew',harmfulFactor:'other'}),points:[{article,point:rule.point}]};
    for(const c of evaluateCase(d)){
      const original=JSON.stringify(c),view=caseCardView(c,d);assert.equal(JSON.stringify(c),original);
      if(c.findings.some(f=>['restriction','outside-bound'].includes(f.kind)))assert.equal(view.tone,'restriction');
      if(c.findings.some(f=>['blank-cell','no-row','invalid-point','conditional','missing-measurement','invalid-measurement'].includes(f.kind)))assert.notEqual(view.tone,'checked');
      if(view.tone==='checked')assert.equal(c.status,'no-detected-restriction');
    }
  }
});

test('sample union exposes exact role and metric actions while retaining red restrictions and neutral source gaps',()=>{
  const result=cards(draft('39б40в13в28б'));
  assert.equal(result[0].tone,'attention');assert.match(result[0].summary,/водії - НП/);
  assert.deepEqual(result[0].prompts.map(p=>p.target),['height','weight','role']);
  for(const c of result.slice(1)){assert.equal(c.tone,'restriction');assert.match(c.sourceNote,/40в, 13в/);}
  assert.match(result[11].summary,/39б/);assert.match(result[7].summary,/28б/);
  const noRows=cards(draft('40в13в',{height:'170',weight:'70'}));
  for(const c of noRows){assert.equal(c.tone,'neutral');assert.match(c.summary,/рядка ТДВ немає/);assert.match(c.sourceNote,/Звірте Розклад/);}
});

test('conditional questions are precise and only apply to their actual source marks',()=>{
  const d=draft('46в'),result=cards(d);
  assert.deepEqual(result[7].prompts.map(p=>p.target),['height','factor']);
  assert.match(result[7].summary,/КРП-НП/);assert.ok(!result[0].prompts.some(p=>p.target==='role'));
  assert.equal(cards(draft('46в',{height:'150',harmfulFactor:'krp'}))[7].tone,'restriction');
  assert.equal(cards(draft('46в',{height:'150',harmfulFactor:'other'}))[7].tone,'checked');
  assert.equal(cards(draft('28б',{height:'180',weight:'90',vehicleRole:'crew'}))[0].tone,'checked');
  assert.equal(cards(draft('28б',{height:'180',weight:'90',vehicleRole:'driver'}))[0].tone,'restriction');
});

test('numeric-only checks have narrow wording, inclusive bounds and actionable invalid/missing inputs',()=>{
  const result=cards(draft('',{height:'180'}));
  assert.equal(result[10].tone,'checked');assert.equal(result[10].heading,'Введені показники у числових межах ТДВ');
  assert.match(result[10].summary,/Статті та пункти ще не додані/);assert.ok(result[10].prompts.some(p=>p.target==='points'));
  assert.equal(result[0].tone,'attention');assert.ok(result[0].prompts.some(p=>p.target==='weight'));
  assert.equal(cards(draft('',{height:'180.01'}))[10].tone,'restriction');
  const invalid=cards(draft('28б',{height:'0',weight:'90',vehicleRole:'crew'}))[0];
  assert.equal(invalid.tone,'attention');assert.match(invalid.prompts[0].label,/Виправте зріст/);
});

test('immediate preview remains atomic, accessible and ephemeral with visible privacy and complete evidence',()=>{
  const ui=read('components/vlk/case-dialog.tsx'),helper=read('lib/vlk-case-presentation.ts');
  assert.match(ui,/parseCasePoints\(entry\)/);assert.match(ui,/points: addCasePoints\(draft.points, parsed.points\)/);
  assert.match(ui,/Попередній перегляд/);assert.match(ui,/Нове введення ще не враховано/);
  assert.match(ui,/className="case-privacy">[^<]*Не вводьте ПІБ/);
  assert.match(ui,/aria-expanded=\{expanded\} aria-controls=/);assert.match(ui,/hidden=\{!expanded\}/);
  assert.match(ui,/column.findings.map/);assert.match(ui,/setExpandedColumn\(null\)/);
  assert.match(ui,/hasDriverCondition \? <label/);assert.match(ui,/hasFactorCondition \? <label/);assert.match(ui,/field\?\.focus\(\)/);
  assert.doesNotMatch(ui+helper,/localStorage|sessionStorage|fetch\(|sendBeacon|pushState|replaceState|URLSearchParams/);
});

test('compact grouped lists replace cards while retaining touch targets, responsive rows and non-color status icons',()=>{
  const css=read('app/globals.css'),ui=read('components/vlk/case-dialog.tsx');
  assert.match(css,/\.case-layout \{[^}]*overflow-y: auto/);
  assert.match(css,/\.case-entry-row input \{[^}]*min-height: 56px; font-size: 19px/);
  assert.match(css,/\.case-columns \{[^}]*repeat\(2, minmax\(0, 1fr\)\)[^}]*align-items: start/);
  assert.match(css,/@media \(max-width: 760px\)[\s\S]*?\.case-columns \{ grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css,/\.case-card-open \{[^}]*min-height: 68px/);
  assert.match(ui,/!hasCriteria \? <div className="case-empty-result"/);
  assert.match(ui,/CASE_RESULT_GROUPS.map/);assert.match(ui,/caseRowReason\(column, view\)/);
  assert.match(ui,/className="case-group-summary" role="status"/);
  assert.match(css,/\.case-card-prompts > button \{[^}]*min-height: 44px/);
  assert.match(css,/\.case-card-open\[aria-expanded="true"\] \.case-card-meta svg \{ transform: rotate\(180deg\); \}/);
  assert.doesNotMatch(css,/(?:^|\n)\.case-card-meta svg \{[^}]*transform:/);
  assert.match(ui,/const TONE_ICONS = \{ restriction: ShieldAlert, attention: AlertTriangle, neutral: CircleHelp, checked: Check \}/);
});

test('clamp and scalpel both animate for one complete 1.8-second cycle and return to idle',()=>{
  const sheet=postcss.parse(read('app/globals.css'));let clamp,scalpel;
  sheet.walkRules(rule=>{
    for(const decl of rule.nodes??[]){if(decl.prop!=='animation')continue;
      if(rule.selector.endsWith('.si-surgeon .si-clamp'))clamp={rule,decl};
      if(rule.selector.endsWith('.si-surgeon .si-scalpel'))scalpel={rule,decl};
    }
  });
  for(const part of [clamp,scalpel]){assert.ok(part);assert.match(part.decl.value,/1800ms cubic-bezier\(\.2,\.72,\.2,1\) 1 both$/);assert.equal(part.rule.parent.params,'(prefers-reduced-motion: no-preference)');}
  const keyframes=sheet.nodes.find(n=>n.type==='atrule'&&n.name==='keyframes'&&n.params==='si-surgeon-clamp');
  assert.ok(keyframes.nodes.some(n=>n.selector.includes('100%')&&n.nodes.some(d=>d.prop==='transform'&&d.value==='none')));
  assert.match(read('app/globals.css'),/\.si \* \{ animation: none !important; transition: none !important; \}/);
});


test('groups are mutually exclusive, preserve 12 destinations and never imply permission from missing evidence',()=>{
  assert.deepEqual(CASE_RESULT_GROUPS.map(g=>g.tone),['restriction','attention','neutral','checked']);
  for(const d of [emptyCaseDraft(),draft('39б40в13в28б'),draft('28б',{height:'180',weight:'90',vehicleRole:'crew'}),draft('40в13в',{height:'175',weight:'70'})]){
    const columns=evaluateCase(d),views=cards(d);
    const groups=CASE_RESULT_GROUPS.map(g=>columns.filter((_,i)=>views[i].tone===g.tone));
    assert.equal(groups.flat().length,12);assert.equal(new Set(groups.flat().map(c=>c.column)).size,12);
    for(const [i,c]of columns.entries())assert.ok(caseRowReason(c,views[i]).length>5);
  }
  const d=draft('39б40в13в28б');const columns=evaluateCase(d),views=cards(d);
  assert.match(caseRowReason(columns[0],views[0]),/Водій чи член екіпажу/);
  assert.match(caseRowReason(columns[11],views[11]),/НП.*39б/);
  assert.equal(CASE_RESULT_GROUPS.find(g=>g.tone==='neutral').label,'Дозвіл не встановлено');
  assert.match(CASE_RESULT_GROUPS.find(g=>g.tone==='checked').note,/не загальний допуск/);
});

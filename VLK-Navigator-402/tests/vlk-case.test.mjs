import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { addCasePoints, emptyCaseDraft, evaluateCase, parseCaseMeasurement, parseCasePoints, validCasePoint } from '../lib/vlk-case.ts';
import { ARTICLE_RULES } from '../lib/vlk-rules.ts';
import { TDV_RULES } from '../lib/vlk-tdv.ts';

const draft = (codes = '', extras = {}) => ({ ...emptyCaseDraft(), points: codes ? parseCasePoints(codes).points : [], ...extras });
const column = (d, n) => evaluateCase(d).find(c => c.column === n);
const finding = (d, n, key) => column(d, n).findings.find(f => f.key === key);
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the strict case parser accepts exact points and all 207 corpus selections but rejects partial-invalid input atomically', () => {
  for (const text of ['39б,40в,13в,28б','39 б; 40в 13в\n28б','39б40в13в28б']) assert.equal(parseCasePoints(text).points.length,4);
  for (const [article, rules] of Object.entries(ARTICLE_RULES)) for (const rule of rules) {
    const result = parseCasePoints(`${article}${rule.point === '—' ? '' : rule.point}`);
    assert.deepEqual(result.errors,[]);assert.deepEqual(result.points,[{article,point:rule.point}]);
  }
  for (const text of ['', ', ;', '39', '99б', '0а', '039б', '40я', '40b', '39б,99б', '39б <script>', '2б', '-39б', '39.5']) {
    const result=parseCasePoints(text);assert.equal(result.points.length,0,text);assert.ok(result.errors.length,text);
  }
  assert.equal(validCasePoint({article:'__proto__',point:'а'}),false);
});

test('duplicates are stable and do not mutate input or silently strengthen a point', () => {
  const original=[{article:'39',point:'б'}];const snapshot=JSON.stringify(original);
  assert.deepEqual(addCasePoints(original,[...original,{article:'39',point:'в'},{article:'99',point:'б'}]),[...original,{article:'39',point:'в'}]);
  assert.equal(JSON.stringify(original),snapshot);assert.equal(parseCasePoints('39б,39б').points.length,1);
});

test('all 75 source rows retain every exact mark and article-wide scope without borrowing sibling points', () => {
  for (const [row, marks] of Object.entries(TDV_RULES)) {
    const [article, point]=row.split('-');
    for (const rule of ARTICLE_RULES[article].filter(r=>!point||r.point===point)) {
      const result=evaluateCase({...emptyCaseDraft(),points:[{article,point:rule.point}]});
      assert.equal(result.length,12);
      for (const c of result) {
        const f=c.findings[0];assert.equal(f.sourceRow,row);assert.equal(f.sourceScope,point?'point':'article');assert.equal(f.mark,marks[c.column]??'');
        assert.equal(f.kind,f.mark==='НП'?'restriction':f.mark?'conditional':'blank-cell');
      }
    }
  }
  for(const code of ['40в','13в'])for(const c of evaluateCase(draft(code)))assert.equal(c.findings[0].kind,'no-row');
});

test('the requested 39б 40в 13в 28б case keeps conditional column1, restrictions2–12 and absent rows', () => {
  const d=draft('39б40в13в28б');const results=evaluateCase(d);
  assert.equal(results[0].status,'conditional');
  for(const c of results.slice(1))assert.equal(c.status,'restriction',String(c.column));
  for(const c of results){assert.ok(c.findings.some(f=>f.key==='point:40-в'&&f.kind==='no-row'));assert.ok(c.findings.some(f=>f.key==='point:13-в'&&f.kind==='no-row'));}
  assert.equal(finding(d,8,'point:28-б').mark,'НП');assert.equal(finding(d,12,'point:39-б').mark,'НП');
});

test('driver and KRP conditions apply only to explicitly matching contexts; opposite context is never fitness', () => {
  for (const [row, marks] of Object.entries(TDV_RULES)) {
    const [article,point]=row.split('-');if(!point)continue;
    for(const [col,field,yes,no,token]of [[1,'vehicleRole','driver','crew','водії - НП'],[8,'harmfulFactor','krp','other','КРП-НП']])if(marks[col]===token){
      const base={...emptyCaseDraft(),points:[{article,point}]};
      assert.equal(column(base,col).findings[0].kind,'conditional');
      assert.equal(column({...base,[field]:yes},col).findings[0].kind,'restriction');
      assert.equal(column({...base,[field]:no},col).findings[0].kind,'not-applicable');
    }
  }
  const mixed=column(draft('14б28б',{vehicleRole:'unknown'}),1);assert.equal(mixed.status,'restriction');assert.ok(mixed.findings.some(f=>f.kind==='conditional'));
});

test('height and weight comparisons use inclusive official bounds, retaining numeric evidence rather than inventing NP', () => {
  for(const [col,metric,id,bound,direction]of [[1,'height','height-max',180,1],[5,'height','height-max',185,1],[6,'height','height-max',190,1],[11,'height','height-max',180,1],[8,'height','height-min',150,-1],[1,'weight','weight-max',90,1],[5,'weight','weight-max',90,1]]){
    for(const [value,kind]of [[bound,'within-bound'],[bound-direction*.01,'within-bound'],[bound+direction*.01,'outside-bound']]){
      const f=finding(draft('',{[metric]:String(value)}),col,id);assert.equal(f.kind,kind);assert.equal(f.mark,String(bound));assert.ok(!f.mark.includes('НП'));
    }
  }
  for(const c of evaluateCase(draft('',{weight:'1'})))assert.ok(!c.findings.some(f=>f.key==='weight-min'||f.kind==='outside-bound'));
});

test('missing, invalid and absent numeric norms remain distinct; zero/NaN/infinity are never defaults', () => {
  for(const value of ['0','-1','NaN','Infinity','1e3','180cm','1.222','.','1'.repeat(17)])assert.equal(parseCaseMeasurement(value).kind,'invalid',value);
  assert.deepEqual(parseCaseMeasurement('180,25'),{kind:'value',value:180.25});assert.deepEqual(parseCaseMeasurement(''),{kind:'missing'});
  assert.equal(finding(draft(),1,'height-max').kind,'missing-measurement');
  assert.equal(finding(draft('',{height:'0'}),1,'height-max').kind,'invalid-measurement');
  assert.equal(finding(draft(),2,'height:none').kind,'no-bound');
});

test('empty cases and blank/missing rows cannot produce a no-restriction summary', () => {
  for(const c of evaluateCase(emptyCaseDraft()))assert.equal(c.status,'insufficient');
  assert.equal(column(draft('40в',{height:'180',weight:'80'}),1).status,'insufficient');
  assert.equal(column(draft('39б',{height:'180',weight:'80'}),1).status,'insufficient');
  assert.equal(column(draft('',{height:'180',weight:'80'}),1).status,'no-detected-restriction');
  assert.equal(column(draft('',{height:'180',weight:'80'}),2).status,'insufficient');
  assert.equal(column({...emptyCaseDraft(),points:[{article:'99',point:'б'}]},1).findings[0].kind,'invalid-point');
});

test('an explicit mark, metric breach and missing sources all survive one combined result', () => {
  const c=column(draft('14б40в',{height:'181',weight:''}),1);
  for(const kind of ['restriction','outside-bound','no-row','missing-measurement'])assert.ok(c.findings.some(f=>f.kind===kind),kind);
  assert.equal(c.status,'restriction');assert.equal(c.gaps,2);
});

test('case state remains temporary and resets with both local and cross-tab session reset', () => {
  const page=read('app/page.tsx'),ui=read('components/vlk/case-dialog.tsx'),logic=read('lib/vlk-case.ts');
  assert.doesNotMatch(ui+logic,/localStorage|sessionStorage|fetch\(|sendBeacon|clipboard|window\.open|pushState|replaceState|URLSearchParams/);
  assert.match(page,/const \[caseDraft, setCaseDraft\] = useState\(emptyCaseDraft\)/);
  const reset=page.split('const resetSessionView = useCallback(')[1].split('}, [resetToHome, workspaceHistory]')[0];
  for(const required of ['setCaseDraft(emptyCaseDraft())','setCaseOpen(false)','setCaseEpoch(current => current + 1)'])assert.ok(reset.includes(required));
  assert.match(page,/<CaseDialog key=\{caseEpoch\}/);assert.match(page,/event.key === SESSION_RESET_KEY && event.newValue\) resetSessionView\(\)/);
  assert.match(ui,/draft.vehicleRole !== 'unknown' \|\| draft.harmfulFactor !== 'unknown'/);
  for(const storageFile of ['lib/vlk-session.ts','lib/vlk-workspace-history.ts','lib/vlk-local-storage.ts'])assert.doesNotMatch(read(storageFile),/caseDraft|CaseDraft|casePoints|vehicleRole|harmfulFactor/);
});

test('case UI exposes every source and missing-data caveat, with compact accessible navigation', () => {
  const ui=read('components/vlk/case-dialog.tsx'),css=read('app/globals.css');
  for(const token of ['Усі 12 граф ТДВ','Не постанова ВЛК','Висновок приймає ВЛК','Повна назва графи · дослівно','column.findings.map','view.heading','view.sourceNote','Додаткові умови водолазних посад не перевірено.'])assert.ok(ui.includes(token),token);
  assert.match(ui,/inputMode="decimal"/);assert.match(ui,/onOpenAutoFocus=/);assert.match(ui,/aria-label="Закрити випадок"/);
  assert.match(css,/\.case-card-open \{[^}]*min-width: 0/);
  assert.match(css,/\.case-layout \{[^}]*display: block;[^}]*overflow-y: auto/);
  assert.doesNotMatch(css,/\[data-case-status="insufficient"\][^}]*positive/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseClinicalNumber, calculatePta4, calculateEgfr2021, calculateFib4, calculateApri, calculatePrincipalMeridians,
  calculateSpirometryRatio, calculatePercentPredicted, calculateBronchodilatorChange, compareLimbLengths } from '../lib/vlk-specialty-calculators.ts';
import { JOINT_REFERENCES } from '../lib/vlk-joint-reference.ts';
import { SPECIALTY_TOOLS, SPECIALTY_TOOL_LABELS } from '../lib/vlk-specialty-tools.ts';
import { ARTICLES, SPECIALTIES } from '../lib/vlk-sample-data.ts';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const near=(v,e,t=1e-9)=>assert.ok(Math.abs(v-e)<t,`${v} differs from ${e}`);

test('clinical decimal parser distinguishes signed, nonnegative and positive domains; blank is never zero',()=>{
 for(const raw of ['', ' '])assert.equal(parseClinicalNumber(raw,'signed').kind,'missing');
 for(const raw of ['1,2.3','NaN','Infinity','1e3','NR','>120','−','--1','3 dB','1 000','9'.repeat(400)])for(const kind of ['positive','nonnegative','signed'])assert.equal(parseClinicalNumber(raw,kind).kind,'invalid',raw);
 for(const [raw,n]of [['−10',-10],['-10,5',-10.5],['+2.5',2.5],['0',0],['-0',0]])assert.deepEqual(parseClinicalNumber(raw,'signed'),{kind:'value',value:n});
 assert.equal(parseClinicalNumber('0').kind,'invalid');assert.equal(parseClinicalNumber('-1','nonnegative').kind,'invalid');assert.deepEqual(parseClinicalNumber('0','nonnegative'),{kind:'value',value:0});
});

test('PTA4 includes four frequencies per ear; zero and negative thresholds are real measurements',()=>{
 for(const [v,e]of [[[10,20,30,40],25],[[-10,0,5,15],2.5],[[0,0,0,0],0],[[80,90,100,110],95]])assert.equal(calculatePta4(v),e);
 for(const v of [[],[10,20,30],[10,20,30,NaN],[10,20,30,Infinity],[10,20,30,40,50]])assert.equal(calculatePta4(v),undefined);
 // Independent ears remain separate rather than an average or best-ear substitution.
 assert.equal(calculatePta4([10,20,30,40]),25);assert.equal(calculatePta4([80,90,100,110]),95);
});

test('CKD-EPI 2021 uses exact sex constants, age factor and creatinine conversion without race or weight',()=>{
 for(const [age,cr,sex,expected]of [[50,1,'male',91.6914786098333],[50,1,'female',68.63349665880087],[40,.9,'male',110.72559960355491],[40,.7,'female',112.05430679879757],[70,2,'male',35.24299672901596]]){
  near(calculateEgfr2021(age,cr,'mgdl',sex),expected);near(calculateEgfr2021(age,cr*88.4,'umol',sex),expected);
 }
 assert.ok(calculateEgfr2021(18,1,'mgdl','male')>0);
 for(const [age,cr,sex]of [[17.999,1,'male'],[0,1,'male'],[50,0,'male'],[50,-1,'female'],[50,NaN,'male'],[50,Infinity,'male'],[NaN,1,'male'],[50,1,'unknown']])assert.equal(calculateEgfr2021(age,cr,'mgdl',sex),undefined);
 assert.equal(calculateEgfr2021(1e300,1,'mgdl','male'),undefined,'underflow is not a measured zero GFR');
});

test('FIB-4 and APRI require correct denominators and lab-specific ULN while accepting AST zero',()=>{
 assert.equal(calculateFib4(50,40,25,200),2);assert.equal(calculateApri(40,40,200),.5);
 assert.equal(calculateFib4(40,50,25,200),2);assert.equal(calculateApri(50,40,200),.625);
 assert.equal(calculateFib4(50,0,25,200),0);assert.equal(calculateApri(0,40,200),0);
 for(const args of [[50,-1,25,200],[50,40,0,200],[50,40,25,0],[17,40,25,200],[50,NaN,25,200],[50,40,Infinity,200]])assert.equal(calculateFib4(...args),undefined);
 for(const args of [[-1,40,200],[40,0,200],[40,40,0],[40,NaN,200],[40,40,Infinity]])assert.equal(calculateApri(...args),undefined);
 assert.equal(calculateApri(40,NaN,200),undefined,'unknown ULN never defaults to 40');
});

test('principal meridians preserve cylinder sign, independent eyes, zero and transposition equivalence',()=>{
 for(const [s,c,first,second,diff]of [[-4,-2,-4,-6,2],[-6,2,-6,-4,2],[2,-4,2,-2,4],[0,0,0,0,0]])assert.deepEqual(calculatePrincipalMeridians(s,c),{first,second,difference:diff});
 for(const [s,c]of [[NaN,1],[1,NaN],[Infinity,0],[1e308,1e308]])assert.equal(calculatePrincipalMeridians(s,c),undefined);
 assert.deepEqual(Object.values(calculatePrincipalMeridians(-4,-2)).slice(0,2).sort(),Object.values(calculatePrincipalMeridians(-6,2)).slice(0,2).sort());
});

test('spirometry ratios use litres, predicted input and pre-test response denominator; negative change is retained',()=>{
 assert.equal(calculateSpirometryRatio(2,4),50);assert.equal(calculatePercentPredicted(2,4),50);assert.equal(calculatePercentPredicted(3.6,3),120);
 const increase=calculateBronchodilatorChange(2,2.3);near(increase.millilitres,300);near(increase.percentBaseline,15);
 const decrease=calculateBronchodilatorChange(2,1.8);near(decrease.millilitres,-200);near(decrease.percentBaseline,-10);
 assert.deepEqual(calculateBronchodilatorChange(2,2),{millilitres:0,percentBaseline:0});
 for(const fn of [calculateSpirometryRatio,calculatePercentPredicted,calculateBronchodilatorChange])for(const args of [[0,1],[1,0],[-1,1],[NaN,1],[1,Infinity]])assert.equal(fn(...args),undefined);
 assert.equal(calculateSpirometryRatio(5,4),125,'inconsistent input remains calculable but must show a warning');
 assert.equal(calculatePercentPredicted(2,NaN),undefined,'predicted is never inferred from demographic data');
});

test('orthopedic lengths compare measured pairs and ROM table keeps canonical angles without classification',()=>{
 assert.deepEqual(compareLimbLengths(90,87.5),{difference:2.5,shorter:'right'});assert.deepEqual(compareLimbLengths(85,85),{difference:0,shorter:'equal'});assert.deepEqual(compareLimbLengths(87.5,90),{difference:2.5,shorter:'left'});
 for(const [a,b]of [[0,1],[1,-1],[NaN,1],[Infinity,2]])assert.equal(compareLimbLengths(a,b),undefined);
 assert.equal(JOINT_REFERENCES.length,18);
 const elbow=JOINT_REFERENCES.find(row=>row.joint==='Ліктьовий'&&row.movement==='Згинання');assert.equal(elbow.normal,'40');assert.equal(elbow.slight,'80');assert.equal(elbow.moderate,'90');assert.equal(elbow.significant,'100');
 assert.equal(JOINT_REFERENCES.find(row=>row.joint==='Ліктьовий'&&row.movement==='Розгинання').normal,'180');
 assert.ok(JOINT_REFERENCES.some(row=>row.moderate==='20-25'),'literal numeric ranges are not normalized');
});

test('specialty routing uses only actual taxonomy and existing articles; navigation cannot select a point',()=>{
 for(const [specialty,tools]of Object.entries(SPECIALTY_TOOLS)){assert.ok(SPECIALTIES.some(item=>item.id===specialty));for(const id of tools)for(const article of SPECIALTY_TOOL_LABELS[id].articles)assert.ok(ARTICLES.some(item=>item.article===article));}
 assert.deepEqual(SPECIALTY_TOOLS.ent,['pta']);assert.deepEqual(SPECIALTY_TOOLS.ophthalmologist,['refraction']);assert.ok(SPECIALTY_TOOLS.surgeon.includes('joints'));
 const ui=read('components/vlk/specialty-calculators.tsx');
 assert.match(ui,/onOpenArticle\(article\)/);assert.doesNotMatch(ui,/setSelectedRuleIndex|setCaseDraft|addCasePoints/);
 assert.match(ui,/Нульове АСТ допустиме/);assert.match(ui,/Знак циліндра зберігається/);assert.match(ui,/таблиці 14 не прирівнюються автоматично/);
 assert.match(ui,/ratio > 100/);assert.match(ui,/дані неузгоджені/);assert.match(ui,/creatinine: ''/);assert.match(ui,/fev1: '', fvc: '', predicted: '', post: ''/);
 assert.doesNotMatch(ui+read('lib/vlk-specialty-calculators.ts'),/localStorage|sessionStorage|fetch\(|sendBeacon|URLSearchParams|pushState|replaceState/);
 assert.match(ui,/aria-invalid=/);assert.match(ui,/aria-describedby=/);assert.match(ui,/returnFocusRef/);
});

test('new coloured Case surfaces retain AA text contrast in both inherited themes',()=>{
 const css=read('app/globals.css');
 const lum=hex=>{const c=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
 for(const selector of [':root','\\.dark']){const body=css.match(new RegExp(`${selector} \\{([\\s\\S]*?)\\n\\}`))[1],tokens=Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/g)].map(m=>[m[1],m[2]]));
  for(const background of ['critical-bg','warning-bg','positive-bg','surface-muted'])for(const foreground of ['foreground','ink-soft']){const a=lum(tokens[foreground]),b=lum(tokens[background]);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${selector} ${foreground}/${background}`);}
 }
});

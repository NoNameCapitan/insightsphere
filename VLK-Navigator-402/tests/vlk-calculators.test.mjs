import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parsePositiveDecimal, calculateBmi, calculateBsa, calculateLvMass, calculateLvMassIndex,
  bmiCategory, massIndexReference, emptyCalculatorFields, evaluateCalculator, requiredCalculatorFields } from '../lib/vlk-calculators.ts';
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (value, expected, tolerance = 1e-9) => assert.ok(Math.abs(value - expected) < tolerance, `${value} != ${expected}`);

test('positive finite decimal parsing accepts either separator and never treats missing as zero', () => {
  for (const [raw, value] of [['175', 175], [' 70,5 ',70.5],['.5',.5],[',5',.5],['0.001',.001],['1000000',1000000]]) assert.deepEqual(parsePositiveDecimal(raw), {kind:'value',value});
  for (const raw of ['', ' ']) assert.deepEqual(parsePositiveDecimal(raw), {kind:'missing'});
  for (const raw of ['0','-1','+1','1,2.3','1.2,3','1,2,3','NaN','Infinity','1e3','20kg','20.','1 000','9'.repeat(400)]) assert.deepEqual(parsePositiveDecimal(raw),{kind:'invalid'},raw);
});

test('independent reference vectors use mm to cm once and retain full intermediate precision', () => {
  for (const [h,w,ivs,lvid,pwt,mass,index] of [[175,70,10,50,10,181.976,98.6500524835],[180,80,12,54,11,249.425408,124.712704],[160,60,9,45,9,132.823104,81.3372077132]]) {
    near(calculateLvMass(ivs,lvid,pwt),mass);near(calculateLvMassIndex(calculateLvMass(ivs,lvid,pwt),calculateBsa(h,w)),index);
    const result=evaluateCalculator('index','dimensions',{height:String(h),weight:String(w),ivs:String(ivs),lvid:String(lvid),pwt:String(pwt),mass:''});
    assert.equal(result.kind,'result');near(result.value,index);
  }
  for(const [weight,threshold]of [[47.36,18.5],[64,25],[76.8,30],[89.6,35],[102.4,40]]){assert.equal(calculateBmi(160,weight),threshold);assert.ok(calculateBmi(160,weight-0.00001)<threshold);assert.ok(calculateBmi(160,weight+0.00001)>threshold);}
  assert.equal(bmiCategory(calculateBmi(160,64)),'Надлишкова маса тіла');
  assert.equal(bmiCategory(calculateBmi(160,76.8)),'Діапазон ожиріння I ступеня');
  near(calculateBmi(175,70),22.857142857142858);near(calculateBsa(175,70),1.8446619684315546);assert.equal(calculateBsa(180,80),2);
});

test('invalid and unrepresentable calculations produce no usable number or stale result', () => {
  for(const value of [0,-1,NaN,Infinity]) {
    assert.equal(calculateBmi(value,70),undefined);assert.equal(calculateBmi(175,value),undefined);
    assert.equal(calculateBsa(value,70),undefined);assert.equal(calculateLvMass(value,50,10),undefined);
    assert.equal(calculateLvMass(10,value,10),undefined);assert.equal(calculateLvMass(10,50,value),undefined);
    assert.equal(calculateLvMassIndex(180,value),undefined);
  }
  assert.equal(calculateLvMass(1e200,1e200,1e200),undefined);
  assert.equal(evaluateCalculator('bmi','dimensions',emptyCalculatorFields()).kind,'incomplete');
  const fields={...emptyCalculatorFields(),height:'175',weight:'70'};
  assert.equal(evaluateCalculator('bmi','dimensions',fields).kind,'result');
  for(const weight of ['','0','1,2.3']){const r=evaluateCalculator('bmi','dimensions',{...fields,weight});assert.equal(r.kind,'incomplete');assert.equal(r.value,undefined);}
  assert.equal(evaluateCalculator('bmi','dimensions',{...fields,height:'9'.repeat(300)}).kind,'range-error');
});

test('BMI categories use unrounded values with exact inclusive cutoffs and no diagnosis output', () => {
  const names=['Недостатня маса тіла','Референтний діапазон маси тіла','Надлишкова маса тіла','Діапазон ожиріння I ступеня','Діапазон ожиріння II ступеня','Діапазон ожиріння III ступеня'];
  [18.499999,18.5,25,30,35,40].forEach((n,i)=>assert.equal(bmiCategory(n),names[i]));
  [18.5,25,30,35,40].forEach((n,i)=>assert.equal(bmiCategory(n-1e-8),names[i]));
  for(const n of [0,-1,NaN,Infinity])assert.equal(bmiCategory(n),undefined);
});

test('LV mass index is sex-independent; sex and method gate reference comparison only', () => {
  for(const [sex,method,lower,upper]of [['female','linear',43,95],['male','linear',49,115],['female','2d',44,88],['male','2d',50,102]]) {
    assert.deepEqual(massIndexReference(upper,sex,method),{lower,upper,status:'within'});
    assert.equal(massIndexReference(upper+1e-8,sex,method).status,'above');
    assert.equal(massIndexReference(lower,sex,method).status,'within');
    assert.equal(massIndexReference(lower-1e-8,sex,method).status,'below');
  }
  assert.equal(massIndexReference(100,'unknown','linear'),undefined);assert.equal(massIndexReference(100,'female','unknown'),undefined);
  for(const [mass,sex,expected]of [[190,'female',95],[230,'male',115]]) {
    const r=evaluateCalculator('index','report',{...emptyCalculatorFields(),height:'180',weight:'80',mass:String(mass)});assert.equal(r.kind,'result');assert.equal(r.value,expected);assert.equal(massIndexReference(r.value,sex,'linear').status,'within');
  }
});

test('each calculator only depends on visible required fields; source changes invalidate missing alternatives', () => {
  assert.deepEqual(requiredCalculatorFields('bmi','dimensions'),['height','weight']);
  assert.deepEqual(requiredCalculatorFields('mass','dimensions'),['ivs','lvid','pwt']);
  assert.deepEqual(requiredCalculatorFields('index','report'),['height','weight','mass']);
  const fields={height:'175',weight:'70',ivs:'10',lvid:'50',pwt:'10',mass:''};
  assert.equal(evaluateCalculator('mass','dimensions',{...fields,height:'invalid'}).kind,'result');
  assert.equal(evaluateCalculator('index','report',fields).kind,'incomplete');
  assert.equal(evaluateCalculator('index','report',{...fields,ivs:'invalid',mass:'181,976'}).kind,'result');
});

test('therapist tools are discoverable, scoped, ephemeral and reset with local/cross-tab session resets', () => {
  const ui=read('components/vlk/therapist-calculators.tsx'),logic=read('lib/vlk-calculators.ts'),page=read('app/page.tsx');
  assert.match(page,/<SpecialtyCalculators key=\{`\$\{caseEpoch\}-\$\{specialty\}`\} specialty=\{specialty\}/);
  assert.match(read('components/vlk/specialty-calculators.tsx'),/specialty === 'therapist' \? <TherapistCalculators/);
  assert.match(ui,/aria-label="Калькулятори терапевта"/);assert.match(ui,/returnFocusRef/);assert.match(ui,/onOpenAutoFocus/);
  assert.match(ui,/в кінці діастоли, у міліметрах/);assert.match(ui,/Лінійні розміри з 2D-зображення не означають/);
  assert.match(ui,/Метод невідомий: результат без референтної оцінки/);assert.match(ui,/При ожирінні індексація на ППТ може приховувати/);
  assert.match(ui,/не діагноз і не постанова ВЛК/);assert.match(ui,/Попередній результат прибрано/);
  assert.doesNotMatch(ui+logic,/localStorage|sessionStorage|fetch\(|sendBeacon|URLSearchParams|pushState|replaceState/);
  assert.match(ui,/aria-pressed=/);assert.match(ui,/aria-invalid=/);assert.match(ui,/aria-describedby=/);
  assert.match(ui,/source === 'dimensions' \? 'linear' : method/);
});

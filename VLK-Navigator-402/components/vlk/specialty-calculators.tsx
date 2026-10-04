"use client";

import { useRef, useState, type RefObject } from 'react';
import { Calculator, ChevronDown, ExternalLink, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VlkDialogContent } from '@/components/vlk/dialog-content';
import { TherapistCalculators } from '@/components/vlk/therapist-calculators';
import { SPECIALTY_TOOLS, SPECIALTY_TOOL_LABELS, type SpecialtyTool } from '@/lib/vlk-specialty-tools';
import { ARTICLES, type SpecialtyId } from '@/lib/vlk-sample-data';
import { JOINT_REFERENCES, JOINT_REFERENCE_SOURCE } from '@/lib/vlk-joint-reference';
import { calculateApri, calculateBronchodilatorChange, calculateEgfr2021, calculateFib4, calculatePercentPredicted,
  calculatePrincipalMeridians, calculatePta4, calculateSpirometryRatio, compareLimbLengths, parseClinicalNumber,
  CLINICAL_SOURCES, type ClinicalNumberKind, type CreatinineUnit, type EquationSex } from '@/lib/vlk-specialty-calculators';

const format = (value: number, signed = false) => value.toLocaleString('uk-UA', { maximumFractionDigits: 2, ...(signed ? { signDisplay: 'exceptZero' as const } : {}) });
const FIELDS = {
  age: { label: 'Вік', unit: 'років', kind: 'positive' }, creatinine: { label: 'Креатинін', unit: '', kind: 'positive' },
  ast: { label: 'АСТ', unit: 'Од/л', kind: 'nonnegative' }, alt: { label: 'АЛТ', unit: 'Од/л', kind: 'positive' },
  platelets: { label: 'Тромбоцити', unit: '×10⁹/л', kind: 'positive' }, astUln: { label: 'Верхня межа АСТ із лабораторії', unit: 'Од/л', kind: 'positive' },
  fev1: { label: 'ОФВ1', unit: 'л', kind: 'positive' }, fvc: { label: 'ФЖЄЛ', unit: 'л', kind: 'positive' },
  predicted: { label: 'Належний ОФВ1 із протоколу', unit: 'л · за потреби', kind: 'positive' },
  post: { label: 'ОФВ1 після бронхолітика', unit: 'л · за потреби', kind: 'positive' },
  leftLength: { label: 'Ліва кінцівка', unit: 'см', kind: 'positive' }, rightLength: { label: 'Права кінцівка', unit: 'см', kind: 'positive' },
  rom: { label: 'Виміряний кут', unit: 'градусів', kind: 'signed' },
  rightSphere: { label: 'OD · сфера', unit: 'дптр', kind: 'signed' }, rightCylinder: { label: 'OD · циліндр зі знаком', unit: 'дптр', kind: 'signed' },
  leftSphere: { label: 'OS · сфера', unit: 'дптр', kind: 'signed' }, leftCylinder: { label: 'OS · циліндр зі знаком', unit: 'дптр', kind: 'signed' },
  right500: { label: '500 Гц', unit: 'dB HL', kind: 'signed' }, right1000: { label: '1000 Гц', unit: 'dB HL', kind: 'signed' },
  right2000: { label: '2000 Гц', unit: 'dB HL', kind: 'signed' }, right4000: { label: '4000 Гц', unit: 'dB HL', kind: 'signed' },
  left500: { label: '500 Гц', unit: 'dB HL', kind: 'signed' }, left1000: { label: '1000 Гц', unit: 'dB HL', kind: 'signed' },
  left2000: { label: '2000 Гц', unit: 'dB HL', kind: 'signed' }, left4000: { label: '4000 Гц', unit: 'dB HL', kind: 'signed' },
} satisfies Record<string, { label: string; unit: string; kind: ClinicalNumberKind }>;
type Field = keyof typeof FIELDS;
const empty = () => Object.fromEntries(Object.keys(FIELDS).map(key => [key, ''])) as Record<Field, string>;

export function SpecialtyCalculators({ specialty, onOpenArticle }: { specialty: SpecialtyId; onOpenArticle: (article: string) => void }) {
  const tools = SPECIALTY_TOOLS[specialty] ?? [];
  const [tool, setTool] = useState<SpecialtyTool>('egfr');
  const [open, setOpen] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const moreRef = useRef<HTMLDetailsElement | null>(null);
  const entries = tools.map(id => <Button key={id} type="button" variant="outline" title={SPECIALTY_TOOL_LABELS[id].title}
    onClick={event => {
      returnFocusRef.current = specialty === 'therapist' ? moreRef.current?.querySelector('summary') ?? event.currentTarget : event.currentTarget;
      if (moreRef.current) moreRef.current.open = false;
      setTool(id); setOpen(true);
    }}>{SPECIALTY_TOOL_LABELS[id].label}</Button>);
  if (!tools.length) return null;
  return <>
    {specialty === 'therapist' ? <TherapistCalculators extraTools={<details className="clinical-more" ref={moreRef}><summary>Ще 3 <ChevronDown aria-hidden="true" /></summary><div>{entries}</div></details>} />
      : <section className="therapist-tools" aria-label="Інструменти спеціальності"><span><Calculator aria-hidden="true" />Швидкі розрахунки</span><div>{entries}</div><small>Локально · без постанови ВЛК</small></section>}
    <SpecialtyCalculatorDialog key={tool} tool={tool} open={open} onOpenChange={setOpen} returnFocusRef={returnFocusRef} onOpenArticle={article => { setOpen(false); onOpenArticle(article); }} />
  </>;
}

function SpecialtyCalculatorDialog({ tool, open, onOpenChange, returnFocusRef, onOpenArticle }: {
  tool: SpecialtyTool; open: boolean; onOpenChange: (open: boolean) => void;
  returnFocusRef: RefObject<HTMLElement | null>; onOpenArticle: (article: string) => void;
}) {
  const [fields, setFields] = useState(empty);
  const [sex, setSex] = useState<EquationSex>('unknown');
  const [unit, setUnit] = useState<CreatinineUnit>('umol');
  const [liverMode, setLiverMode] = useState<'fib4' | 'apri'>('fib4');
  const [stage, setStage] = useState<'pre' | 'post'>('pre');
  const [orthoMode, setOrthoMode] = useState<'length' | 'rom'>('length');
  const [limb, setLimb] = useState<'leg' | 'arm'>('leg');
  const [jointRow, setJointRow] = useState('');
  const fieldsRef = useRef<HTMLDivElement | null>(null);
  const value = (key: Field) => { const parsed = parseClinicalNumber(fields[key], FIELDS[key].kind); return parsed.kind === 'value' ? parsed.value : NaN; };
  const info = SPECIALTY_TOOL_LABELS[tool];
  function clear() { setFields(empty()); setSex('unknown'); setJointRow(''); fieldsRef.current?.querySelector<HTMLInputElement>('input')?.focus(); }
  function field(key: Field, label?: string, customUnit?: string) {
    const meta = FIELDS[key], parsed = parseClinicalNumber(fields[key], meta.kind);
    const invalid = parsed.kind === 'invalid' || key === 'age' && parsed.kind === 'value' && parsed.value < 18;
    return <label key={key} htmlFor={`clinical-${key}`}>{label ?? meta.label} <span>{customUnit ?? meta.unit}</span>
      <input id={`clinical-${key}`} inputMode="decimal" autoComplete="off" spellCheck={false} value={fields[key]} aria-invalid={invalid}
        aria-describedby={invalid ? `clinical-${key}-error` : undefined} onChange={event => setFields(current => ({ ...current, [key]: event.target.value }))} />
      {invalid ? <span className="calculator-error" id={`clinical-${key}-error`}>{key === 'age' ? 'Для дорослих від 18 років' : meta.kind === 'signed' ? 'Введіть точне число зі знаком; NR або >межа не є числом' : meta.kind === 'nonnegative' ? 'Число від 0; кома або крапка' : 'Додатне число; кома або крапка'}</span> : null}
    </label>;
  }
  function number(label: string, result: number | undefined, resultUnit: string, signed = false) {
    return <div className="clinical-result-line" data-result-label={label} data-result-state={result === undefined ? 'incomplete' : 'result'}><span>{label}</span>
      {result === undefined ? <p className="calculator-muted">Введіть потрібні коректні дані</p> : <p className="clinical-number">{format(result, signed)} <small>{resultUnit}</small></p>}
    </div>;
  }
  const egfr = calculateEgfr2021(value('age'), value('creatinine'), unit, sex);
  const liver = liverMode === 'fib4' ? calculateFib4(value('age'), value('ast'), value('alt'), value('platelets')) : calculateApri(value('ast'), value('astUln'), value('platelets'));
  const ratio = calculateSpirometryRatio(value('fev1'), value('fvc'));
  const percentPredicted = calculatePercentPredicted(value('fev1'), value('predicted'));
  const response = stage === 'pre' ? calculateBronchodilatorChange(value('fev1'), value('post')) : undefined;
  const lengths = compareLimbLengths(value('leftLength'), value('rightLength'));
  const selectedJoint = JOINT_REFERENCES.find(row => row.id === jointRow);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <VlkDialogContent className="calculator-dialog specialty-calculator-dialog" showCloseButton={false} returnFocusRef={returnFocusRef}
      onOpenAutoFocus={event => { event.preventDefault(); fieldsRef.current?.querySelector<HTMLInputElement>('input')?.focus(); }}>
      <DialogHeader className="calculator-heading"><div><DialogTitle>{info.label}</DialogTitle><DialogDescription>{info.title} · для дорослих</DialogDescription></div><DialogClose asChild><Button variant="ghost" size="icon" aria-label="Закрити розрахунок"><X /></Button></DialogClose></DialogHeader>
      <div className="calculator-body"><div ref={fieldsRef}>
        {tool === 'egfr' ? <>
          <p className="calculator-field-note">CKD-EPI 2021 · креатинінова формула без коефіцієнта раси</p>
          <div className="calculator-fields calculator-body-fields">{field('age')}<label htmlFor="clinical-sex">Стать для формули<select id="clinical-sex" value={sex} onChange={event => setSex(event.target.value as EquationSex)}><option value="unknown">Оберіть</option><option value="female">Жіноча</option><option value="male">Чоловіча</option></select></label>
            {field('creatinine', undefined, unit === 'umol' ? 'мкмоль/л' : 'мг/дл')}<label htmlFor="clinical-unit">Одиниці креатиніну<select id="clinical-unit" value={unit} onChange={event => { setUnit(event.target.value as CreatinineUnit); setFields(current => ({ ...current, creatinine: '' })); }}><option value="umol">мкмоль/л</option><option value="mgdl">мг/дл</option></select></label></div>
          <div className="calculator-result" role="status" aria-live="polite">{number('рШКФ', egfr, 'мл/хв/1,73 м²')}{sex === 'unknown' ? <p className="calculator-muted">Для обчислення оберіть стать.</p> : null}</div>
          <p className="calculator-scope">Для дорослих від 18 років зі стабільним креатиніном. За гострих змін або нетипової м’язової маси оцінка може бути неточною. Результат сам по собі не встановлює ХХН. №402 не визначає рік формули CKD-EPI.</p>
        </> : null}
        {tool === 'liver' ? <>
          <div className="calculator-switch" role="group" aria-label="Індекс печінки"><button type="button" aria-pressed={liverMode === 'fib4'} onClick={() => setLiverMode('fib4')}>FIB-4</button><button type="button" aria-pressed={liverMode === 'apri'} onClick={() => setLiverMode('apri')}>APRI</button></div>
          <div className="calculator-fields calculator-body-fields">{liverMode === 'fib4' ? field('age') : null}{field('ast')}{liverMode === 'fib4' ? field('alt') : field('astUln')}{field('platelets')}</div>
          <div className="calculator-result" role="status" aria-live="polite">{number(liverMode === 'fib4' ? 'FIB-4' : 'APRI', liver, '')}</div>
          <p className="calculator-scope">Непрямі індекси, не діагноз F4. Оцінюються разом із клінікою та інструментальними даними; гострий стан і позапечінкові причини змін АСТ / тромбоцитів можуть спотворити результат.</p>
          {liverMode === 'fib4' && (value('age') < 35 || value('age') > 65) && value('age') >= 18 ? <p className="calculator-caution">Вікова інтерпретація залежить від захворювання. Пороги з рекомендацій для MASLD не переносимо автоматично на вірусні гепатити.</p> : null}
        </> : null}
        {tool === 'pta' ? <>
          <p className="calculator-field-note">Повітряна провідність · пороги 500, 1000, 2000 і 4000 Гц. Від’ємні та нульові dB HL допустимі; відсутня відповідь (NR) не дорівнює 0.</p>
          {(['right', 'left'] as const).map(ear => <fieldset className="clinical-paired" key={ear}><legend>{ear === 'right' ? 'Праве вухо' : 'Ліве вухо'}</legend><div className="calculator-fields clinical-four-fields">{(['500', '1000', '2000', '4000'] as const).map(hz => field(`${ear}${hz}`))}</div>
            <div className="calculator-result" role="status" aria-live="polite">{number(ear === 'right' ? 'PTA4 · праве' : 'PTA4 · ліве', calculatePta4(['500','1000','2000','4000'].map(hz => value(`${ear}${hz}` as Field))), 'dB HL')}</div></fieldset>)}
          <p className="calculator-scope">Кожне вухо обчислюється окремо. PTA4 не замінює повну аудіограму, встановлення причини порушення слуху та вимоги статті 36.</p>
        </> : null}
        {tool === 'refraction' ? <>
          <p className="calculator-field-note">Sph і Cyl зі знаком. Вісь не потрібна для обчислення оптичної сили; діоптрії не переводяться у гостроту зору.</p>
          {(['right', 'left'] as const).map(eye => { const result = calculatePrincipalMeridians(value(`${eye}Sphere`), value(`${eye}Cylinder`)); return <fieldset className="clinical-paired" key={eye}><legend>{eye === 'right' ? 'OD · праве око' : 'OS · ліве око'}</legend><div className="calculator-fields calculator-body-fields">{field(`${eye}Sphere`)}{field(`${eye}Cylinder`)}</div>
            <div className="calculator-result" role="status" aria-live="polite"><div className="clinical-meridians">{number('Меридіан 1', result?.first, 'дптр', true)}{number('Меридіан 2', result?.second, 'дптр', true)}{number('Різниця меридіанів', result?.difference, 'дптр')}</div></div></fieldset>; })}
          <p className="calculator-scope">За даними скіаскопії / рефрактометрії. При зміні ступеня придатності стаття 30 вимагає циклоплегії. Розрахунок не замінює вимірювання гостроти зору.</p>
        </> : null}
        {tool === 'spirometry' ? <>
          <label htmlFor="clinical-stage">Етап вимірювання<select id="clinical-stage" value={stage} onChange={event => { setStage(event.target.value as 'pre' | 'post'); setFields(current => ({ ...current, fev1: '', fvc: '', predicted: '', post: '' })); }}><option value="pre">До бронхолітика</option><option value="post">Після бронхолітика</option></select></label>
          <p className="calculator-field-note">ОФВ1 і ФЖЄЛ — з одного дослідження, одного етапу. Всі об’єми у літрах. Зміна етапу очищає ці поля.</p>
          <div className="calculator-fields calculator-body-fields">{field('fev1', `ОФВ1 ${stage === 'pre' ? 'до' : 'після'}`)}{field('fvc', `ФЖЄЛ ${stage === 'pre' ? 'до' : 'після'}`)}{field('predicted')}{stage === 'pre' ? field('post') : null}</div>
          <div className="calculator-result" role="status" aria-live="polite">{number('ОФВ1 / ФЖЄЛ', ratio, '%')}{number('ОФВ1 від належного', percentPredicted, '%')}
            {ratio !== undefined && ratio > 100 ? <p className="calculator-caution">ОФВ1 перевищує ФЖЄЛ: дані неузгоджені. Перевірте протокол, одиниці та етап дослідження.</p> : null}
            {stage === 'pre' && fields.post ? <>{number('Зміна ОФВ1 після − до', response?.millilitres, 'мл', true)}{number('Зміна від вихідного ОФВ1', response?.percentBaseline, '%', true)}</> : null}</div>
          <p className="calculator-scope">Використовуйте якісне дослідження та належне значення з протоколу. Приріст розраховано від вихідного ОФВ1, не від належного. Відсоток понад 100 не обрізається; діагноз і ступінь порушення не визначаються.</p>
        </> : null}
        {tool === 'joints' ? <>
          <div className="calculator-switch" role="group" aria-label="Ортопедичні виміри"><button type="button" aria-pressed={orthoMode === 'length'} onClick={() => setOrthoMode('length')}>Довжина кінцівок</button><button type="button" aria-pressed={orthoMode === 'rom'} onClick={() => setOrthoMode('rom')}>Рухи · таблиця 14</button></div>
          {orthoMode === 'length' ? <><label htmlFor="clinical-limb">Однакові парні кінцівки<select id="clinical-limb" value={limb} onChange={event => { setLimb(event.target.value as 'leg' | 'arm'); setFields(current => ({ ...current, leftLength: '', rightLength: '' })); }}><option value="leg">Нижні кінцівки</option><option value="arm">Верхні кінцівки</option></select></label>
            <p className="calculator-field-note">Виміряні лікарем довжини за однаковою методикою, у сантиметрах</p><div className="calculator-fields calculator-body-fields">{field('leftLength')}{field('rightLength')}</div>
            <div className="calculator-result" role="status" aria-live="polite">{number('Різниця довжин', lengths?.difference, 'см')}{lengths ? <p>{lengths.shorter === 'equal' ? 'Введені довжини однакові' : `${lengths.shorter === 'left' ? 'Ліва' : 'Права'} кінцівка коротша за введеними вимірами`}</p> : null}</div></>
            : <><label htmlFor="clinical-joint">Суглоб і рух із таблиці 14<select id="clinical-joint" value={jointRow} onChange={event => setJointRow(event.target.value)}><option value="">Оберіть рядок</option>{JOINT_REFERENCES.map(row => <option key={row.id} value={row.id}>{row.joint} · {row.movement}</option>)}</select></label><div className="calculator-fields">{field('rom')}</div>
              <div className="calculator-result" role="status" aria-live="polite">{number('Ваш вимір · без класифікації', Number.isFinite(value('rom')) ? value('rom') : undefined, '°')}
                {selectedJoint ? <><p className="calculator-field-note">Довідкові значення, дослівно з рядка таблиці 14</p><dl className="clinical-joint-reference"><div><dt>Норма</dt><dd>{selectedJoint.normal}°</dd></div><div><dt>Незначне</dt><dd>{selectedJoint.slight}°</dd></div><div><dt>Помірне</dt><dd>{selectedJoint.moderate}°</dd></div><div><dt>Значне</dt><dd>{selectedJoint.significant}°</dd></div></dl></> : null}</div></>}
          <p className="calculator-scope">Вимірювання та методику підтверджує лікар. Кути таблиці 14 не прирівнюються автоматично до запису за методом нейтрального нуля. Ступінь порушення й пункт статті не обираються.</p>
        </> : null}
      </div>
      <p className="calculator-scope">Розрахункова довідка, не діагноз і не постанова ВЛК. Дані лише в пам’яті вкладки; не надсилаються та не додаються у «Випадок».</p>
      <div className="clinical-article-links"><span>Звірити №402:</span>{info.articles.map(article => <Button key={article} variant="outline" onClick={() => onOpenArticle(article)}>Ст. {article} · {ARTICLES.find(item => item.article === article)?.title}</Button>)}</div>
      <details className="calculator-method"><summary>Формули та джерела</summary>
        {tool === 'egfr' ? <><p>рШКФ = 142 × min(Scr/k, 1)^α × max(Scr/k, 1)^−1,200 × 0,9938^вік × 1,012 (лише для жінок). Scr у мг/дл; мкмоль/л діляться на 88,4. Жінки: k=0,7, α=−0,241; чоловіки: k=0,9, α=−0,302.</p><p>Зміна одиниць очищає креатинін, щоб не переінтерпретувати попереднє число. Вибір 2021 — явно названий клінічний метод; у статті 66 рік CKD-EPI не зазначено.</p><Source href={CLINICAL_SOURCES.egfr}>NIDDK · CKD-EPI 2021</Source><Source href={CLINICAL_SOURCES.egfrLimits}>NIDDK · межі інтерпретації</Source></> : null}
        {tool === 'liver' ? <><p>FIB-4 = вік × АСТ / [тромбоцити × √АЛТ]. APRI = 100 × (АСТ / верхня межа АСТ) / тромбоцити. АСТ, АЛТ і верхня межа — Од/л; тромбоцити — ×10⁹/л. Нульове АСТ допустиме; відсутнє значення не дорівнює нулю.</p><p>Лабораторну верхню межу АСТ вводьте самостійно; стандартне значення не підставляється. Числа не перетворюються на стадію фіброзу.</p><Source href={CLINICAL_SOURCES.fib4}>University of Washington · FIB-4</Source><Source href={CLINICAL_SOURCES.apri}>University of Washington · APRI</Source></> : null}
        {tool === 'pta' ? <><p>PTA4 = (T500 + T1000 + T2000 + T4000) / 4 окремо для кожного вуха. Нуль, від’ємний поріг, відсутній вимір та NR — різні стани. За неповного набору чотирьох порогів середнє не надається.</p><Source href={CLINICAL_SOURCES.hearing}>ASHA · тональна аудіометрія</Source></> : null}
        {tool === 'refraction' ? <><p>M1 = Sph; M2 = Sph + Cyl; різниця = |Cyl|. Знак циліндра зберігається до додавання. Меридіани не усереднюються для застосування статті 30.</p><Source href="https://opticampus.opti.vision/files/introduction_to_ophthalmic_optics.pdf#page=35">Carl Zeiss Vision · головні меридіани</Source></> : null}
        {tool === 'spirometry' ? <><p>Відношення = ОФВ1 / ФЖЄЛ × 100%. ОФВ1 від належного = виміряний / належний × 100%. Зміна у мл = (після − до) × 1000; зміна від вихідного = (після − до) / до × 100%.</p><p>Знаменник приросту — вихідний ОФВ1, відповідно до наведеного у статті 47 способу. Це не новіший розрахунок приросту від належного. Автоматичного висновку щодо обструкції, астми або ступеня порушення немає.</p><Source href="https://channel.ersnet.org/media-113710-interpretation">ERS · інтерпретація досліджень</Source><Source href="https://ginasthma.org/wp-content/uploads/2026/05/GINA-2026-Strategy-Report-WMS.pdf">GINA 2026 · приріст від вихідного ОФВ1</Source></> : null}
        {tool === 'joints' ? <><p>Різниця довжин = |ліва − права|. Порівнюються виміри однакових парних кінцівок. Обсяг рухів записується окремо; арифметичного перетворення між методиками й автоматичної оцінки за таблицею 14 немає.</p><Source href={JOINT_REFERENCE_SOURCE}>Стаття 61 · таблиця 14, офіційний №402</Source></> : null}
        <p>Відображення округлене; формули використовують повну точність. Усі нормативні переходи відкривають статтю без автоматичного вибору пункту.</p>
      </details>
      <Button className="calculator-reset" variant="ghost" disabled={!Object.values(fields).some(Boolean) && sex === 'unknown' && !jointRow} onClick={clear}><RotateCcw />Очистити розрахунок</Button>
      </div>
    </VlkDialogContent>
  </Dialog>;
}
function Source({ href, children }: { href: string; children: React.ReactNode }) { return <a href={href} target="_blank" rel="noreferrer">{children} <ExternalLink aria-hidden="true" /></a>; }

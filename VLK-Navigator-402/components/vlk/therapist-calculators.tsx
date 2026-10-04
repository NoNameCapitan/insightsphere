"use client";

import { useRef, useState, type ReactNode } from 'react';
import { Calculator, ExternalLink, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VlkDialogContent } from '@/components/vlk/dialog-content';
import { CALCULATOR_FIELDS, CALCULATOR_SOURCES, bmiCategory, emptyCalculatorFields, evaluateCalculator,
  massIndexReference, parsePositiveDecimal, requiredCalculatorFields,
  type CalculatorFields, type CalculatorMode, type MassMethod, type MassSource, type ReferenceSex } from '@/lib/vlk-calculators';

const MODES = { bmi: { label: 'ІМТ', title: 'Індекс маси тіла', unit: 'кг/м²' },
  mass: { label: 'ММЛШ', title: 'Маса міокарда лівого шлуночка', unit: 'г' },
  index: { label: 'ІММЛШ', title: 'Індекс маси міокарда ЛШ', unit: 'г/м²' } } as const;
const format = (value: number) => value.toLocaleString('uk-UA', { maximumFractionDigits: 2 });

export function TherapistCalculators({ extraTools }: { extraTools?: ReactNode } = {}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CalculatorMode>('bmi');
  const [fields, setFields] = useState(emptyCalculatorFields);
  const [source, setSource] = useState<MassSource>('dimensions');
  const [method, setMethod] = useState<MassMethod>('unknown');
  const [sex, setSex] = useState<ReferenceSex>('unknown');
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const fieldsetRef = useRef<HTMLDivElement | null>(null);
  const result = evaluateCalculator(mode, source, fields);
  const reference = mode === 'index' && result.kind === 'result' ? massIndexReference(result.value, sex, source === 'dimensions' ? 'linear' : method) : undefined;
  const keys = requiredCalculatorFields(mode, source);
  const hasData = Object.values(fields).some(Boolean) || sex !== 'unknown' || method !== 'unknown';
  function clear() { setFields(emptyCalculatorFields()); setSex('unknown'); setMethod('unknown'); fieldsetRef.current?.querySelector<HTMLInputElement>('input:not([type="radio"])')?.focus(); }
  function field(key: keyof CalculatorFields) {
    const meta = CALCULATOR_FIELDS[key], invalid = parsePositiveDecimal(fields[key]).kind === 'invalid';
    return <label key={key} htmlFor={`calc-${key}`}>{meta.label} <span>{meta.unit}</span>
      <input id={`calc-${key}`} inputMode="decimal" autoComplete="off" spellCheck={false} placeholder={meta.hint} value={fields[key]}
        aria-invalid={invalid} aria-describedby={invalid ? `calc-${key}-error` : undefined}
        onChange={event => setFields(current => ({ ...current, [key]: event.target.value }))} />
      {invalid ? <span className="calculator-error" id={`calc-${key}-error`}>Додатне число; кома або крапка</span> : null}
    </label>;
  }
  return <>
    <section className="therapist-tools" aria-label="Калькулятори терапевта">
      <span><Calculator aria-hidden="true" />Швидкі розрахунки</span>
      <div>{(Object.keys(MODES) as CalculatorMode[]).map(key => <Button key={key} variant="outline" title={MODES[key].title}
        onClick={event => { returnFocusRef.current = event.currentTarget; setMode(key); setOpen(true); }}>{MODES[key].label}</Button>)}</div>
      {extraTools}
      <small>Для дорослих · локально</small>
    </section>
    <Dialog open={open} onOpenChange={setOpen}>
      <VlkDialogContent className="calculator-dialog" showCloseButton={false} returnFocusRef={returnFocusRef}
        onOpenAutoFocus={event => { event.preventDefault(); fieldsetRef.current?.querySelector<HTMLInputElement>('input:not([type="radio"])')?.focus(); }}>
        <DialogHeader className="calculator-heading"><div><DialogTitle>{MODES[mode].label}</DialogTitle><DialogDescription>{MODES[mode].title} · для дорослих</DialogDescription></div>
          <DialogClose asChild><Button variant="ghost" size="icon" aria-label="Закрити калькулятор"><X /></Button></DialogClose>
        </DialogHeader>
        <div className="calculator-body">
          <div className="calculator-switch" role="group" aria-label="Оберіть розрахунок">{(Object.keys(MODES) as CalculatorMode[]).map(key => <button key={key} type="button" aria-pressed={mode === key} onClick={() => setMode(key)}>{MODES[key].label}</button>)}</div>
          <div ref={fieldsetRef}>
            {mode !== 'bmi' ? <fieldset className="calculator-source"><legend>Джерело маси міокарда</legend><div>
              <label><input type="radio" name="mass-source" value="dimensions" checked={source === 'dimensions'} onChange={() => setSource('dimensions')} />За розмірами ЕхоКГ</label>
              <label><input type="radio" name="mass-source" value="report" checked={source === 'report'} onChange={() => setSource('report')} />Готова маса з протоколу</label>
            </div></fieldset> : null}
            {mode !== 'mass' ? <div className="calculator-fields calculator-body-fields">{keys.filter(key => key === 'height' || key === 'weight').map(field)}</div> : null}
            {mode !== 'bmi' && source === 'dimensions' ? <><p className="calculator-field-note">Усі три розміри в кінці діастоли, у міліметрах (мм)</p><div className="calculator-fields calculator-echo-fields">{keys.filter(key => ['ivs', 'lvid', 'pwt'].includes(key)).map(field)}</div></> : null}
            {mode !== 'bmi' && source === 'report' ? <div className="calculator-fields">{field('mass')}</div> : null}
            {mode === 'index' ? <div className="calculator-reference-fields">
              <label htmlFor="calc-sex">Стать <span>лише для референтних меж</span><select id="calc-sex" value={sex} onChange={event => setSex(event.target.value as ReferenceSex)}><option value="unknown">Не вказано</option><option value="female">Жіноча</option><option value="male">Чоловіча</option></select></label>
              {source === 'report' ? <label htmlFor="calc-method">Метод у протоколі<select id="calc-method" value={method} onChange={event => setMethod(event.target.value as MassMethod)}><option value="unknown">Невідомий / інший</option><option value="linear">Лінійний метод (ASE)</option><option value="2d">Двовимірний об’ємний метод (2D)</option></select></label> : null}
            </div> : null}
          </div>
          <div className="calculator-result" role="status" aria-live="polite" aria-atomic="true" data-calculation-state={result.kind}>
            {result.kind === 'result' ? <><span className="calculator-result-label">{MODES[mode].label}{source === 'report' && mode === 'mass' ? ' · із протоколу' : ''}</span><p className="calculator-value">{format(result.value)} <span>{MODES[mode].unit}</span></p>
              {mode === 'bmi' ? <p>{bmiCategory(result.value)} <span className="calculator-muted">· довідкова категорія</span></p> : null}
              {mode === 'index' ? <><p className="calculator-breakdown">ММЛШ {format(result.mass!)} г / ППТ {format(result.bsa!)} м² <span>· Mosteller</span></p>
                {reference ? <p className="calculator-reference" data-reference-status={reference.status}>{reference.status === 'above' ? 'Вище верхньої референтної межі' : reference.status === 'below' ? 'Нижче нижньої референтної межі' : 'У референтному діапазоні'}<br /><span>{reference.lower}–{reference.upper} г/м² · {source === 'dimensions' || method === 'linear' ? 'лінійний метод' : '2D-об’ємний метод'} · {sex === 'female' ? 'жінки' : 'чоловіки'}</span></p>
                : <p className="calculator-muted">{source === 'report' && method === 'unknown' ? 'Метод невідомий: результат без референтної оцінки.' : 'Оберіть стать, щоб побачити референтні межі.'}</p>}
                {result.bmi !== undefined && result.bmi >= 30 ? <p className="calculator-caution">При ожирінні індексація на ППТ може приховувати збільшення маси ЛШ. Потрібна клінічна інтерпретація.</p> : null}</> : null}
            </> : <p className="calculator-empty">{result.kind === 'range-error' ? 'Не вдалося обчислити скінченний результат. Перевірте величини та одиниці.' : result.invalid.length ? 'Виправте позначені поля. Попередній результат прибрано.' : `Введіть ${result.missing.map(key => CALCULATOR_FIELDS[key].short).join(', ')} — результат з’явиться одразу.`}</p>}
          </div>
          <p className="calculator-scope">Розрахункова довідка, не діагноз і не постанова ВЛК. Дані лише в пам’яті вкладки; не зберігаються й не додаються у «Випадок».</p>
          <details className="calculator-method"><summary>Формули, одиниці та джерела</summary>
            {mode === 'bmi' ? <><p>ІМТ = вага (кг) / зріст (м)². Довідкові діапазони: &lt;18,5; 18,5–&lt;25; 25–&lt;30; 30–&lt;35; 35–&lt;40; ≥40. Категорія визначається до округлення.</p><a href={CALCULATOR_SOURCES.bmi} target="_blank" rel="noreferrer">ВООЗ · індекс маси тіла <ExternalLink /></a></> : <>
              <p>ММЛШ = 0,8 × 1,04 × [(МШПд + КДР + ЗСЛШд)³ − КДР³] + 0,6 г. У формулі розміри в сантиметрах; введені мм автоматично діляться на 10.</p>
              <p>Лінійний метод ASE використовує кінцево-діастолічні виміри. Лінійні розміри з 2D-зображення не означають 2D-об’ємний метод. Коректність вимірів і придатність геометричних припущень оцінює лікар.</p>
              {mode === 'index' ? <><p>ППТ (Mosteller) = √[зріст (см) × вага (кг) / 3600]. ІММЛШ = ММЛШ (г) / ППТ (м²). Mosteller — обраний спосіб індексації. Розрахунки й порівняння виконуються без проміжного округлення.</p><p>ASE/EACVI 2015, таблиці 5–6: лінійний ІММЛШ — жінки 43–95, чоловіки 49–115 г/м²; 2D-об’ємний — 44–88 та 50–102 г/м². Значення рівно на верхній межі не перевищує її. Для невідомого методу або невказаної статі оцінка не надається.</p><p>Індексація на ППТ при ожирінні може недооцінювати збільшення маси ЛШ; нормальне індексоване значення не виключає патології.</p><a href={CALCULATOR_SOURCES.bsa} target="_blank" rel="noreferrer">Mosteller · eviQ <ExternalLink /></a><a href={CALCULATOR_SOURCES.obesity} target="_blank" rel="noreferrer">ASE · застереження щодо індексації <ExternalLink /></a></> : null}
              <a href={CALCULATOR_SOURCES.ase} target="_blank" rel="noreferrer">ASE/EACVI · формула та референтні межі <ExternalLink /></a>
            </>}
          </details>
          <Button className="calculator-reset" variant="ghost" disabled={!hasData} onClick={clear}><RotateCcw />Очистити розрахунок</Button>
        </div>
      </VlkDialogContent>
    </Dialog>
  </>;
}

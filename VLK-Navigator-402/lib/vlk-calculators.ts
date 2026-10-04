/** Adult calculation aids only. No diagnosis, fitness decision, persistence or clinical limits. */
export type CalculatorMode = 'bmi' | 'mass' | 'index';
export type MassSource = 'dimensions' | 'report';
export type MassMethod = 'linear' | '2d' | 'unknown';
export type ReferenceSex = 'female' | 'male' | 'unknown';
export type PositiveDecimal = { kind: 'missing' } | { kind: 'invalid' } | { kind: 'value'; value: number };

export function parsePositiveDecimal(raw: string): PositiveDecimal {
  const text = raw.trim();
  if (!text) return { kind: 'missing' };
  if (!/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/u.test(text)) return { kind: 'invalid' };
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? { kind: 'value', value } : { kind: 'invalid' };
}
const positive = (...values: number[]) => values.every(value => Number.isFinite(value) && value > 0);
const finiteResult = (value: number): number | undefined => positive(value) ? value : undefined;
export function calculateBmi(heightCm: number, weightKg: number) {
  return positive(heightCm, weightKg) ? finiteResult(weightKg * 10000 / heightCm ** 2) : undefined;
}
export function calculateBsa(heightCm: number, weightKg: number) {
  return positive(heightCm, weightKg) ? finiteResult(Math.sqrt(heightCm * weightKg / 3600)) : undefined;
}
/** ASE corrected cube formula. End-diastolic linear measurements arrive in mm, convert to cm once. */
export function calculateLvMass(ivsdMm: number, lviddMm: number, pwtdMm: number) {
  if (!positive(ivsdMm, lviddMm, pwtdMm)) return undefined;
  const ivs = ivsdMm / 10, lvid = lviddMm / 10, pwt = pwtdMm / 10;
  return finiteResult(0.8 * 1.04 * ((ivs + lvid + pwt) ** 3 - lvid ** 3) + 0.6);
}
export function calculateLvMassIndex(massG: number, bsaM2: number) {
  return positive(massG, bsaM2) ? finiteResult(massG / bsaM2) : undefined;
}
export function bmiCategory(bmi: number): string | undefined {
  if (!positive(bmi)) return undefined;
  if (bmi < 18.5) return 'Недостатня маса тіла';
  if (bmi < 25) return 'Референтний діапазон маси тіла';
  if (bmi < 30) return 'Надлишкова маса тіла';
  if (bmi < 35) return 'Діапазон ожиріння I ступеня';
  if (bmi < 40) return 'Діапазон ожиріння II ступеня';
  return 'Діапазон ожиріння III ступеня';
}
const INDEX_REFERENCES = {
  linear: { female: [43, 95], male: [49, 115] },
  '2d': { female: [44, 88], male: [50, 102] },
} as const;
export function massIndexReference(index: number, sex: ReferenceSex, method: MassMethod) {
  if (!positive(index) || sex === 'unknown' || method === 'unknown') return undefined;
  const [lower, upper] = INDEX_REFERENCES[method][sex];
  return { lower, upper, status: index > upper ? 'above' as const : index < lower ? 'below' as const : 'within' as const };
}
export type CalculatorFields = { height: string; weight: string; ivs: string; lvid: string; pwt: string; mass: string };
export const emptyCalculatorFields = (): CalculatorFields => ({ height: '', weight: '', ivs: '', lvid: '', pwt: '', mass: '' });
export const CALCULATOR_FIELDS: Record<keyof CalculatorFields, { label: string; short: string; unit: string; hint: string }> = {
  height: { label: 'Зріст', short: 'зріст', unit: 'см', hint: '175' },
  weight: { label: 'Вага', short: 'вагу', unit: 'кг', hint: '70' },
  ivs: { label: 'МШПд · IVSd', short: 'МШПд', unit: 'мм', hint: '10' },
  lvid: { label: 'КДР ЛШ · LVIDd', short: 'КДР ЛШ', unit: 'мм', hint: '50' },
  pwt: { label: 'ЗСЛШд · PWTd', short: 'ЗСЛШд', unit: 'мм', hint: '10' },
  mass: { label: 'ММЛШ із протоколу', short: 'масу міокарда', unit: 'г', hint: '182' },
};
export function requiredCalculatorFields(mode: CalculatorMode, source: MassSource): (keyof CalculatorFields)[] {
  return [...(mode !== 'mass' ? ['height', 'weight'] as const : []),
    ...(mode !== 'bmi' ? source === 'dimensions' ? ['ivs', 'lvid', 'pwt'] as const : ['mass'] as const : [])];
}
export function evaluateCalculator(mode: CalculatorMode, source: MassSource, fields: CalculatorFields) {
  const keys = requiredCalculatorFields(mode, source);
  const parsed = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, parsePositiveDecimal(value)])) as Record<keyof CalculatorFields, PositiveDecimal>;
  const invalid = keys.filter(key => parsed[key].kind === 'invalid');
  const missing = keys.filter(key => parsed[key].kind === 'missing');
  if (invalid.length || missing.length) return { kind: 'incomplete' as const, invalid, missing };
  const value = (key: keyof CalculatorFields) => { const field = parsed[key]; return field.kind === 'value' ? field.value : NaN; };
  const bmi = mode !== 'mass' ? calculateBmi(value('height'), value('weight')) : undefined;
  const bsa = mode === 'index' ? calculateBsa(value('height'), value('weight')) : undefined;
  const mass = mode !== 'bmi' ? source === 'dimensions' ? calculateLvMass(value('ivs'), value('lvid'), value('pwt')) : value('mass') : undefined;
  const result = mode === 'bmi' ? bmi : mode === 'mass' ? mass : calculateLvMassIndex(mass ?? NaN, bsa ?? NaN);
  if (result === undefined || (mode === 'index' && (bmi === undefined || bsa === undefined))) return { kind: 'range-error' as const };
  return { kind: 'result' as const, value: result, bmi, bsa, mass };
}
export const CALCULATOR_SOURCES = {
  ase: 'https://asecho.org/wp-content/uploads/2016/02/2015_ChamberQuantificationREV.pdf',
  bsa: 'https://www.eviq.org.au/clinical-resources/eviq-calculators/3198-body-surface-area-calculator',
  bmi: 'https://www.who.int/data/gho/data/themes/topics/topic-details/GHO/body-mass-index',
  obesity: 'https://www.asecho.org/wp-content/uploads/2015/07/2015_Hypertension.pdf',
} as const;

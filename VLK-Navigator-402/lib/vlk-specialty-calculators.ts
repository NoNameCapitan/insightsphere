/** Informational arithmetic only. No diagnosis, article-point selection or fitness decision. */
export type ClinicalNumberKind = 'positive' | 'nonnegative' | 'signed';
export type ClinicalNumber = { kind: 'missing' } | { kind: 'invalid' } | { kind: 'value'; value: number };
export function parseClinicalNumber(raw: string, kind: ClinicalNumberKind = 'positive'): ClinicalNumber {
  const text = raw.trim().replace(/^−/u, '-');
  if (!text) return { kind: 'missing' };
  if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/u.test(text)) return { kind: 'invalid' };
  const value = Number(text.replace(',', '.'));
  if (!Number.isFinite(value) || (kind === 'positive' && value <= 0) || (kind === 'nonnegative' && value < 0)) return { kind: 'invalid' };
  return { kind: 'value', value: value === 0 ? 0 : value };
}
const finite = (...values: number[]) => values.every(Number.isFinite);
const positive = (...values: number[]) => finite(...values) && values.every(value => value > 0);
const positiveResult = (value: number) => Number.isFinite(value) && value > 0 ? value : undefined;
export function calculatePta4(thresholds: readonly number[]): number | undefined {
  if (thresholds.length !== 4 || !finite(...thresholds)) return undefined;
  const result = thresholds.reduce((sum, value) => sum + value / 4, 0);
  return Number.isFinite(result) ? result : undefined;
}
export type CreatinineUnit = 'umol' | 'mgdl';
export type EquationSex = 'female' | 'male' | 'unknown';
export function calculateEgfr2021(age: number, creatinine: number, unit: CreatinineUnit, sex: EquationSex) {
  if (!positive(age, creatinine) || age < 18 || sex === 'unknown') return undefined;
  const scr = unit === 'umol' ? creatinine / 88.4 : creatinine;
  if (!positive(scr)) return undefined;
  const k = sex === 'female' ? 0.7 : 0.9, alpha = sex === 'female' ? -0.241 : -0.302;
  return positiveResult(142 * Math.min(scr / k, 1) ** alpha * Math.max(scr / k, 1) ** -1.2 * 0.9938 ** age * (sex === 'female' ? 1.012 : 1));
}
export function calculateFib4(age: number, ast: number, alt: number, platelets: number) {
  if (!positive(age, alt, platelets) || age < 18 || !finite(ast) || ast < 0) return undefined;
  if (ast === 0) return 0;
  return positiveResult(age * ast / (platelets * Math.sqrt(alt)));
}
export function calculateApri(ast: number, astUpperLimit: number, platelets: number) {
  if (!positive(astUpperLimit, platelets) || !finite(ast) || ast < 0) return undefined;
  if (ast === 0) return 0;
  return positiveResult(100 * (ast / astUpperLimit) / platelets);
}
export function calculatePrincipalMeridians(sphere: number, cylinder: number) {
  if (!finite(sphere, cylinder)) return undefined;
  const first = sphere, second = sphere + cylinder, difference = Math.abs(cylinder);
  if (!finite(first, second, difference)) return undefined;
  return { first, second, difference };
}
export function calculateSpirometryRatio(fev1: number, fvc: number) {
  if (!positive(fev1, fvc)) return undefined;
  return positiveResult(fev1 / fvc * 100);
}
export function calculatePercentPredicted(measured: number, predicted: number) {
  if (!positive(measured, predicted)) return undefined;
  return positiveResult(measured / predicted * 100);
}
export const CLINICAL_SOURCES = {
  egfr: 'https://www.niddk.nih.gov/research-funding/research-programs/kidney-clinical-research-epidemiology/laboratory/glomerular-filtration-rate-equations/adults',
  egfrLimits: 'https://www.niddk.nih.gov/health-information/professionals/advanced-search/quick-reference-uacr-gfr',
  fib4: 'https://www.hepatitisc.uw.edu/page/clinical-calculators/fib-4',
  apri: 'https://www.hepatitisc.uw.edu/page/clinical-calculators/apri',
  hearing: 'https://www.asha.org/policy/gl2005-00014/',
} as const;
export function calculateBronchodilatorChange(pre: number, post: number) {
  if (!positive(pre, post)) return undefined;
  const millilitres = (post - pre) * 1000, percentBaseline = (post - pre) / pre * 100;
  return finite(millilitres, percentBaseline) ? { millilitres, percentBaseline } : undefined;
}
export function compareLimbLengths(left: number, right: number) {
  if (!positive(left, right)) return undefined;
  return { difference: Math.abs(left - right), shorter: left < right ? 'left' as const : right < left ? 'right' as const : 'equal' as const };
}

/** Temporary evidence collection for a clinician. No diagnosis, fitness decision or persistence. */
import { ARTICLE_RULES } from './vlk-rules.ts';
import { getPointTdv } from './vlk-point-tdv.ts';
import { TDV_COLUMNS } from './vlk-tdv.ts';
import { TDV_GENERAL_ROWS } from './vlk-tdv-general.ts';
import { TDV_URL } from './vlk-links.ts';

export type CasePoint = { article: string; point: string };
export type CaseDraft = {
  points: CasePoint[];
  height: string;
  weight: string;
  vehicleRole: 'unknown' | 'driver' | 'crew';
  harmfulFactor: 'unknown' | 'krp' | 'other';
};
export const emptyCaseDraft = (): CaseDraft => ({ points: [], height: '', weight: '', vehicleRole: 'unknown', harmfulFactor: 'unknown' });
export const casePointKey = (point: CasePoint) => `${point.article}-${point.point}`;
export const casePointLabel = (point: CasePoint) => `Ст. ${point.article}${point.point === '—' ? ' · без поділу' : ` · п. «${point.point}»`}`;
export const validCasePoint = ({ article, point }: CasePoint) => Object.hasOwn(ARTICLE_RULES, article) && ARTICLE_RULES[article].some(rule => rule.point === point);

export function addCasePoints(current: readonly CasePoint[], incoming: readonly CasePoint[]): CasePoint[] {
  const unique = new Map<string, CasePoint>();
  for (const point of [...current, ...incoming]) if (validCasePoint(point)) unique.set(casePointKey(point), { ...point });
  return [...unique.values()];
}

/** Strict whole-input parser: invalid tokens never silently disappear or become another point. */
export function parseCasePoints(raw: string): { points: CasePoint[]; errors: string[] } {
  if (!raw.trim()) return { points: [], errors: ['Введіть номер статті та пункт, наприклад 39б.'] };
  if (raw.length > 600) return { points: [], errors: ['Додайте коротший перелік статей і пунктів.'] };
  const text = raw.trim().toLocaleLowerCase('uk').replace(/(\d)\s+([абвг])/gu, '$1$2');
  const tokens = text.match(/\d+[абвг]?|[^\s,;]+/gu) ?? [];
  if (!tokens.length) return { points: [], errors: ['Введіть номер статті та пункт, наприклад 39б.'] };
  const points: CasePoint[] = [], errors: string[] = [];
  for (const token of tokens) {
    const match = /^([1-9]\d?)([абвг])?$/u.exec(token);
    if (!match) { errors.push(`«${token}»: використайте формат 39б з українською літерою пункту.`); continue; }
    const [, article, letter] = match;
    const rules = ARTICLE_RULES[article];
    if (!rules) { errors.push(`Статті ${article} немає в корпусі.`); continue; }
    const point = letter ?? (rules.length === 1 && rules[0].point === '—' ? '—' : '');
    if (!point || !validCasePoint({ article, point })) {
      errors.push(`Ст. ${article}: ${rules[0]?.point === '—' ? 'стаття без поділу на пункти; введіть лише номер.' : `оберіть наявний пункт (${rules.map(rule => rule.point).join(', ')}).`}`); continue;
    }
    points.push({ article, point });
  }
  return { points: errors.length ? [] : addCasePoints([], points), errors };
}

export type CaseMeasurement = { kind: 'missing' } | { kind: 'invalid'; message: string } | { kind: 'value'; value: number };
export function parseCaseMeasurement(raw: string): CaseMeasurement {
  const text = raw.trim();
  if (!text) return { kind: 'missing' };
  const value = Number(text.replace(',', '.'));
  if (text.length > 16 || !/^\d+(?:[.,]\d{1,2})?$/u.test(text) || !Number.isFinite(value) || value <= 0)
    return { kind: 'invalid', message: 'Введіть додатне число, не більше двох знаків після коми.' };
  return { kind: 'value', value };
}

export type CaseFindingKind = 'restriction' | 'conditional' | 'not-applicable' | 'blank-cell' | 'no-row' |
  'outside-bound' | 'within-bound' | 'missing-measurement' | 'invalid-measurement' | 'no-bound' | 'invalid-point';
export type CaseFinding = {
  key: string; kind: CaseFindingKind; label: string; detail: string;
  sourceRow?: string; sourceScope?: 'point' | 'article' | 'general'; mark?: string; sourceUrl?: string;
};
export type CaseColumnStatus = 'restriction' | 'conditional' | 'insufficient' | 'no-detected-restriction';
export type CaseColumn = { column: number; label: string; status: CaseColumnStatus; findings: CaseFinding[]; gaps: number };
export const CASE_STATUS_LABELS: Record<CaseColumnStatus, string> = {
  restriction: 'Є обмеження за введеними даними',
  conditional: 'Є умова — уточніть контекст',
  insufficient: 'Недостатньо даних',
  'no-detected-restriction': 'За введеними даними обмежень не виявлено',
};

function pointFinding(point: CasePoint, column: number, draft: CaseDraft): CaseFinding {
  const base = { key: `point:${casePointKey(point)}`, label: casePointLabel(point) };
  if (!validCasePoint(point)) return { ...base, kind: 'invalid-point', detail: 'Стаття або пункт не підтверджені корпусом; цю позицію не оцінено.' };
  const row = getPointTdv(point.article, point.point);
  if (!row) return { ...base, kind: 'no-row', detail: 'Відповідного рядка ТДВ немає. Це не підтвердження придатності.', sourceUrl: TDV_URL };
  const mark = row.marks[column] ?? '';
  const evidence = { ...base, sourceRow: row.sourceRowKey, sourceScope: row.scope, sourceUrl: TDV_URL, mark };
  if (!mark.trim()) return { ...evidence, kind: 'blank-cell', detail: 'Клітинка цієї графи порожня. Дозвіл із порожньої клітинки не виводиться.' };
  if (mark === 'НП') return { ...evidence, kind: 'restriction', detail: 'У цій графі дослівно зазначено «НП». Позначка стосується цього призначення.' };
  if (mark === 'водії - НП' && column === 1) {
    if (draft.vehicleRole === 'driver') return { ...evidence, kind: 'restriction', detail: 'Позначка для водіїв застосовується до обраної ролі.' };
    if (draft.vehicleRole === 'crew') return { ...evidence, kind: 'not-applicable', detail: 'Вказана умова стосується водіїв. Для іншого члена екіпажу ця умова не застосована; придатність не підтверджена.' };
    return { ...evidence, kind: 'conditional', detail: 'Потрібно уточнити: механік-водій чи інший член екіпажу.' };
  }
  if (mark === 'КРП-НП' && column === 8) {
    if (draft.harmfulFactor === 'krp') return { ...evidence, kind: 'restriction', detail: 'Позначка для компонентів ракетного палива застосовується до обраного чинника.' };
    if (draft.harmfulFactor === 'other') return { ...evidence, kind: 'not-applicable', detail: 'Ця позначка стосується КРП. Для іншого чинника її не застосовано; інші вимоги не перевірені.' };
    return { ...evidence, kind: 'conditional', detail: 'Потрібно уточнити, чи є робота з компонентами ракетного палива (КРП).' };
  }
  return { ...evidence, kind: 'conditional', detail: 'Позначка потребує окремої звірки з офіційним джерелом; автоматично не застосована.' };
}

function measurementFindings(column: number, metric: 'height' | 'weight', raw: string): CaseFinding[] {
  const measurement = parseCaseMeasurement(raw);
  const label = metric === 'height' ? 'Зріст' : 'Вага', unit = metric === 'height' ? 'см' : 'кг';
  const rows = TDV_GENERAL_ROWS.filter(row => row.id.startsWith(`${metric}-`) && row.values[column]?.trim());
  if (!rows.length) return [{ key: `${metric}:none`, kind: 'no-bound', label, detail: 'У цих рядках графи додаткової числової межі не зазначено.', sourceUrl: TDV_URL, sourceScope: 'general' }];
  return rows.map(row => {
    const mark = row.values[column];
    const base = { key: row.id, label: `${label} · ${row.label}`, sourceRow: row.id, sourceScope: 'general' as const, sourceUrl: TDV_URL, mark };
    if (measurement.kind === 'missing') return { ...base, kind: 'missing-measurement' as const, detail: `Не перевірено: потрібен ${metric === 'height' ? 'зріст' : 'показник ваги'} (${unit}).` };
    if (measurement.kind === 'invalid') return { ...base, kind: 'invalid-measurement' as const, detail: `Не перевірено: помилка введення. ${measurement.message}` };
    const threshold = Number(mark.replace(',', '.'));
    if (!Number.isFinite(threshold)) return { ...base, kind: 'conditional' as const, detail: 'Числова умова потребує ручної перевірки.' };
    const outside = row.id.endsWith('-max') ? measurement.value > threshold : measurement.value < threshold;
    return { ...base, kind: outside ? 'outside-bound' as const : 'within-bound' as const,
      detail: `${measurement.value} ${unit}: ${outside ? 'поза межею цього показника ТДВ' : 'відповідає лише цій числовій межі'}. Норма: ${row.label} ${mark} ${unit}.` };
  });
}

const GAP_KINDS: CaseFindingKind[] = ['blank-cell', 'no-row', 'missing-measurement', 'invalid-measurement', 'invalid-point'];
/** Union retains every source. Priority orders the summary, never removes contradictory or missing evidence. */
export function evaluateCase(draft: CaseDraft): CaseColumn[] {
  const points = [...new Map(draft.points.map(point => [casePointKey(point), point])).values()];
  return TDV_COLUMNS.map(column => {
    const findings = [...points.map(point => pointFinding(point, column.id, draft)),
      ...measurementFindings(column.id, 'height', draft.height), ...measurementFindings(column.id, 'weight', draft.weight)];
    const gaps = findings.filter(finding => GAP_KINDS.includes(finding.kind)).length;
    const checked = findings.some(finding => ['within-bound', 'not-applicable'].includes(finding.kind));
    const status: CaseColumnStatus = findings.some(finding => ['restriction', 'outside-bound'].includes(finding.kind)) ? 'restriction'
      : findings.some(finding => finding.kind === 'conditional') ? 'conditional'
      : gaps || !checked ? 'insufficient' : 'no-detected-restriction';
    return { column: column.id, label: column.label, status, findings, gaps };
  });
}

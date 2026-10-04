/** Norm navigation by examination purpose. Never evaluates a person's health. */
import type { ArticleRule } from './vlk-rules.ts';
import type { ScheduleGraph } from './vlk-graphs.ts';
import { classifyOutcome } from './vlk-outcomes.ts';
import { CATEGORY_SOURCE, SCHEDULE_DIFFERENCES } from './vlk-category-data.ts';
import { getPointTdv } from './vlk-point-tdv.ts';
import { EXPLANATION as PREGNANCY } from './explanations/article-73.ts';
import { ORDER_BASE_URL, officialRuleUrl, TDV_URL } from './vlk-links.ts';

export type ReviewContext = { examineeType: string; scheduleGraph: ScheduleGraph; tdvColumn?: number };
export const CONTRACT_EXCLUDED_B = ['5', '14', '15', '16', '17', '18', '19'] as const;
export const CONTRACT = 'Кандидат на контракт';
export const EDUCATION = 'Кандидат до ВВНЗ';

export function scheduleOutcome(article: string, rule: ArticleRule, graph: ScheduleGraph): string {
  const cells = SCHEDULE_DIFFERENCES[`${article}-${rule.point}`];
  if (!cells) return rule.outcome;
  return graph === 'all' ? 'Результат залежить від графи — оберіть графу I, II або III' : cells[graph];
}

export function contextProblem(context: ReviewContext): string | null {
  if (context.examineeType === CONTRACT && context.scheduleGraph === 'I')
    return 'Для кандидатів на контракт п. 18.5 передбачає графи II або III. Оберіть графу за посадою у направленні.';
  if (context.examineeType === EDUCATION && context.tdvColumn !== undefined && ![9, 10].includes(context.tdvColumn))
    return 'Для вступу до ВВНЗ уточніть графу ТДВ 9 (без офіцерського звання) або 10 (з офіцерським званням).';
  return null;
}

// Explicit navigation links to existing official explanation paragraphs. No inferred diagnoses.
export const CONTRACT_GUIDANCE: Record<string, readonly number[]> = {
  '3': [1], '7': [2], '11': [0], '25': [18], '32': [0], '44': [1],
  '56': [1], '66': [0, 68], '72': [0], '73': [0], '81': [1, 2, 7], '82': [1, 2],
};
export function categoryGuidance(article: string, paragraphs: readonly string[], category: string) {
  if (category === CONTRACT) return (CONTRACT_GUIDANCE[article] ?? []).flatMap(i => paragraphs[i] ? [paragraphs[i]] : []);
  if (category === EDUCATION) return paragraphs.filter(p => /ВВНЗ|кандидат.*навчання/iu.test(p));
  if (category === 'Військовослужбовець') return paragraphs.filter(p => /військовослужбов/iu.test(p));
  return paragraphs.filter(p => /громадян|призовник|військовозобов/iu.test(p));
}

export type ContextResult = {
  /** Text used consistently by badges, filters, search and comparison. */
  outcome: string;
  label?: string;
  scope: string;
  basis: string;
  sourceUrl: string;
  quote?: string;
  note?: string;
  scheduleText: string;
  scheduleNeedsGraph: boolean;
};

export function resolveReviewContext(article: string, rule: ArticleRule, context: ReviewContext): ContextResult {
  const scheduleText = scheduleOutcome(article, rule, context.scheduleGraph);
  const scheduleNeedsGraph = context.scheduleGraph === 'all' && !!SCHEDULE_DIFFERENCES[`${article}-${rule.point}`];
  const base: ContextResult = { scheduleNeedsGraph, label: scheduleNeedsGraph ? 'Оберіть графу' : undefined, outcome: scheduleText, scope: 'Розклад хвороб · дослівно', basis: 'Додаток 1', sourceUrl: officialRuleUrl(article, rule), scheduleText };
  const problem = contextProblem(context);
  if (problem) return { ...base, outcome: 'Потрібно уточнити параметри огляду', label: 'Уточніть контекст', note: problem };
  if (context.examineeType === CONTRACT) {
    const excluded = rule.point === 'б' && (CONTRACT_EXCLUDED_B as readonly string[]).includes(article);
    const kind = classifyOutcome(scheduleText).kind;
    const blocked = excluded || kind === 'unfit' || kind === 'unfit-review' || /^тимчасово непридатн/iu.test(scheduleText);
    if (blocked) return { ...base, outcome: 'непридатний до військової служби за контрактом', label: 'Контракт · непридатний', scope: 'Норма для кандидата на контракт', basis: 'П. 18.5 глави 18 розділу II', sourceUrl: CATEGORY_SOURCE.n7418.url, quote: CATEGORY_SOURCE.n7418.text,
      note: excluded ? `Пункт «б» статті ${article} прямо зазначений у п. 18.5. Загальна придатність до військової служби визначається окремо (п. 18.7).` : 'Непридатність до контракту за цим пунктом не означає автоматичної непридатності до військової служби взагалі.' };
    if (article === '73') return { ...base, outcome: 'непридатний до військової служби за контрактом', label: 'Контракт · не приймаються', scope: 'Норма для кандидата на контракт', basis: 'Пояснення до статті 73, Додаток 2', quote: PREGNANCY.paragraphs[0], sourceUrl: `${ORDER_BASE_URL}#${PREGNANCY.anchor}`, note: 'Вагітні незалежно від терміну та перебігу вагітності на військову службу за контрактом не приймаються. Звірте повне пояснення до статті.' };
    if (CONTRACT_GUIDANCE[article]?.length || ['none', 'unknown', 'temporary'].includes(kind)) return { ...base, outcome: 'Потрібна звірка умов у поясненні', label: 'Контракт · уточнення', scope: 'Норма для кандидата на контракт', basis: 'П. 18.5 та Додаток 2', sourceUrl: CATEGORY_SOURCE.n7414.url,
      note: 'Категорії та номера пункту недостатньо для застосування всіх умов. Звірте клінічний стан, строки й результати лікування з офіційним поясненням. Порожня клітинка іншої графи не переноситься автоматично.' };
    const source = kind === 'limited' ? CATEGORY_SOURCE.n7417 : CATEGORY_SOURCE.n7416;
    return { ...base, outcome: source.text.split('«')[1].split('»')[0], label: kind === 'limited' ? 'Контракт · визначені види' : 'Контракт · норма придатності', scope: 'Норма для кандидата на контракт', basis: 'П. 18.5 глави 18 розділу II', sourceUrl: source.url, quote: source.text,
      note: 'Це формулювання норми для вибраного пункту. Врахуйте пояснення та призначення за ТДВ (п. 18.7); рішення приймає ВЛК.' };
  }
  if (context.examineeType === EDUCATION) {
    const mark = context.tdvColumn ? getPointTdv(article, rule.point)?.marks[context.tdvColumn] : undefined;
    if (mark === 'НП') return { ...base, outcome: 'Непридатність за вибраною графою ТДВ', label: 'Вступ · НП за ТДВ', scope: 'Додаткові вимоги до вступу', basis: `Додаток 3 · графа ${context.tdvColumn}`, sourceUrl: TDV_URL, note: `У рядку для цього пункту в графі ${context.tdvColumn} дослівно зазначено «НП». Загальний результат Розкладу наведено окремо.` };
    const kind = classifyOutcome(scheduleText).kind;
    if (kind === 'unfit' || kind === 'unfit-review' || /^тимчасово непридатн/iu.test(scheduleText)) return { ...base, outcome: scheduleText, label: 'Вступ · норма непридатності', scope: 'Умови вступу до ВВНЗ', basis: 'П. 4.2 глави 4 розділу II', sourceUrl: CATEGORY_SOURCE.n362.url, quote: CATEGORY_SOURCE.n362.text,
      note: 'Цей пункт не передбачає придатності до базової військової служби. Для вступу п. 4.2 вимагає такої придатності з урахуванням ТДВ. Строки та подальший огляд звірте з поясненням.' };
    if (article === '73') return { ...base, outcome: 'Непридатні при вступі на навчання до ВВНЗ', label: 'Вступ · непридатність', scope: 'Додаткові вимоги до вступу', basis: 'Пояснення до статті 73, Додаток 2', quote: PREGNANCY.paragraphs[0], sourceUrl: `${ORDER_BASE_URL}#${PREGNANCY.anchor}`, note: 'Окреме обмеження для вагітних наведено в поясненні до статті 73.' };
    return { ...base, outcome: 'Потрібна звірка умов вступу', label: 'Вступ · звірте вимоги', scope: 'Додаткові вимоги до вступу', basis: 'П. 4.2 глави 4 розділу II', sourceUrl: CATEGORY_SOURCE.n362.url, quote: CATEGORY_SOURCE.n362.text,
      note: 'Придатність до служби не тотожна придатності до навчання. Звірте графу ТДВ 9/10, загальні показники та пояснення. Відсутність позначки не підтверджує придатність.' };
  }
  return base;
}

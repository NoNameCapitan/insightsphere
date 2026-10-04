/** Exact per-point schedule/context outcomes, separate from the unchanged TDV engine. */
import { ARTICLE_RULES } from './vlk-rules.ts';
import { casePointKey, type CasePoint } from './vlk-case.ts';
import { classifyOutcome } from './vlk-outcomes.ts';
import { resolveReviewContext, type ReviewContext } from './vlk-review-context.ts';
import type { CaseCardView } from './vlk-case-presentation.ts';
export function caseScheduleOutcomes(points: readonly CasePoint[], context: ReviewContext) {
  return [...new Map(points.map(point => [casePointKey(point), point])).values()].map(point => {
    const rule = ARTICLE_RULES[point.article]?.find(candidate => candidate.point === point.point);
    const result = rule ? resolveReviewContext(point.article, rule, context) : undefined;
    const classification = classifyOutcome(result?.outcome);
    return { point, rule, result, classification };
  });
}
/** A TDV numerical/conditional check never becomes general clearance through a green colour. */
export function scopeCaseDestination(view: CaseCardView, schedule: ReturnType<typeof caseScheduleOutcomes>): CaseCardView {
  if (view.tone !== 'checked' || schedule.length > 0 && schedule.every(item => item.classification.kind === 'fit')) return view;
  return { ...view, tone: 'neutral', heading: 'Перевірено окремі критерії',
    summary: `${view.summary} Це лише перевірка введених критеріїв ТДВ. ${schedule.length ? 'Результат Розкладу показано окремо вище.' : 'Статті та пункти ще не додані.'}` };
}

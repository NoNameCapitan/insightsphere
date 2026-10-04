import type { ArticleRule } from "./vlk-rules.ts";
import { matchesOutcomeFilter, type OutcomeFilterId } from "./vlk-outcomes.ts";

/** Viewing aids only: both constraints must refer to the SAME literal point. */
export function matchesRuleFilters(
  rule: ArticleRule,
  point: string,
  outcome: OutcomeFilterId,
  contextOutcome = rule.outcome,
) {
  return (point === "all" || rule.point === point) &&
    matchesOutcomeFilter([contextOutcome], outcome);
}

export function availablePoints(rules: readonly ArticleRule[]) {
  return [...new Set(rules.map((rule) => rule.point))].sort((a, b) => a.localeCompare(b, "uk"));
}

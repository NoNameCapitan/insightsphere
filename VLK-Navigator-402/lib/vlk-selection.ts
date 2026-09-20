import { ARTICLE_RULES } from "./vlk-rules.ts";
import { parseSearchQuery } from "./vlk-search.ts";

/** Resolve only an explicitly requested, existing point; never infer severity. */
export function requestedPointIndex(article: string, query: string): number | undefined {
  const point = parseSearchQuery(query).find((term) => term.kind === "point")?.value;
  if (!point) return undefined;
  const index = (ARTICLE_RULES[article] ?? []).findIndex((rule) => rule.point === point);
  return index >= 0 ? index : undefined;
}

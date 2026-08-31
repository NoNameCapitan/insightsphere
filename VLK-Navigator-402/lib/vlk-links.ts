/**
 * Посилання на офіційне джерело.
 *
 * Кожне посилання веде на конкретну статтю чинної редакції Наказу №402, а для
 * вибраного пункту додається текстовий фрагмент, який підсвічує саме це
 * формулювання у першоджерелі.
 */

import { ARTICLE_ANCHORS } from "./vlk-anchors.ts";
import type { ArticleRule } from "./vlk-rules.ts";
import { SOURCE_URL } from "./vlk-sample-data.ts";

export const ORDER_BASE_URL = "https://zakon.rada.gov.ua/laws/show/z1109-08/ed20250822";
export const TDV_URL = `${ORDER_BASE_URL}#n2820`;
export const TDV_DOCX_URL = "https://zakon.rada.gov.ua/laws/file/text/122/f277457n7455.docx";

/** Текстовий фрагмент для підсвічування: обрізається лише по межі слова. */
export function textFragment(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  const shortened =
    compact.length > 150 ? compact.slice(0, compact.lastIndexOf(" ", 150)) : compact;
  return encodeURIComponent(shortened);
}

export function ruleHighlight(rule: Pick<ArticleRule, "point" | "condition">) {
  return `${rule.point === "—" ? "" : `${rule.point}) `}${rule.condition}`;
}

export function officialArticleUrl(article: string, highlight?: string) {
  const anchor = ARTICLE_ANCHORS[article];
  if (!anchor) return SOURCE_URL;
  const base = `${ORDER_BASE_URL}#${anchor}`;
  return highlight ? `${base}:~:text=${textFragment(highlight)}` : base;
}

export function officialRuleUrl(article: string, rule?: Pick<ArticleRule, "point" | "condition">) {
  return officialArticleUrl(article, rule ? ruleHighlight(rule) : `Стаття ${article}`);
}

export function explanationUrl(anchor: string | null | undefined, fallback: string) {
  return anchor ? `${ORDER_BASE_URL}#${anchor}` : fallback;
}

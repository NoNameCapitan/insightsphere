/**
 * Текстові вивантаження: формулювання пункту та статті для копіювання.
 *
 * Кожен запис містить статтю, точний МКХ, дослівний рядок Розкладу хвороб,
 * пункт, стан, дослівний результат, редакцію та посилання на першоджерело —
 * щоб скопійований текст можна було перевірити за Наказом №402.
 */

import { officialArticleUrl, ruleHighlight } from "./vlk-links.ts";
import type { ArticleRule } from "./vlk-rules.ts";
import { EDITION, type VlkArticle } from "./vlk-sample-data.ts";
import { articleIcdLabel } from "./vlk-search.ts";
import { graphContextLabel, type ScheduleGraph } from "./vlk-graphs.ts";

const DISCLAIMER =
  "Не є постановою ВЛК, не встановлює діагноз і потребує перевірки лікарем за відповідною графою Розкладу хвороб, офіційними поясненнями та ТДВ.";

function pointSuffix(point: string) {
  return point === "—" ? "" : `, пункт «${point}»`;
}

export function buildReferenceText(article: VlkArticle, rule: ArticleRule, graph: ScheduleGraph = "all", graphNotes: readonly string[] = []) {
  return [
    `Стаття ${article.article}${pointSuffix(rule.point)} — ${article.title}.`,
    `МКХ-10 за Розкладом хвороб: ${articleIcdLabel(article)}.`,
    `Дослівний рядок Розкладу хвороб: ${article.officialIncluded}`,
    `Стан за пунктом: ${rule.condition}.`,
    `Дослівний результат пункту: ${rule.outcome}.`,
    `Контекст графи: ${graphContextLabel(graph)}.${graph === "all" ? " Оберіть графу за направленням або обліковою категорією." : " Дослівний результат пункту не замінено автоматичним висновком."}`,
    ...(graphNotes.length ? [
      `Дослівні згадки для графи ${graph}:`,
      ...graphNotes.map((note) => `— ${note}`),
    ] : []),
    `Наказ МОУ №402, редакція від ${EDITION}. ${officialArticleUrl(article.article, ruleHighlight(rule))}`,
    DISCLAIMER,
  ].join("\n");
}

/** Компактне дослівне формулювання для робочого документа. */
export function buildPointWordingText(article: VlkArticle, rule: ArticleRule, graph: ScheduleGraph = "all") {
  return [
    `Стаття ${article.article}${pointSuffix(rule.point)} — ${article.title}.`,
    `Стан за пунктом: ${rule.condition}.`,
    `Дослівний результат пункту: ${rule.outcome}.`,
    `Контекст графи: ${graphContextLabel(graph)}.`,
    `Наказ МОУ №402, редакція від ${EDITION}. ${officialArticleUrl(article.article, ruleHighlight(rule))}`,
    DISCLAIMER,
  ].join("\n");
}

/**
 * Текстові вивантаження: формулювання для копіювання та чернетка зведення.
 *
 * Кожен запис містить статтю, точний МКХ, дослівний рядок Розкладу хвороб,
 * пункт, стан, дослівний результат, редакцію та посилання на першоджерело —
 * щоб скопійований текст можна було перевірити за Наказом №402.
 */

import { officialArticleUrl, ruleHighlight } from "./vlk-links.ts";
import type { ArticleRule } from "./vlk-rules.ts";
import { strictestOutcome } from "./vlk-outcomes.ts";
import { EDITION, SOURCE_URL, type VlkArticle } from "./vlk-sample-data.ts";
import type { BasketItem } from "./vlk-session.ts";
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

export function buildBasketEntry(item: BasketItem, index: number) {
  return [
    `${index + 1}. Стаття ${item.article}${pointSuffix(item.point)} — ${item.title}.`,
    `МКХ-10 за Розкладом хвороб: ${articleIcdLabel(item)}.`,
    `Дослівний рядок Розкладу хвороб: ${item.officialIncluded}`,
    `Стан за пунктом: ${item.condition}.`,
    `Дослівний результат пункту: ${item.outcome}.`,
    `Джерело: ${officialArticleUrl(item.article, ruleHighlight(item))}`,
  ].join("\n");
}

export function buildDraftText(basket: readonly BasketItem[], examineeType: string, graph: ScheduleGraph = "all") {
  const strictest = strictestOutcome(basket);
  return [
    "ЧЕРНЕТКА НАВІГАЦІЙНОГО ЗВЕДЕННЯ ВЛК",
    `Категорія оглядуваного: ${examineeType}`,
    `Контекст графи: ${graphContextLabel(graph)}`,
    `Наказ МОУ №402, редакція від ${EDITION}`,
    "",
    ...basket.map((item, index) => buildBasketEntry(item, index)),
    "",
    strictest
      ? `Попередній найсуворіший орієнтир: стаття ${strictest.article}${pointSuffix(strictest.point)} — ${strictest.outcome}.`
      : "Пункти до зведення не додані.",
    "",
    `Чернетка ${DISCLAIMER[0].toLocaleLowerCase("uk")}${DISCLAIMER.slice(1)}`,
    SOURCE_URL,
  ].join("\n");
}

export function buildCitizenSummaryText(
  basket: readonly BasketItem[],
  examineeType: string,
  preparationChecks: readonly string[],
  graph: ScheduleGraph = "all",
) {
  return [
    "ОСОБИСТИЙ СПИСОК НОРМ І ПІДГОТОВКИ ДО ВЛК",
    `Категорія оглядуваного: ${examineeType}`,
    `Контекст графи: ${graphContextLabel(graph)}`,
    `Наказ МОУ №402, редакція від ${EDITION}`,
    "",
    ...basket.map((item, index) => buildBasketEntry(item, index)),
    ...(basket.length ? [] : ["Збережених норм немає."]),
    "",
    "ВІДМІЧЕНО У ЧЕКЛІСТІ:",
    ...(preparationChecks.length
      ? preparationChecks.map((item) => `✓ ${item}`)
      : ["Жодного пункту ще не відмічено."]),
    "",
    "Цей список не встановлює діагноз і не визначає придатність. Остаточне рішення ухвалює ВЛК після огляду та перевірки документів.",
    SOURCE_URL,
  ].join("\n");
}

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

const DISCLAIMER =
  "Не є постановою ВЛК, не встановлює діагноз і потребує перевірки лікарем за відповідною графою Розкладу хвороб, офіційними поясненнями та ТДВ.";

function pointSuffix(point: string) {
  return point === "—" ? "" : `, пункт «${point}»`;
}

export function buildReferenceText(article: VlkArticle, rule: ArticleRule) {
  return [
    `Стаття ${article.article}${pointSuffix(rule.point)} — ${article.title}.`,
    `МКХ-10 за Розкладом хвороб: ${article.icd}.`,
    `Дослівний рядок Розкладу хвороб: ${article.officialIncluded}`,
    `Стан за пунктом: ${rule.condition}.`,
    `Дослівний результат пункту: ${rule.outcome}.`,
    `Наказ МОУ №402, редакція від ${EDITION}. ${officialArticleUrl(article.article, ruleHighlight(rule))}`,
    DISCLAIMER,
  ].join("\n");
}

export function buildBasketEntry(item: BasketItem, index: number) {
  return [
    `${index + 1}. Стаття ${item.article}${pointSuffix(item.point)} — ${item.title}.`,
    `МКХ-10 за Розкладом хвороб: ${item.icd}.`,
    `Дослівний рядок Розкладу хвороб: ${item.officialIncluded}`,
    `Стан за пунктом: ${item.condition}.`,
    `Дослівний результат пункту: ${item.outcome}.`,
    `Джерело: ${officialArticleUrl(item.article, ruleHighlight(item))}`,
  ].join("\n");
}

export function buildDraftText(basket: readonly BasketItem[], examineeType: string) {
  const strictest = strictestOutcome(basket);
  return [
    "ЧЕРНЕТКА НАВІГАЦІЙНОГО ЗВЕДЕННЯ ВЛК",
    `Категорія оглядуваного: ${examineeType}`,
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

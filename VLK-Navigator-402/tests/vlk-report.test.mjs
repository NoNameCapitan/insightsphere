import assert from "node:assert/strict";
import test from "node:test";

import { ARTICLE_ANCHORS } from "../lib/vlk-anchors.ts";
import { buildDraftText, buildReferenceText } from "../lib/vlk-report.ts";
import { ARTICLE_RULES } from "../lib/vlk-rules.ts";
import { ARTICLES, EDITION } from "../lib/vlk-sample-data.ts";
import { createBasketItem } from "../lib/vlk-session.ts";

const article = ARTICLES.find((entry) => entry.article === "39");
const rule = ARTICLE_RULES["39"].find((entry) => entry.point === "б");

test("copied wording carries the article, ICD, literal row, point, condition, outcome, edition and link", () => {
  const text = buildReferenceText(article, rule);

  assert.match(text, /Стаття 39, пункт «б»/);
  assert.ok(text.includes(article.icd), "немає точного МКХ");
  assert.ok(text.includes(article.officialIncluded), "немає дослівного рядка Розкладу");
  assert.ok(text.includes(rule.condition), "немає стану за пунктом");
  assert.ok(text.includes(rule.outcome), "немає дослівного результату");
  assert.ok(text.includes(EDITION), "немає редакції");
  assert.ok(text.includes(`#${ARTICLE_ANCHORS["39"]}`), "немає посилання на статтю");
  assert.match(text, /Не є постановою ВЛК/);
});

test("the draft repeats the same verified data for every point", () => {
  const basket = [
    createBasketItem(article, rule),
    createBasketItem(
      ARTICLES.find((entry) => entry.article === "2"),
      ARTICLE_RULES["2"][0],
    ),
  ];
  const draft = buildDraftText(basket, "Військовослужбовець");

  assert.match(draft, /^ЧЕРНЕТКА НАВІГАЦІЙНОГО ЗВЕДЕННЯ ВЛК/);
  assert.match(draft, /Категорія оглядуваного: Військовослужбовець/);
  assert.ok(draft.includes(`редакція від ${EDITION}`));
  for (const item of basket) {
    assert.ok(draft.includes(item.icd));
    assert.ok(draft.includes(item.officialIncluded));
    assert.ok(draft.includes(item.condition));
    assert.ok(draft.includes(item.outcome));
    assert.ok(draft.includes(`#${ARTICLE_ANCHORS[item.article]}`));
  }
  // Стаття 2 суворіша за пункт «б» статті 39.
  assert.match(draft, /Попередній найсуворіший орієнтир: стаття 2 — Непридатні/);
  assert.match(draft, /потребує перевірки лікарем/);
});

test("an empty draft says so instead of inventing a conclusion", () => {
  const draft = buildDraftText([], "Військовозобов’язаний");
  assert.match(draft, /Пункти до зведення не додані/);
  assert.doesNotMatch(draft, /найсуворіший орієнтир/);
});

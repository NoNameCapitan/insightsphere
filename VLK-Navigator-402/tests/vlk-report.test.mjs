import assert from "node:assert/strict";
import test from "node:test";

import { ARTICLE_ANCHORS } from "../lib/vlk-anchors.ts";
import {
  buildPointWordingText,
  buildReferenceText,
} from "../lib/vlk-report.ts";
import { ARTICLE_RULES } from "../lib/vlk-rules.ts";
import { ARTICLES, EDITION } from "../lib/vlk-sample-data.ts";

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

test("point wording is concise, literal and carries the selected graph", () => {
  const text = buildPointWordingText(article, rule, "II");

  assert.match(text, /Стаття 39, пункт «б»/);
  assert.ok(text.includes(rule.condition));
  assert.ok(text.includes(rule.outcome));
  assert.match(text, /Контекст графи: Графа II/);
  assert.ok(text.includes(`#${ARTICLE_ANCHORS["39"]}`));
  assert.doesNotMatch(text, new RegExp(article.officialIncluded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("reference copy includes only supplied literal graph notes", () => {
  const note = "За графою II застосовуються додаткові вимоги.";
  const text = buildReferenceText(article, rule, "II", [note]);
  assert.match(text, /Дослівні згадки для графи II/);
  assert.ok(text.includes(note));
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyOutcome,
  matchesOutcomeFilter,
  outcomeStyles,
  OUTCOME_FILTERS,
  strictestOutcome,
} from "../lib/vlk-outcomes.ts";
import { ARTICLE_RULES } from "../lib/vlk-rules.ts";
import { ARTICLES } from "../lib/vlk-sample-data.ts";

test("every literal outcome in the schedule is classified explicitly", () => {
  const outcomes = new Set();
  for (const rules of Object.values(ARTICLE_RULES)) {
    for (const rule of rules) outcomes.add(rule.outcome);
  }

  assert.ok(outcomes.size > 0);
  for (const outcome of outcomes) {
    const classified = classifyOutcome(outcome);
    assert.notEqual(classified.kind, "unknown", `Нерозпізнаний результат: ${outcome}`);
  }
});

test("the interface never shows a stronger or weaker conclusion than the literal wording", () => {
  for (const [article, rules] of Object.entries(ARTICLE_RULES)) {
    for (const rule of rules) {
      const classified = classifyOutcome(rule.outcome);
      const literal = rule.outcome;

      if (/^Непридатні/u.test(literal)) {
        assert.equal(classified.tone, "critical", `Стаття ${article}, пункт ${rule.point}`);
        assert.ok(classified.severity >= 4, `Стаття ${article}, пункт ${rule.point}`);
      }
      if (classified.kind === "fit") {
        assert.match(literal, /^Придатні$/u, `Стаття ${article}, пункт ${rule.point}`);
      }
      if (/^-$/u.test(literal.trim())) {
        assert.equal(classified.kind, "none", `Стаття ${article}, пункт ${rule.point}`);
        assert.equal(classified.tone, "neutral");
        assert.ok(classified.requiresLiteralReading);
      }
    }
  }
});

test("known literal outcomes map to the expected category", () => {
  assert.equal(classifyOutcome("Непридатні до військової служби").kind, "unfit");
  assert.equal(
    classifyOutcome("Непридатні до військової служби з переоглядом через 6 місяців").kind,
    "unfit-review",
  );
  assert.equal(classifyOutcome("Тимчасово непридатні. Потребують лікування").kind, "temporary");
  assert.equal(
    classifyOutcome("Потребують лікування, відпустки, звільнення від виконання службових обов’язків").kind,
    "temporary",
  );
  assert.equal(
    classifyOutcome(
      "Придатні до служби у військових частинах забезпечення, ТЦК та СП, ВВНЗ, навчальних центрах",
    ).kind,
    "limited",
  );
  assert.equal(classifyOutcome("Придатні").kind, "fit");
  assert.equal(classifyOutcome("-").kind, "none");
  assert.equal(classifyOutcome("").kind, "none");
});

test("an unrecognised wording is never presented as fitness", () => {
  const classified = classifyOutcome("Формулювання, якого немає в базі");
  assert.equal(classified.kind, "unknown");
  assert.equal(classified.tone, "neutral");
  assert.ok(classified.requiresLiteralReading);
  assert.notEqual(outcomeStyles("Формулювання, якого немає в базі").badge, outcomeStyles("Придатні").badge);
});

test("severity ordering follows the literal wording", () => {
  const order = [
    "Придатні",
    "Придатні до служби у військових частинах забезпечення, ТЦК та СП",
    "Тимчасово непридатні",
    "Непридатні до військової служби з переоглядом через 6 місяців",
    "Непридатні до військової служби",
  ].map((outcome) => classifyOutcome(outcome).severity);

  for (let index = 1; index < order.length; index += 1) {
    assert.ok(order[index] > order[index - 1], `Порушено порядок суворості на позиції ${index}`);
  }
});

test("the summary picks the strictest literal orientation", () => {
  const basket = [
    { article: "39", outcome: "Придатні" },
    { article: "2", outcome: "Непридатні до військової служби з переоглядом через 6 місяців" },
    { article: "17", outcome: "Тимчасово непридатні" },
  ];
  assert.equal(strictestOutcome(basket).article, "2");

  const onlyNeutral = [
    { article: "73", outcome: "-" },
    { article: "73", outcome: "-" },
  ];
  assert.equal(strictestOutcome(onlyNeutral).article, "73");
  assert.equal(strictestOutcome([]), undefined);
});

test("the outcome filter selects articles that contain such a literal point", () => {
  const outcomesOf = (article) => (ARTICLE_RULES[article] ?? []).map((rule) => rule.outcome);

  assert.ok(matchesOutcomeFilter(outcomesOf("39"), "all"));
  // Стаття 73 має лише пункти з результатом «-».
  assert.ok(matchesOutcomeFilter(outcomesOf("73"), "literal"));
  assert.ok(!matchesOutcomeFilter(outcomesOf("73"), "fit"));
  assert.ok(!matchesOutcomeFilter(outcomesOf("73"), "unfit"));
  // Стаття 2 — «Непридатні… з переоглядом», теж категорія «Непридатний».
  assert.ok(matchesOutcomeFilter(outcomesOf("2"), "unfit"));
  assert.ok(matchesOutcomeFilter(outcomesOf("61"), "unfit"));
  assert.ok(matchesOutcomeFilter(outcomesOf("61"), "fit"));

  const filtered = ARTICLES.filter((article) =>
    matchesOutcomeFilter(outcomesOf(article.article), "unfit"),
  );
  assert.ok(filtered.length > 0 && filtered.length < ARTICLES.length);
  for (const filter of OUTCOME_FILTERS) {
    assert.equal(typeof filter.label, "string");
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { searchArticles, searchAbbreviationHints, highlightParts } from "../lib/vlk-search.ts";
import { ARTICLE_RULES } from "../lib/vlk-rules.ts";
import { matchesRuleFilters } from "../lib/vlk-view-filters.ts";
import { addSearchHistory, readSearchHistory, SEARCH_HISTORY_LIMIT } from "../lib/vlk-search-history.ts";

const numbers = (query) => searchArticles(query).map((hit) => hit.article.article);

test("clinical abbreviations are whole tokens and retain hard code/point constraints", () => {
  assert.deepEqual(numbers("БА"), ["47"]);
  assert.deepEqual(numbers("БА."), ["47"]);
  assert.doesNotThrow(() => numbers("constructor"));
  assert.deepEqual(numbers("ба пункт б"), ["47"]);
  assert.deepEqual(numbers("ЦД"), ["13"]);
  assert.deepEqual(numbers("АГ"), ["39"]);
  assert.deepEqual(numbers("ПТСР"), ["17"]);
  assert.deepEqual(numbers("БА I10"), []);
  assert.deepEqual(numbers("БА стаття 49"), []);
  assert.deepEqual(numbers("БА пункт г"), []);
  assert.deepEqual(searchAbbreviationHints("багаж"), []);
  assert.deepEqual(searchAbbreviationHints("БА"), ["БА — бронхіальна астма"]);
  assert.ok(!highlightParts("Бронхіальна астма", "БА").some((part) => part.match), "Do not fabricate a literal highlight");
});

test("clinical wording finds an article without inferring its point", () => {
  for (const query of ["бронхіальна астма середньої тяжкості", "легка персистуюча астма", "бронхіальн астм"]) {
    assert.equal(numbers(query)[0], "47");
  }
  assert.deepEqual(numbers("астма легеневий рак"), [], "Unmatched terms are never silently discarded");
  assert.deepEqual(numbers("H33.3"), ["26"], "Existing exclusion stays authoritative");
});

test("combined filters cannot borrow an outcome from a different point", () => {
  const rules = ARTICLE_RULES["47"];
  assert.ok(rules.some((rule) => matchesRuleFilters(rule, "в", "fit")));
  assert.ok(!rules.some((rule) => matchesRuleFilters(rule, "а", "fit")));
  assert.ok(!rules.some((rule) => matchesRuleFilters(rule, "г", "all")));
  assert.ok(ARTICLE_RULES["2"].some((rule) => matchesRuleFilters(rule, "—", "all")));
});

test("history reads old data, keeps fifteen unique recent searches and survives reload", () => {
  assert.equal(SEARCH_HISTORY_LIMIT, 15);
  let history = readSearchHistory('["астма","J45","47","гіпертонія","меніск","I10"]');
  assert.equal(history.length, 6);
  for (let i = 1; i <= 20; i++) history = addSearchHistory(history, `стаття ${i}`);
  history = addSearchHistory(history, "СТАТТЯ 10");
  assert.equal(history.length, 15);
  assert.equal(history[0], "СТАТТЯ 10");
  assert.deepEqual(readSearchHistory(JSON.stringify(history)), history);
  assert.ok(!history.includes("стаття 1"));
});

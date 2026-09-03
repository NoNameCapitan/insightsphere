import assert from "node:assert/strict";
import test from "node:test";

import {
  foldText,
  highlightParts,
  latinizeCode,
  normalizeIcdCode,
  normalizeSearchQuery,
  parseArticleNumber,
  parseIcdRange,
  parseSearchQuery,
  POPULAR_QUERIES,
  searchArticles,
  SEARCH_WEIGHTS,
} from "../lib/vlk-search.ts";
import { ARTICLES } from "../lib/vlk-sample-data.ts";

const top = (query, directory) => searchArticles(query, directory)[0]?.article.article;
const numbers = (query, directory) =>
  searchArticles(query, directory).map((hit) => hit.article.article);

test("the query cases from the specification resolve to article 47", () => {
  for (const query of [
    "астма",
    "бронхіальна астма",
    "J45",
    "J45-J46",
    "J45–J46",
    "J45—J46",
    "стаття 47",
    "ст. 47",
    "ст.47",
    "47",
    "  астма   ",
    "АСТМА",
    "J450",
  ]) {
    assert.equal(top(query), "47", `Запит «${query}»`);
  }
});

test("normalisation makes spacing, case and dashes irrelevant", () => {
  assert.equal(normalizeSearchQuery("  БРОНХІАЛЬНА   астма "), "бронхіальна астма");
  assert.equal(normalizeSearchQuery("J45–J46"), "j45-j46");
  assert.equal(normalizeSearchQuery("сечокам’яна"), "сечокамяна");
  assert.deepEqual(searchArticles("  АСТМА  ").map((hit) => hit.article.article), numbers("астма"));
  assert.equal(foldText("м’яких-тканин"), "мяких тканин");
});

test("ICD codes are understood with and without the dot, in both alphabets", () => {
  assert.equal(normalizeIcdCode("j45"), "J45");
  assert.equal(normalizeIcdCode("J45.0"), "J45.0");
  assert.equal(normalizeIcdCode("j450"), "J45.0");
  assert.equal(normalizeIcdCode("h333"), "H33.3");
  assert.equal(normalizeIcdCode("І10"), "I10", "кирилична І у коді");
  assert.equal(normalizeIcdCode("астма"), null);
  assert.equal(latinizeCode("Н53"), "H53");

  assert.equal(top("І10"), "39");
  assert.ok(numbers("H33.3").includes("27"));
  assert.ok(numbers("H333").includes("27"));
  assert.ok(numbers("S65").includes("78"), "S65 входить у діапазон S40-S99");
  assert.ok(numbers("U07.1").includes("1"));

  const range = parseIcdRange("J45–J46");
  assert.equal(range.letter, "J");
  assert.ok(range.from <= 45 && range.to >= 46);
});

test("article and point queries are parsed from service words", () => {
  assert.equal(parseArticleNumber("стаття 47"), "47");
  assert.equal(parseArticleNumber("ст. 47"), "47");
  assert.equal(parseArticleNumber("ст.47"), "47");
  assert.equal(parseArticleNumber("47"), "47");
  assert.equal(parseArticleNumber("астма"), null);

  assert.deepEqual(parseSearchQuery("стаття 47"), [{ kind: "article", value: "47" }]);
  assert.deepEqual(parseSearchQuery("пункт б"), [{ kind: "point", value: "б" }]);

  const points = searchArticles("пункт б");
  assert.ok(points.length > 0);
  assert.ok(points.every((hit) => hit.matches.includes("point")));

  const combined = searchArticles("гіпертонія пункт б")[0];
  assert.equal(combined.article.article, "39");
  assert.ok(combined.matches.includes("point"));
});

test("ranking follows the declared priority of match types", () => {
  assert.ok(SEARCH_WEIGHTS.article > SEARCH_WEIGHTS.icd);
  assert.ok(SEARCH_WEIGHTS.icd > SEARCH_WEIGHTS.title);
  assert.ok(SEARCH_WEIGHTS.title > SEARCH_WEIGHTS.titlePrefix);
  assert.ok(SEARCH_WEIGHTS.titlePrefix > SEARCH_WEIGHTS.titleWord);
  assert.ok(SEARCH_WEIGHTS.titleWord > SEARCH_WEIGHTS.synonym);
  assert.ok(SEARCH_WEIGHTS.synonym > SEARCH_WEIGHTS.summary);
  assert.ok(SEARCH_WEIGHTS.summary > SEARCH_WEIGHTS.official);
  assert.ok(SEARCH_WEIGHTS.official > SEARCH_WEIGHTS.fuzzy);

  assert.equal(searchArticles("47")[0].score, SEARCH_WEIGHTS.article);
  assert.equal(searchArticles("J45")[0].score, SEARCH_WEIGHTS.icd);
  assert.equal(searchArticles("астма")[0].matches[0], "title");
  assert.equal(searchArticles("гіпертонія")[0].matches[0], "synonym");

  const sorted = searchArticles("гіпертонія");
  for (let index = 1; index < sorted.length; index += 1) {
    assert.ok(sorted[index - 1].score >= sorted[index].score, "Результати мають спадати за вагою");
  }
});

test("every result explains why it was found", () => {
  for (const query of ["астма", "J45", "47", "гіпертонія", "меніск"]) {
    for (const hit of searchArticles(query)) {
      assert.ok(hit.matches.length, `Запит «${query}»: немає типу збігу`);
    }
  }
  assert.deepEqual(searchArticles("J45")[0].matches, ["icd"]);
  assert.deepEqual(searchArticles("47")[0].matches, ["article"]);
});

test("doctor surnames from the local directory are searchable", () => {
  const directory = { ophthalmologist: "Коваль, Шевченко", psychiatrist: "Іваненко" };
  const found = numbers("коваль", directory);
  assert.ok(found.length > 0);
  for (const article of found) {
    const entry = ARTICLES.find((item) => item.article === article);
    assert.ok(entry.specialties.includes("ophthalmologist"));
  }
  assert.equal(numbers("Іваненко", {}).length, 0, "Без довідника прізвище нічого не знаходить");
});

test("typos and word forms still return a useful result", () => {
  assert.equal(top("гіпертонії"), "39");
  assert.equal(top("гіпертнія"), "39");
  assert.equal(top("астама"), "47");
  assert.equal(searchArticles("астама")[0].matches[0], "fuzzy");
  assert.equal(top("сечокам’яна хвороба"), "67");
  assert.equal(top("сечокамяна хвороба"), "67");
});

test("an unknown query returns an empty result instead of a guess", () => {
  assert.deepEqual(searchArticles("зовсім вигаданий діагноз"), []);
  assert.deepEqual(searchArticles("   "), []);
  assert.deepEqual(searchArticles("стаття 88"), []);
  assert.ok(POPULAR_QUERIES.length >= 4, "Потрібні приклади для порожнього стану");
  for (const example of POPULAR_QUERIES) {
    assert.ok(searchArticles(example).length, `Приклад «${example}» має щось знаходити`);
  }
});

test("highlighting marks the matched fragment", () => {
  const parts = highlightParts("Хвороби з підвищеним артеріальним тиском", "артеріальним");
  assert.ok(parts.some((part) => part.match && part.text === "артеріальним"));
  assert.equal(parts.map((part) => part.text).join(""), "Хвороби з підвищеним артеріальним тиском");

  const apostrophe = highlightParts("хвороби м’яких тканин", "мяких");
  assert.ok(apostrophe.some((part) => part.match && part.text === "м’яких"));
});

test("highlighting follows word forms and Cyrillic ICD codes", () => {
  const marked = (text, query) =>
    highlightParts(text, query)
      .filter((part) => part.match)
      .map((part) => part.text);

  assert.deepEqual(
    marked("Включено: хвороби з підвищеним тиском I10-I15 (гіпертонічна хвороба)", "гіпертонія"),
    ["гіпертонічна"],
  );
  assert.deepEqual(marked("підвищеним тиском І10-І15", "I10"), ["І10-І15"]);
  assert.deepEqual(marked("менінгіт, ураження меніска коліна", "меніск"), ["меніска"]);
  assert.deepEqual(marked("Хвороби з підвищеним тиском", ""), []);
});

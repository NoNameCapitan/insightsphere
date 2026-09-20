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
  articleIcdScope,
  articleIcdLabel,
} from "../lib/vlk-search.ts";
import { ARTICLES } from "../lib/vlk-sample-data.ts";

const top = (query, directory) => searchArticles(query, directory)[0]?.article.article;
const numbers = (query, directory) =>
  searchArticles(query, directory).map((hit) => hit.article.article);

test("clinical query punctuation, service prefixes, compact points and spaced ranges are understood", () => {
  for (const query of ['стаття №47', '47б', 'ст.47б', 'МКХ-10: J45.0', 'ICD-10 J45.0',
    'J45 - J46', '"бронхіальна астма"', 'J45,0', 'астма пункт b']) {
    assert.equal(top(query), '47', query);
  }
  assert.deepEqual(parseSearchQuery('47б'), [{kind:'article',value:'47'},{kind:'point',value:'б'}]);
  assert.deepEqual(numbers('МКХ-10: D45'), ['9']);
  assert.deepEqual(numbers('МКХ-10: H33.3'), ['26']);
  assert.deepEqual(numbers('J46 - J45'), []);
});

test("adjacent typing errors are marked and ranked behind literal matches", () => {
  assert.equal(top('асмта'), '47');
  assert.ok(searchArticles('асмта')[0].matches.includes('fuzzy'));
  for (const query of ['астма', 'гіпертонія', 'меніск']) {
    const hits = searchArticles(query);
    const firstFuzzy = hits.findIndex((hit) => hit.matches.includes('fuzzy'));
    if (firstFuzzy >= 0) assert.ok(hits.slice(firstFuzzy).every((hit) => hit.matches.includes('fuzzy')));
  }
});

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
  // Article 27 explicitly excludes H33.3; article 26 explicitly includes it.
  assert.deepEqual(numbers("H33.3"), ["26"]);
  assert.deepEqual(numbers("H333"), ["26"]);
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

test('explicit exclusions never count as a positive ICD match', () => {
  const cases = [
    ['D45', '10', '9'], ['D46', '10', '9'], ['D47', '10', '9'],
    ['F32', '16', '17'], ['F33.1', '16', '17'],
    ['F98.0', '18', '86'], ['F98.5', '18', '85'], ['G45', '22', '41'],
    ['Н33.3', '27', '26'], ['K05', '49', '50'], ['K06', '49', '50'], ['K07', '49', '51'],
    ['K25', '52', '53'], ['K26', '52', '53'], ['М72', '61', '62'], ['M45', '64', '60'],
  ];
  for (const [query, excluded, included] of cases) {
    const result = numbers(query);
    assert.ok(!result.includes(excluded), `${query} must not match excluded article ${excluded}`);
    assert.ok(result.includes(included), `${query} must retain article ${included}`);
  }
  assert.ok(!numbers('поліцитемія').includes('10'), 'an excluded disease mention is not a positive text match');
});

test('query overlap is calculated after subtracting every exclusion, without dropping allowed neighbours', () => {
  assert.deepEqual(numbers('D45-D47'), ['9']);
  assert.ok(numbers('D44-D45').includes('10'));
  assert.ok(numbers('D48').includes('10'));
  assert.ok(numbers('H33').includes('27'), 'a parent code still has allowed subcodes');
  assert.ok(numbers('H33.2').includes('27'));
  assert.ok(numbers('H33.4').includes('27'));
  assert.ok(numbers('F98.1').includes('18'));
  assert.ok(numbers('F98.4').includes('18'));
  assert.ok(numbers('F98.6').includes('18'));
});

test('display separates included codes and exceptions while retaining the verbatim source', () => {
  const article = ARTICLES.find((entry) => entry.article === '10');
  const original = article.officialIncluded;
  const scope = articleIcdScope(article);
  assert.deepEqual(scope.includedCodes, ['D10-D49']);
  assert.deepEqual(scope.excludedCodes, ['D45','D46','D47']);
  assert.equal(articleIcdLabel(article), 'D10-D49 · виключено: D45; D46; D47');
  assert.equal(article.officialIncluded, original);
  assert.equal(articleIcdLabel(ARTICLES.find((entry) => entry.article === '85')), 'F98.5');
});

test('invalid ranges, exact decimal boundaries, and alternate corpora cannot reuse a false match', () => {
  for (const query of ['J46-J45','J45-K46','J45-']) {
    assert.equal(parseIcdRange(query), null, query);
    assert.deepEqual(numbers(query), [], query);
  }
  const a = { ...ARTICLES[0], id: 'same-id', icd: 'H33.30', officialIncluded: 'Включено: тест H33.30' };
  const b = { ...a, icd: 'J45', officialIncluded: 'Включено: тест J45' };
  assert.equal(searchArticles('H33.30', {}, [a]).length, 1);
  assert.equal(searchArticles('H33.31', {}, [a]).length, 0);
  assert.equal(searchArticles('H33.30', {}, [b]).length, 0);
  assert.equal(searchArticles('J45', {}, [b]).length, 1);
});

import assert from "node:assert/strict";
import test from "node:test";

import { foldText, highlightParts, latinizeCode, searchArticles } from "../lib/vlk-search.ts";
import { ARTICLES } from "../lib/vlk-sample-data.ts";

const top = (query, directory) => searchArticles(query, directory)[0]?.article.article;
const numbers = (query, directory) =>
  searchArticles(query, directory).map((hit) => hit.article.article);

test("key clinical queries resolve to the expected article", () => {
  assert.equal(top("гіпертонія"), "39");
  assert.equal(top("I10"), "39");
  assert.equal(top("зір"), "31");
  assert.equal(top("заїкання"), "85");
  assert.equal(top("міопія"), "30");
  assert.equal(top("астма"), "47");
  assert.ok(numbers("меніск").includes("61"), "Меніск має вести до статті 61 (М22-М25)");
});

test("ICD codes work in Cyrillic, Latin, lower case and as ranges", () => {
  assert.equal(top("І10"), "39", "Кирилична І у коді МКХ");
  assert.equal(top("i10"), "39");
  assert.equal(top("I10-I15"), "39");
  assert.equal(latinizeCode("І10"), "I10");
  assert.equal(latinizeCode("Н53"), "H53");

  const f98 = numbers("F98");
  for (const article of ["18", "85", "86"]) {
    assert.ok(f98.includes(article), `F98 має знаходити статтю ${article}`);
  }

  assert.ok(numbers("H33.3").includes("27"), "Уточнений код H33.3 має знаходити статтю 27");
  assert.ok(numbers("U07.1").includes("1"), "U07.1 має знаходити статтю 1");
  assert.ok(numbers("S65").includes("78"), "S65 входить до діапазону S40-S99 статті 78");
});

test("article numbers and the word стаття are understood", () => {
  assert.equal(top("39"), "39");
  assert.equal(top("стаття 39"), "39");
  assert.equal(top("ст 87"), "87");
  assert.ok(searchArticles("стаття 88").every((hit) => hit.article.article !== "88"));
});

test("doctor surnames from the local directory are searchable", () => {
  const directory = { ophthalmologist: "Коваль, Шевченко", psychiatrist: "Іваненко" };
  const found = numbers("коваль", directory);
  assert.ok(found.length > 0);
  for (const article of found) {
    const entry = ARTICLES.find((item) => item.article === article);
    assert.ok(entry.specialties.includes("ophthalmologist"), `Стаття ${article} не належить офтальмологу`);
  }

  const psychiatric = numbers("Іваненко", directory);
  assert.ok(psychiatric.includes("19"), "Прізвище психіатра має знаходити його статті");
  assert.equal(numbers("Іваненко", {}).length, 0, "Без довідника прізвище нічого не знаходить");
});

test("search explains why a result was found", () => {
  assert.deepEqual(searchArticles("I10")[0].reasons, ["icd"]);
  assert.deepEqual(searchArticles("гіпертонія")[0].reasons, ["diagnosis"]);
  assert.deepEqual(searchArticles("39")[0].reasons, ["article"]);
  assert.deepEqual(searchArticles("коваль", { ophthalmologist: "Коваль" })[0].reasons, ["doctor"]);

  const combined = searchArticles("гіпертонія пункт б")[0];
  assert.equal(combined.article.article, "39");
  assert.ok(combined.reasons.includes("point"));
});

test("apostrophes, hyphens and small typos are tolerated", () => {
  assert.equal(foldText("сечокам’яна"), "сечокамяна");
  assert.equal(top("сечокам’яна хвороба"), "67");
  assert.equal(top("сечокамяна хвороба"), "67");
  assert.equal(top("гіпертонії"), "39", "Інша відмінкова форма");
  assert.equal(top("гіпертнія"), "39", "Одна пропущена літера");
  assert.equal(top("псоріаз"), "57");
});

test("nothing is invented for a query the base does not contain", () => {
  assert.deepEqual(searchArticles("зовсім вигаданий діагноз"), []);
  assert.deepEqual(searchArticles("   "), []);
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

  // Запит «гіпертонія» має підсвітити «гіпертонічна» у дослівному тексті.
  assert.deepEqual(
    marked("Включено: хвороби з підвищеним тиском I10-I15 (гіпертонічна хвороба)", "гіпертонія"),
    ["гіпертонічна"],
  );
  // Офіційний текст пише коди кирилицею.
  assert.deepEqual(marked("підвищеним тиском І10-І15", "I10"), ["І10-І15"]);
  // Коротка основа не повинна чіпати чужі слова.
  assert.deepEqual(marked("менінгіт, ураження меніска коліна", "меніск"), ["меніска"]);
  assert.deepEqual(marked("Хвороби з підвищеним тиском", ""), []);
});

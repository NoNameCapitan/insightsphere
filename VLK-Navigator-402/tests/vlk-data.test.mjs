import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { ARTICLE_ANCHORS } from "../lib/vlk-anchors.ts";
import {
  EXPLANATION_DIGEST,
  EXPLANATION_EDITION,
  EXPLANATION_META,
  loadArticleExplanation,
} from "../lib/vlk-explanations.ts";
import { OFFICIAL_ARTICLE_EDITION, OFFICIAL_ARTICLE_TEXTS } from "../lib/vlk-official-articles.ts";
import { ARTICLE_RULES } from "../lib/vlk-rules.ts";
import { ARTICLES, SPECIALTIES } from "../lib/vlk-sample-data.ts";
import { TDV_RULES } from "../lib/vlk-tdv.ts";

test("every VLK article has metadata, rules, specialty and official anchor", () => {
  assert.equal(ARTICLES.length, 87);
  assert.equal(new Set(ARTICLES.map((article) => article.id)).size, ARTICLES.length);
  assert.equal(new Set(ARTICLES.map((article) => article.article)).size, ARTICLES.length);

  for (const article of ARTICLES) {
    assert.ok(article.title, `Стаття ${article.article}: немає назви`);
    assert.ok(article.icd, `Стаття ${article.article}: немає МКХ`);
    assert.ok(article.summary, `Стаття ${article.article}: немає опису`);
    assert.ok(article.officialIncluded, `Стаття ${article.article}: немає дослівного рядка Розкладу`);
    assert.ok(article.specialties.length, `Стаття ${article.article}: немає спеціальності`);
    assert.ok(ARTICLE_RULES[article.article]?.length, `Стаття ${article.article}: немає пунктів`);
    assert.match(ARTICLE_ANCHORS[article.article] ?? "", /^n\d+$/, `Стаття ${article.article}: некоректне посилання`);
  }
});

test("all 87 cards reproduce the official schedule row without shortening", () => {
  assert.equal(OFFICIAL_ARTICLE_EDITION, "22.08.2025");
  assert.equal(Object.keys(OFFICIAL_ARTICLE_TEXTS).length, 87);

  for (const article of ARTICLES) {
    const official = OFFICIAL_ARTICLE_TEXTS[article.article];
    assert.ok(official, `Стаття ${article.article}: офіційний запис відсутній`);
    assert.equal(article.icd, official.icd, `Стаття ${article.article}: МКХ не збігається`);
    assert.equal(article.officialIncluded, official.included, `Стаття ${article.article}: рядок скорочено або змінено`);
  }
});

test("29 previously generalized ICD ranges now use exact official code sets", () => {
  const expected = {
    1: "A00-A09; A20-A28; A30-A49; A68-A69; A70; A75-A79; A80-A89; A90-A99; B00-B09; B25-B34; B50-B89; Z22; U07.1-U07.2",
    2: "A15-A16; A17; A18; A19",
    3: "A50-A79",
    8: "C00-C14; C15-C26; C30-C39; C40-C49; C50-C68; C69-C72; C73-C80",
    9: "C81-C96; D45; D47; D46",
    12: "D50-D64; D63-D69; D70-D77; D80-D89",
    13: "E00-E07; E10-E16; E20-E35; E40-E90",
    17: "F40-F48; F32; F33",
    21: "G10-G37; G80-G89; G91-G92",
    26: "H15-H22; H25-H28; H30-H36; H33.3; H43-H45; H46-H48",
    35: "H81-H83.2",
    42: "I70-I79; I80-I89",
    46: "J40-J44; J47; J60-J84; J85-J99",
    50: "K05; K06",
    52: "K20-K31; K35-K38; K50-K52; K55-K67",
    54: "K70-K77; K80-K87",
    57: "L00-L08; L10-L14; L20-L30; L40-L45",
    58: "L50-L54; L60-L75; L80-L99",
    60: "M00-M15; M05-M15; M30-M36; M45",
    61: "M15-M19; M22-M25; M60-M79; M80-M94; M72",
    62: "S60-69; S90-99; T11; T13; T92; T93; M20-M21; M72",
    63: "S47; S48; S57; S58; S77; S78; S87; S88; T04; T05; T92.6; T93.6; Z89",
    74: "Q00-Q07; Q10-Q18; Q20-Q28; Q30-Q34; Q35-Q37; Q38-Q45; K90.0; Q50-Q56; Q60-Q64; Q65-Q79; Q80-Q89; Q90-Q99",
    76: "S22; S24; S25; S32",
    77: "S20; S21; S30; S37; T00-T07",
    79: "T20-T32; T33-T35; T66-T78",
    80: "T36-T50; T51-T65",
    84: "F45",
    85: "F98",
  };

  assert.equal(Object.keys(expected).length, 29);
  for (const [article, icd] of Object.entries(expected)) {
    assert.equal(OFFICIAL_ARTICLE_TEXTS[article].icd, icd, `Стаття ${article}`);
  }
});

test("every specialty exposes its complete article list", () => {
  const expected = {
    therapist: 39,
    surgeon: 40,
    neurologist: 21,
    psychiatrist: 12,
    ophthalmologist: 14,
    ent: 15,
    dentist: 10,
    dermatologist: 16,
  };

  const specialtyIds = new Set(SPECIALTIES.map((specialty) => specialty.id));
  const covered = new Set();

  for (const specialty of SPECIALTIES) {
    const count = ARTICLES.filter((article) => article.specialties.includes(specialty.id)).length;
    assert.equal(count, expected[specialty.id], specialty.label);
  }

  for (const article of ARTICLES) {
    for (const id of article.specialties) {
      assert.ok(specialtyIds.has(id), `Стаття ${article.article}: невідома спеціальність ${id}`);
      covered.add(article.article);
    }
  }

  assert.equal(covered.size, 87, "Кожна з 87 статей має бути доступною через спеціальність");
});

test("every article has an explicit official-explanation status", async () => {
  assert.equal(EXPLANATION_EDITION, "22.08.2025");
  assert.equal(Object.keys(EXPLANATION_META).length, 87);

  let paragraphCount = 0;
  for (const article of ARTICLES) {
    const meta = EXPLANATION_META[article.article];
    assert.ok(meta, `Стаття ${article.article}: статус пояснення відсутній`);

    const explanation = await loadArticleExplanation(article.article);

    if (article.article === "87") {
      assert.equal(meta.status, "absent");
      assert.equal(meta.anchor, null);
      assert.equal(meta.paragraphs, 0);
      assert.equal(explanation.status, "absent");
      assert.deepEqual(explanation.paragraphs, []);
      continue;
    }

    assert.equal(meta.status, "official", `Стаття ${article.article}: очікується офіційне пояснення`);
    assert.equal(meta.anchor, ARTICLE_ANCHORS[article.article]);
    assert.equal(explanation.article, article.article);
    assert.equal(explanation.anchor, ARTICLE_ANCHORS[article.article]);
    assert.ok(explanation.paragraphs.length, `Стаття ${article.article}: порожнє пояснення`);
    assert.equal(meta.paragraphs, explanation.paragraphs.length);
    assert.match(explanation.paragraphs[0], new RegExp(`Стаття ${article.article}(?:\\b|:)`));
    paragraphCount += explanation.paragraphs.length;
  }

  assert.ok(paragraphCount >= 2000, "Масив офіційних пояснень виглядає неповним");

  const article39 = await loadArticleExplanation("39");
  assert.ok(
    article39.paragraphs.some((paragraph) => paragraph.includes("органів-мішеней")),
    "Стаття 39: контрольний критерій не знайдено",
  );
  const article86 = await loadArticleExplanation("86");
  assert.ok(
    article86.paragraphs.every((paragraph) => !paragraph.startsWith("{Додаток 2")),
    "Службова примітка Додатка 2 не повинна входити до пояснення статті 86",
  );
});

test("split explanation modules reproduce the verified corpus byte for byte", async () => {
  const numbers = Object.keys(EXPLANATION_META).sort((a, b) => Number(a) - Number(b));
  assert.equal(numbers.length, 87);

  const parts = [];
  for (const number of numbers) {
    const explanation = await loadArticleExplanation(number);
    parts.push(
      JSON.stringify({
        article: explanation.article,
        status: explanation.status,
        anchor: explanation.anchor,
        paragraphs: explanation.paragraphs,
      }),
    );
  }

  const digest = createHash("sha256").update(parts.join("\n")).digest("hex");
  assert.equal(digest, EXPLANATION_DIGEST, "Дослівний текст пояснень змінився");
});

test("every TDV row references an existing article and point", () => {
  const articleNumbers = new Set(ARTICLES.map((article) => article.article));

  for (const key of Object.keys(TDV_RULES)) {
    const [articleNumber, point] = key.split("-");
    assert.ok(articleNumbers.has(articleNumber), `ТДВ ${key}: статтю не знайдено`);
    if (point) {
      assert.ok(
        ARTICLE_RULES[articleNumber].some((rule) => rule.point === point),
        `ТДВ ${key}: пункт не знайдено`,
      );
    }
  }
});

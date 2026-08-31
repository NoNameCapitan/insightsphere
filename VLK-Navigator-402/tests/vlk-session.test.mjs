import assert from "node:assert/strict";
import test from "node:test";

import { ARTICLE_RULES } from "../lib/vlk-rules.ts";
import { ARTICLES } from "../lib/vlk-sample-data.ts";
import {
  createBasketItem,
  EMPTY_DIRECTORY,
  restoreSession,
  serializeSession,
} from "../lib/vlk-session.ts";

const article39 = ARTICLES.find((article) => article.article === "39");
const rule39 = ARTICLE_RULES["39"][1];

test("a saved session round-trips", () => {
  const item = createBasketItem(article39, rule39);
  const raw = serializeSession({
    basket: [item],
    examineeType: "Військовослужбовець",
    mode: "detailed",
    directory: { ...EMPTY_DIRECTORY, therapist: "Іваненко" },
  });

  const restored = restoreSession(raw);
  assert.equal(restored.basket.length, 1);
  assert.deepEqual(restored.basket[0], item);
  assert.equal(restored.examineeType, "Військовослужбовець");
  assert.equal(restored.mode, "detailed");
  assert.equal(restored.directory.therapist, "Іваненко");
  assert.equal(restored.dropped, 0);
});

test("records from the previous structure are still readable", () => {
  const legacy = JSON.stringify({
    basket: [
      {
        id: "39-б",
        articleId: "article-39",
        article: "39",
        title: "Стара назва статті",
        icd: "I10",
        point: "б",
        condition: "старе формулювання",
        outcome: "Придатні",
        doctors: "Терапевт",
      },
    ],
    examineeType: "Кандидат на контракт",
    mode: "express",
    directory: { therapist: "Петренко" },
  });

  const restored = restoreSession(legacy);
  assert.equal(restored.basket.length, 1);
  const [item] = restored.basket;
  assert.equal(item.article, "39");
  assert.equal(item.point, "б");
  // Нормативний текст завжди береться з поточної бази, а не зі старого запису.
  assert.equal(item.title, article39.title);
  assert.equal(item.icd, article39.icd);
  assert.equal(item.condition, ARTICLE_RULES["39"].find((rule) => rule.point === "б").condition);
  assert.equal(item.outcome, ARTICLE_RULES["39"].find((rule) => rule.point === "б").outcome);
  assert.equal(item.officialIncluded, article39.officialIncluded);
  assert.equal(restored.examineeType, "Кандидат на контракт");
  assert.equal(restored.directory.therapist, "Петренко");
});

test("damaged or unknown records never break the application", () => {
  assert.deepEqual(restoreSession(null).basket, []);
  assert.deepEqual(restoreSession("{не json").basket, []);
  assert.deepEqual(restoreSession("[]").basket, []);
  assert.deepEqual(restoreSession(JSON.stringify({ basket: "щось" })).basket, []);

  const withGarbage = restoreSession(
    JSON.stringify({
      basket: [null, 42, { article: "999", point: "а" }, { article: "39", point: "я" }],
      mode: "невідомий режим",
      examineeType: "невідома категорія",
      directory: "не об’єкт",
    }),
  );
  assert.equal(withGarbage.basket.length, 0);
  assert.equal(withGarbage.dropped, 4);
  assert.equal(withGarbage.mode, "express");
  assert.equal(withGarbage.examineeType, "Військовозобов’язаний");
  assert.deepEqual(withGarbage.directory, EMPTY_DIRECTORY);
});

test("a stored point is restored from the article number alone", () => {
  const restored = restoreSession(JSON.stringify({ basket: [{ id: "2-—" }] }));
  assert.equal(restored.basket.length, 1);
  assert.equal(restored.basket[0].article, "2");
  assert.equal(restored.basket[0].outcome, ARTICLE_RULES["2"][0].outcome);
});

test("duplicated points are stored once", () => {
  const restored = restoreSession(
    JSON.stringify({
      basket: [
        { article: "39", point: "б" },
        { article: "39", point: "б" },
      ],
    }),
  );
  assert.equal(restored.basket.length, 1);
});

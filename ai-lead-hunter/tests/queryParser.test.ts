import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuery } from "../lib/queryParser";

test("parses '50 салонів краси поруч зі мною без сайту'", () => {
  const r = parseQuery("Знайди 50 салонів краси поруч зі мною без сайту");
  assert.equal(r.niche, "beauty");
  assert.equal(r.locationMode, "near_me");
  assert.equal(r.nearMe, true);
  assert.equal(r.limit, 50);
  assert.equal(r.limitFromQuery, true);
  assert.equal(r.filters.noWebsite, true);
});

test("parses 'стоматології на Позняках для онлайн-запису'", () => {
  const r = parseQuery("Знайди стоматології на Позняках для онлайн-запису");
  assert.equal(r.niche, "dental");
  assert.equal(r.offer, "booking");
  assert.equal(r.locationMode, "address");
  assert.ok(r.address && r.address.includes("Позняки"));
});

test("parses 'Я продаю сайти за $300. Кому поруч це може бути цікаво?'", () => {
  const r = parseQuery(
    "Я продаю сайти за $300. Кому поруч це може бути цікаво?",
  );
  // "сайти" -> website offer; "поруч" -> near-me geolocation.
  assert.equal(r.offer, "website");
  assert.equal(r.nearMe, true);
  assert.equal(r.locationMode, "near_me");
  assert.ok(r.limit <= 200);
});

test("defaults to whole Kyiv / 30 leads when nothing is specified", () => {
  const r = parseQuery("кафе");
  assert.equal(r.city, "Київ");
  assert.equal(r.radiusKm, 0);
  assert.equal(r.limit, 30);
  assert.equal(r.limitFromQuery, false);
});

test("recognises regional cities in declension and phone filter wording", () => {
  assert.equal(parseQuery("стоматології у Львові").city, "Львів");
  assert.equal(parseQuery("кафе в Запоріжжі").city, "Запоріжжя");
  assert.equal(parseQuery("сумнівні салони").city, "Київ");
  assert.equal(parseQuery("салони краси з телефоном").filters.hasPhone, true);
  assert.equal(parseQuery("вет клініки").niche, "vet");
  assert.equal(parseQuery("кафе радіус 3 км").radiusKm, 3);
});

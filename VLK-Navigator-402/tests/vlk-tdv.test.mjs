import assert from "node:assert/strict";
import test from "node:test";

import { TDV_COLUMNS, TDV_RULES } from "../lib/vlk-tdv.ts";
import { TDV_GENERAL_EDITION, TDV_GENERAL_ROWS } from "../lib/vlk-tdv-general.ts";

const COLUMN_IDS = new Set(TDV_COLUMNS.map((column) => column.id));

test("the general requirements cover the twelve official graphs", () => {
  assert.equal(TDV_GENERAL_EDITION, "22.08.2025");
  assert.equal(TDV_COLUMNS.length, 12);
  assert.equal(new Set(TDV_GENERAL_ROWS.map((row) => row.id)).size, TDV_GENERAL_ROWS.length);

  for (const row of TDV_GENERAL_ROWS) {
    assert.ok(row.label, `Рядок ${row.id}: немає назви`);
    for (const key of Object.keys(row.values)) {
      const column = Number(key);
      assert.ok(COLUMN_IDS.has(column), `Рядок ${row.id}: невідома графа ${key}`);
      assert.ok(row.values[column].trim(), `Рядок ${row.id}, графа ${key}: порожнє значення`);
    }
  }
});

test("the transcribed values match the provided Appendix 3 fragment", () => {
  const row = (id) => TDV_GENERAL_ROWS.find((entry) => entry.id === id);

  assert.deepEqual(row("height-max").values, { 1: "180", 5: "185", 6: "190", 11: "180" });
  assert.deepEqual(row("height-min").values, { 8: "150" });
  assert.deepEqual(row("weight-max").values, { 1: "90", 5: "90" });
  assert.deepEqual(row("weight-min").values, {});
  assert.equal(row("acuity-uncorrected").values[1], "0,5/0,1");
  assert.deepEqual(Object.keys(row("acuity-corrected").values).map(Number), [9, 10, 12]);

  // Графи, що не мають вимоги без корекції, мають її з корекцією — і навпаки.
  const distance = new Set(Object.keys(row("acuity-distance").values).map(Number));
  const corrected = new Set(Object.keys(row("acuity-corrected").values).map(Number));
  for (const column of corrected) {
    assert.ok(!distance.has(column), `Графа ${column} не може мати обидві вимоги гостроти зору`);
  }

  // Дихромазія — непридатність у всіх графах, крім четвертої.
  const dichromasia = Object.keys(row("colour-dichromasia").values).map(Number);
  assert.deepEqual(dichromasia, [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.ok(Object.values(row("colour-dichromasia").values).every((value) => value === "НП"));

  // Графи 1 і 10 мають однакову вимогу до аудіометрії.
  const audiometry = row("hearing-audiometry").values;
  assert.equal(audiometry[1], audiometry[10]);
  assert.match(audiometry[1], /34,9дБ\*/);
  assert.equal(audiometry[2], "по всій тональній шкалі до 25дБ*");
  assert.equal(audiometry[12], "по всій тональній шкалі до 10дБ*");

  const whisper = row("hearing-whisper").values;
  assert.equal(Object.keys(whisper).length, 12);
  assert.equal(whisper[1], "водії 3/3; члени екіпажу 1/4 або 3/3");
  assert.equal(whisper[10], "5/3 або 4/4");
  assert.equal(whisper[12], "3/3");
});

test("article rows of Appendix 3 stay untouched", () => {
  assert.equal(Object.keys(TDV_RULES).length, 75);
  assert.deepEqual(TDV_RULES["1-б"], {
    2: "НП",
    3: "НП",
    4: "НП",
    5: "НП",
    6: "НП",
    7: "НП",
    9: "НП",
    10: "НП",
    11: "НП",
    12: "НП",
  });
});

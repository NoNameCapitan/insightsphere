import assert from "node:assert/strict";
import test from "node:test";
import { requestedPointIndex } from "../lib/vlk-selection.ts";
import { ARTICLE_RULES } from "../lib/vlk-rules.ts";
import { copyPlainText } from "../lib/vlk-clipboard.ts";

test("explicit article-point queries select the same literal point from either search entry", () => {
  for (const query of ["47б", "стаття 47 пункт б", "47 б"]) {
    const index = requestedPointIndex("47", query);
    assert.notEqual(index, undefined, query);
    assert.equal(ARTICLE_RULES["47"][index].point, "б", query);
  }
});

test("a diagnosis or an absent point never chooses a severity automatically", () => {
  assert.equal(requestedPointIndex("47", "астма"), undefined);
  assert.equal(requestedPointIndex("47", "J45"), undefined);
  assert.equal(requestedPointIndex("999", "47б"), undefined);
  assert.equal(requestedPointIndex("87", "87б"), undefined);
});

test("copy preserves the complete wording and only reports success after the write", async () => {
  const text = "Стаття 47 · пункт «б»\nГрафа III\nДослівне формулювання.\nДжерело";
  let actual;
  assert.equal(await copyPlainText(text, { writeText: async (value) => { actual = value; } }), true);
  assert.equal(actual, text);
});

test("unavailable and denied clipboard access use the manual copy path", async () => {
  assert.equal(await copyPlainText("текст", null), false);
  assert.equal(await copyPlainText("текст", { writeText: async () => { throw new Error("NotAllowedError"); } }), false);
});

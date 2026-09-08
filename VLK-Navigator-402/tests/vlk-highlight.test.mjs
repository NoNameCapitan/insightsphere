import assert from "node:assert/strict";
import test from "node:test";
import { displayHighlightParts } from "../lib/vlk-highlight.ts";

test("single digit and prefixed article queries highlight the exact number", () => {
  for (let i = 1; i <= 87; i++) {
    for (const query of [String(i), `стаття ${i}`, `ст.${i}`]) {
      const text = `Стаття ${i}`;
      const parts = displayHighlightParts(text, query);
      assert.equal(parts.map((p) => p.text).join(""), text);
      assert.deepEqual(parts.filter((p) => p.match).map((p) => p.text), [String(i)]);
    }
  }
  assert.ok(!displayHighlightParts("Стаття 13", "3").some((p) => p.match));
});

test("highlighting preserves Ukrainian literal text, codes and HTML-looking queries", () => {
  for (const [text, query] of [["Гіпертонічна хвороба", "гіпертонія"], ["І10-І15", "I10"],
    ["<script>alert(1)</script>", "<script>"], ["≤ 5,5 ≥ 7,8", "5,5"], ["Без змін", ""]]) {
    const parts = displayHighlightParts(text, query);
    assert.equal(parts.map((p) => p.text).join(""), text);
  }
  assert.ok(displayHighlightParts("І10-І15", "I10").some((p) => p.match));
});

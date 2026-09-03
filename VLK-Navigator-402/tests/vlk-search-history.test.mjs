import assert from "node:assert/strict";
import test from "node:test";

import {
  addSearchHistory,
  readSearchHistory,
  SEARCH_HISTORY_LIMIT,
} from "../lib/vlk-search-history.ts";

test("recent queries are stored without duplicates and within the limit", () => {
  let history = [];
  for (const query of ["астма", "J45", "астма", "гіпертонія", "меніск", "I10", "стаття 47", "зайвий"]) {
    history = addSearchHistory(history, query);
  }

  assert.equal(history.length, SEARCH_HISTORY_LIMIT);
  assert.equal(history[0], "зайвий", "Останній запит стоїть першим");
  assert.equal(new Set(history).size, history.length, "Дублікатів немає");
  assert.ok(!history.includes("J45"), "Найстаріші запити витісняються");
});

test("duplicates are case-insensitive and short queries are ignored", () => {
  const history = addSearchHistory(addSearchHistory([], "Астма"), "астма");
  assert.deepEqual(history, ["астма"]);
  assert.deepEqual(addSearchHistory([], "a"), []);
  assert.deepEqual(addSearchHistory([], "   "), []);
  assert.deepEqual(addSearchHistory([], "x".repeat(200)), []);
});

test("a damaged stored value never breaks the search box", () => {
  assert.deepEqual(readSearchHistory(null), []);
  assert.deepEqual(readSearchHistory("{не json"), []);
  assert.deepEqual(readSearchHistory(JSON.stringify({ not: "array" })), []);
  assert.deepEqual(readSearchHistory(JSON.stringify(["астма", 42, "", "астма", "J45"])), [
    "астма",
    "J45",
  ]);
  assert.equal(readSearchHistory(JSON.stringify(Array(50).fill(0).map((_, i) => `q${i}`))).length, SEARCH_HISTORY_LIMIT);
});

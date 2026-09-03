import assert from "node:assert/strict";
import test from "node:test";

import { CHECKED_EDITION, EDITION_NOTICE, editionLabel } from "../lib/vlk-edition.ts";
import { EDITION } from "../lib/vlk-sample-data.ts";
import {
  addRecent,
  EMPTY_WORKSPACE,
  readWorkspace,
  RECENT_LIMIT,
  serializeWorkspace,
} from "../lib/vlk-workspace.ts";

test("the last specialty and recent views survive a round trip", () => {
  const workspace = {
    specialty: "therapist",
    recent: [
      { article: "39", point: "б" },
      { article: "47", point: "" },
    ],
  };
  assert.deepEqual(readWorkspace(serializeWorkspace(workspace)), workspace);
});

test("recent views keep the newest first, without duplicates and within the limit", () => {
  let recent = [];
  for (const entry of [
    { article: "39", point: "б" },
    { article: "47", point: "" },
    { article: "39", point: "б" },
    { article: "1", point: "а" },
    { article: "2", point: "" },
    { article: "61", point: "в" },
    { article: "78", point: "" },
  ]) {
    recent = addRecent(recent, entry);
  }

  assert.equal(recent.length, RECENT_LIMIT);
  assert.deepEqual(recent[0], { article: "78", point: "" });
  assert.equal(
    new Set(recent.map((item) => `${item.article}-${item.point}`)).size,
    recent.length,
  );
  // Той самий пункт, відкритий повторно, піднімається вгору, а не дублюється.
  const again = addRecent(recent, { article: "1", point: "а" });
  assert.deepEqual(again[0], { article: "1", point: "а" });
  assert.equal(again.length, RECENT_LIMIT);
});

test("an article and one of its points are different entries", () => {
  const recent = addRecent(addRecent([], { article: "39", point: "" }), {
    article: "39",
    point: "б",
  });
  assert.equal(recent.length, 2);
});

test("a damaged or foreign stored value never breaks the start screen", () => {
  assert.deepEqual(readWorkspace(null), EMPTY_WORKSPACE);
  assert.deepEqual(readWorkspace("{не json"), EMPTY_WORKSPACE);
  assert.deepEqual(readWorkspace(JSON.stringify(["масив"])), EMPTY_WORKSPACE);

  const restored = readWorkspace(
    JSON.stringify({
      specialty: "невідома спеціальність",
      recent: [1, null, { article: "999" }, { article: "5", point: "а" }, "рядок"],
    }),
  );
  assert.equal(restored.specialty, "", "Невідома спеціальність ігнорується");
  assert.deepEqual(restored.recent, [{ article: "5", point: "а" }]);
  assert.deepEqual(addRecent([], { article: "abc", point: "а" }), []);
});

test("the edition indicator is fixed and leaves room for a future notice", () => {
  assert.equal(CHECKED_EDITION, EDITION);
  assert.equal(editionLabel(), `Оновлено: ${EDITION}`);
  // Поки автоматичної перевірки нової редакції немає, сповіщення порожнє.
  assert.equal(EDITION_NOTICE, null);
});

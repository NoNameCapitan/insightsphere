import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPTY_DIRECTORY,
  EMPTY_SESSION,
  restoreSession,
  serializeSession,
} from "../lib/vlk-session.ts";

test("a saved session round-trips", () => {
  const raw = serializeSession({
    examineeType: "Військовослужбовець",
    scheduleGraph: "II",
    directory: { ...EMPTY_DIRECTORY, therapist: "Іваненко" },
  });

  const restored = restoreSession(raw);
  assert.equal(restored.examineeType, "Військовослужбовець");
  assert.equal(restored.scheduleGraph, "II");
  assert.equal(restored.directory.therapist, "Іваненко");
});

test("records from the previous structure are still readable", () => {
  // Старі записи містили кошик, режим і чекліст: ці поля просто ігноруються,
  // а налаштування перегляду читаються як раніше.
  const legacy = JSON.stringify({
    basket: [{ id: "39-б", article: "39", point: "б", outcome: "Придатні" }],
    citizenChecked: ["Маю направлення"],
    mode: "citizen",
    examineeType: "Кандидат на контракт",
    directory: { therapist: "Петренко" },
  });

  const restored = restoreSession(legacy);
  assert.equal(restored.examineeType, "Кандидат на контракт");
  assert.equal(restored.directory.therapist, "Петренко");
  assert.equal(restored.scheduleGraph, "all");
  assert.equal(Object.keys(restored).length, 3);
  assert.ok(!("basket" in restored));
  assert.ok(!("mode" in restored));
  assert.ok(!("citizenChecked" in restored));
});

test("damaged or unknown records never break the application", () => {
  for (const raw of [null, undefined, "{не json", "[]", "42", JSON.stringify({ basket: "щось" })]) {
    assert.deepEqual(restoreSession(raw), { ...EMPTY_SESSION });
  }

  const withGarbage = restoreSession(
    JSON.stringify({
      examineeType: "невідома категорія",
      scheduleGraph: "невідома графа",
      directory: "не об’єкт",
    }),
  );
  assert.equal(withGarbage.examineeType, "Військовозобов’язаний");
  assert.equal(withGarbage.scheduleGraph, "all");
  assert.deepEqual(withGarbage.directory, EMPTY_DIRECTORY);
});

test("the stored record carries no basket, mode or checklist any more", () => {
  const stored = JSON.parse(
    serializeSession({
      examineeType: "Військовозобов’язаний",
      scheduleGraph: "all",
      directory: EMPTY_DIRECTORY,
    }),
  );
  assert.deepEqual(Object.keys(stored).sort(), ["directory", "examineeType", "scheduleGraph", "version"]);
});

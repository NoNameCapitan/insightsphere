import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { EMPTY_SESSION } from "../lib/vlk-session.ts";
import * as report from "../lib/vlk-report.ts";
import { WORKSPACE_KEY } from "../lib/vlk-workspace.ts";

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const file = (name) => existsSync(new URL(`../${name}`, import.meta.url));

/**
 * Навігатор має один режим — лікаря ВЛК. Режим громадянина і зведення
 * прибрані, і ці перевірки не дають їм повернутися непомітно.
 */

test("the interface no longer offers a citizen mode", () => {
  for (const name of ["app/page.tsx", "app/globals.css", "components/vlk/workspace-tabs.tsx"]) {
    const source = read(name);
    assert.doesNotMatch(source, /citizen|Громадянин|проходжу ВЛК/i, name);
  }
  assert.ok(!file("components/vlk/citizen-preparation.tsx"), "компонент підготовки громадянина видалено");
});

test("the summary basket and its draft are gone from the interface", () => {
  for (const name of ["app/page.tsx", "app/globals.css", "components/vlk/workspace-tabs.tsx"]) {
    const source = read(name);
    assert.doesNotMatch(source, /basket|Зведення|зведення|draftOpen|PrintReport/, name);
  }
  assert.ok(!file("components/vlk/print-report.tsx"), "аркуш друку зведення видалено");
});

test("the stored session keeps only viewing preferences", () => {
  assert.deepEqual(Object.keys(EMPTY_SESSION).sort(), ["directory", "examineeType", "scheduleGraph"]);
  const source = read("lib/vlk-session.ts");
  assert.doesNotMatch(source, /basket|BasketItem|citizen|Mode\b/);
  // Робоче місце (остання спеціальність, останні перегляди) не чіпали.
  assert.equal(WORKSPACE_KEY, "vlk-402-workspace-v1");
});

test("text exports keep the copy helpers and drop the draft builders", () => {
  assert.deepEqual(Object.keys(report).sort(), ["buildPointWordingText", "buildReferenceText"]);
});

test("the workspace has two panels: the list and the reading pane", () => {
  const tabs = read("components/vlk/workspace-tabs.tsx");
  assert.match(tabs, /export type WorkspacePanel = "list" \| "article";/);
  assert.equal((tabs.match(/\{ id: "/g) ?? []).length, 2);
  const page = read("app/page.tsx");
  assert.doesNotMatch(page, /vlk-panel-summary|vlk-tab-summary/);
});

test("the normative corpus keeps its own wording untouched", () => {
  // «громадянин» і «зведення» трапляються в дослівних поясненнях Додатка 2
  // (зведення пальців, громадяни, які проходять огляд) — текст норми не правиться.
  const article62 = read("lib/explanations/article-62.ts");
  assert.match(article62, /зведення/);
});

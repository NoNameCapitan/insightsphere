import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ARTICLES, SPECIALTIES } from "../lib/vlk-sample-data.ts";
import { TDV_COLUMNS, TDV_RULES } from "../lib/vlk-tdv.ts";
import { TDV_GENERAL_ROWS } from "../lib/vlk-tdv-general.ts";
import { articleNavigationSpecialty, scrollOffsetToReveal, tdvColumnsForView } from "../lib/vlk-reading-navigation.ts";
import { createWorkspaceHistory } from "../lib/vlk-workspace-history.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/page.tsx");
const tdv = read("components/vlk/tdv-dialog.tsx");
const article = (number) => ARTICLES.find((item) => item.article === number);

test("shared-article navigation preserves compatible doctor context and explicit scope", () => {
  assert.equal(articleNavigationSpecialty(article("38"), "surgeon"), "surgeon");
  assert.equal(articleNavigationSpecialty(article("38"), "", "surgeon"), "surgeon");
  assert.equal(articleNavigationSpecialty(article("38"), "surgeon", "therapist"), "therapist");
  assert.equal(articleNavigationSpecialty(article("47"), "surgeon"), "therapist");
  assert.equal(articleNavigationSpecialty(article("38"), "surgeon", "dentist"), "surgeon");
  for (const item of ARTICLES) for (const specialty of SPECIALTIES) {
    const next = articleNavigationSpecialty(item, specialty.id);
    assert.ok(item.specialties.includes(next));
    if (item.specialties.includes(specialty.id)) assert.equal(next, specialty.id);
  }
});

test("all article-opening paths share the context-preserving rule", () => {
  for (const name of ["openNavigationArticle", "chooseHit", "openRecent"]) {
    const body = page.split(`function ${name}(`)[1].split("\n  }")[0];
    assert.match(body, /articleNavigationSpecialty\(article, specialty \|\| lastSpecialty/);
    assert.doesNotMatch(body, /setSpecialty\(article\.specialties\[0\]\)/);
  }
});

test("return to list changes only presentation and preserves the selected clinical point", () => {
  const body = page.split("function showListPanel()")[1].split("\n  }")[0];
  assert.match(body, /setMobilePanel\("list"\)/);
  assert.match(body, /aria-current="true"/);
  assert.match(body, /focus\(\{ preventScroll: true \}\)/);
  assert.match(body, /scrollOffsetToReveal/);
  assert.doesNotMatch(body, /setQuery|setSpecialty|setSelectedId|setSelectedRuleIndex|setOutcomeFilter|setPointFilter|setSearchSpecialty|goHome/);
  assert.match(page, /onClick=\{showListPanel\}[\s\S]*?Повернутися до результатів пошуку/);
  assert.match(page, /className="active-search-scope"/);
});

test("TDV focus is a reversible projection of every original cell, never a new conclusion", () => {
  const original = JSON.stringify({ TDV_COLUMNS, TDV_RULES, TDV_GENERAL_ROWS });
  for (const column of TDV_COLUMNS) {
    assert.deepEqual(tdvColumnsForView(column.id), [column]);
    assert.deepEqual(tdvColumnsForView(column.id, true), TDV_COLUMNS);
    for (const marks of Object.values(TDV_RULES)) {
      assert.deepEqual(tdvColumnsForView(column.id).map((c) => marks[c.id]), [marks[column.id]]);
    }
    for (const row of TDV_GENERAL_ROWS) {
      assert.deepEqual(tdvColumnsForView(column.id).map((c) => row.values[c.id]), [row.values[column.id]]);
    }
  }
  for (const invalid of [undefined, null, 0, 13, 1.5, "9"]) {
    assert.deepEqual(tdvColumnsForView(invalid), TDV_COLUMNS);
  }
  assert.equal(JSON.stringify({ TDV_COLUMNS, TDV_RULES, TDV_GENERAL_ROWS }), original);
  assert.match(tdv, /TDV_GENERAL_ROWS\.map/);
  assert.match(tdv, /TDV_ROWS\.map/);
  assert.equal((tdv.match(/colSpan=\{visibleColumns.length \+ 1\}/g) ?? []).length, 2);
  assert.doesNotMatch(tdv.slice(tdv.indexOf('<table ref={tableRef}')), /TDV_COLUMNS\.map/);
  assert.match(tdv, /if \(nextOpen\) setViewColumn\(selectedColumn\)/);
  assert.match(tdv, /value=\{viewColumn \?\? "all"\}/);
  assert.match(tdv, /Лише перегляд · призначення огляду/);
  assert.match(tdv, /Порожня клітинка не є автоматичним підтвердженням придатності/);
  assert.match(tdv, /selectedDestination.label/);
});

test("chosen TDV graph can be revealed behind a sticky row label, even without an article", () => {
  const base = { viewportSize: 366, scrollSize: 960, scrollOffset: 0, leadingInset: 148 };
  assert.equal(scrollOffsetToReveal({ ...base, start: 700, end: 770 }), 404);
  assert.equal(scrollOffsetToReveal({ ...base, scrollOffset: 404, start: 700, end: 770 }), 404);
  assert.equal(scrollOffsetToReveal({ ...base, scrollOffset: 500, start: 200, end: 270 }), 52);
  assert.equal(scrollOffsetToReveal({ ...base, start: 900, end: 990 }), 594, "clamped at the end");
  assert.equal(scrollOffsetToReveal({ ...base, start: 0, end: 70 }), 0, "clamped at the start");
  assert.equal(scrollOffsetToReveal({ ...base, viewportSize: 100, start: 700, end: 770 }), 0, "hidden or too narrow container");
  assert.equal(scrollOffsetToReveal({ ...base, start: 300, end: 800 }), 152, "oversized target aligns its start");
  assert.match(tdv, /leadingInset: firstColumn.offsetWidth \+ 8/);
  assert.doesNotMatch(tdv, /if \(!row \|\| !container\)/);
  assert.doesNotMatch(tdv, /scrollIntoView/);
});

test("list return reveals selected row without scrolling the page", () => {
  const base = { viewportSize: 300, scrollSize: 1400, scrollOffset: 200 };
  assert.equal(scrollOffsetToReveal({ ...base, start: 300, end: 370 }), 200);
  assert.equal(scrollOffsetToReveal({ ...base, start: 1000, end: 1080 }), 780);
  assert.equal(scrollOffsetToReveal({ ...base, start: 90, end: 160 }), 90);
});

test("Back then Forward restores the exact latest workspace without persisting a query", () => {
  const history = createWorkspaceHistory();
  const snapshot = { specialty: "surgeon", query: "стаття 38 пункт б", selectedId: article("38").id,
    selectedRuleIndex: "1", outcomeFilter: "limited", pointFilter: "б", searchSpecialty: "all", mobilePanel: "article" };
  assert.equal(history.restore(history.marker), undefined);
  history.remember(snapshot);
  for (const state of [undefined, null, 42, "dashboard", {}, { vlk: "home" }]) assert.equal(history.restore(state), undefined);
  for (let cycle = 0; cycle < 3; cycle++) assert.deepEqual(history.restore(history.marker), snapshot);
  const returned = history.restore(history.marker);
  returned.query = "changed externally";
  assert.equal(history.restore(history.marker).query, snapshot.query);
  history.remember({ ...snapshot, mobilePanel: "list" });
  assert.equal(history.restore(history.marker).mobilePanel, "list");
  const reloaded = createWorkspaceHistory();
  reloaded.remember(snapshot);
  assert.equal(reloaded.restore(history.marker), undefined, "a stale pre-reload dashboard is not this workspace");
  assert.equal(history.restore({ vlk: "dashboard" }), undefined, "old markers cannot revive this workspace");
  assert.deepEqual(Object.keys(history.marker).sort(), ["vlk", "vlkEntry"]);
  const clearedMarker = history.marker;
  history.clear();
  assert.equal(history.restore(history.marker), undefined, "session reset cannot revive a cleared query");
  history.remember({ ...snapshot, query: "new session" });
  assert.equal(history.restore(clearedMarker), undefined, "cleared markers stay dead after starting new work");
  assert.equal(history.restore(history.marker).query, "new session");
  assert.doesNotMatch(read("lib/vlk-workspace-history.ts"), /localStorage|sessionStorage|pushState|replaceState/);
  assert.match(page, /workspaceHistory.clear\(\)/);
});

test("focused TDV styling beats the full mobile width and preserves touch/focus affordances", () => {
  const css = read("app/globals.css");
  assert.match(css, /\.table-fullscreen \.tdv-table\[data-focused-column="true"\] \{ min-width: 0; width: 100%; \}/);
  assert.match(css, /\.tdv-view-picker select \{ min-height: 44px/);
  assert.doesNotMatch(css, /\.tdv-destination summary \{ min-height: (?:32|36)px/);
  assert.match(tdv, /<label htmlFor=\{viewId\}>Графа для перегляду/);
  assert.match(tdv, /<option value="all">Усі 12 граф/);
  assert.match(tdv, /TDV_COLUMNS\.map\(\(column\) => <option/);
  assert.match(css, /\.tdv-view-picker select:focus-visible/);
});

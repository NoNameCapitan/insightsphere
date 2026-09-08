import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ARTICLES, SPECIALTIES } from "../lib/vlk-sample-data.ts";
import { loadArticleExplanation } from "../lib/vlk-explanations.ts";
import { explanationBlocks, explanationTables } from "../lib/vlk-explanation-tables.ts";

const expected = { 13: [1, 2], 35: [3], 36: [4], 38: [5, 6, 7, 8, 9, 10],
  39: [11], 40: [12], 46: [13], 61: [14], 62: [15], 64: [16], 66: [17, 18, 19] };

function checkGrid(rows, columns, label) {
  const occupied = [];
  rows.forEach((row, r) => {
    occupied[r] ??= [];
    let c = 0;
    for (const cell of row) {
      while (occupied[r][c]) c++;
      for (let y = r; y < r + (cell.rowSpan ?? 1); y++) {
        assert.ok(y < rows.length, `${label}: row span outside table`);
        occupied[y] ??= [];
        for (let x = c; x < c + (cell.colSpan ?? 1); x++) {
          assert.ok(x < columns && !occupied[y][x], `${label}: overlapping cell ${r}:${c}`);
          occupied[y][x] = true;
        }
      }
      c += cell.colSpan ?? 1;
    }
    assert.equal(occupied[r].filter(Boolean).length, columns, `${label}: incomplete row ${r}`);
  });
}

test("all 87 articles and every specialty expose every numbered table", async () => {
  const numbers = [];
  for (const article of ARTICLES) {
    const e = await loadArticleExplanation(article.article);
    const tables = explanationTables(article.article, e.paragraphs);
    assert.deepEqual(tables.map((t) => t.number), expected[article.article] ?? []);
    assert.deepEqual(tables.map((t) => e.paragraphs[t.start]), e.paragraphs.filter((p) => /^Таблиця \d+$/.test(p)));
    numbers.push(...tables.map((t) => t.number));
    for (const specialty of article.specialties) assert.ok(SPECIALTIES.some((s) => s.id === specialty));
  }
  assert.deepEqual(numbers.sort((a, b) => a - b), Array.from({ length: 19 }, (_, i) => i + 1));
});

test("every literal table fragment appears exactly once in order, with valid spans", async () => {
  for (const article of Object.keys(expected)) {
    const e = await loadArticleExplanation(article);
    for (const t of explanationTables(article, e.paragraphs)) {
      const indices = [...t.head, ...t.body].flatMap((r) => r.flatMap((c) => c.indices));
      assert.deepEqual(indices, Array.from({ length: t.end - t.start - 1 }, (_, i) => t.start + i + 2), `Table ${t.number}: lost/repeated source text`);
      checkGrid(t.head, t.columns, `Table ${t.number} heading`);
      checkGrid(t.body, t.columns, `Table ${t.number} body`);
    }
    const blocks = explanationBlocks(article, e.paragraphs);
    const covered = blocks.flatMap((b) => b.kind === "paragraph" ? [b.index]
      : Array.from({ length: b.table.end - b.table.start + 1 }, (_, i) => b.table.start + i));
    assert.deepEqual(covered, e.paragraphs.map((_, i) => i), `Article ${article}: content missing outside tables`);
  }
});

test("point excerpts expand whole tables, never partial headers or rows", async () => {
  for (const article of Object.keys(expected)) {
    const e = await loadArticleExplanation(article);
    for (const t of explanationTables(article, e.paragraphs)) {
      const blocks = explanationBlocks(article, e.paragraphs, e.paragraphs.slice(t.start, t.start + 4));
      assert.deepEqual(blocks, [{ kind: "table", table: t }]);
    }
  }
  assert.deepEqual(explanationTables("13", []), []);
  assert.deepEqual(explanationBlocks("13", [], []), []);
});

test("height and weight table keeps all 25 rows, age boundary and source values", async () => {
  const e = await loadArticleExplanation("13");
  const t = explanationTables("13", e.paragraphs)[1];
  assert.equal(t.body.length, 25);
  assert.ok(e.paragraphs[t.start + 1].includes("18-25"));
  assert.deepEqual(t.body[0].map((c) => e.paragraphs[c.indices[0]]), ["150", "42-44", "44-52", "52-62", "62-67", "68-79", "79-90"]);
  assert.equal(e.paragraphs[t.body.at(-1)[0].indices[0]], "200");
});

test("navigation contains only article selection; details and marks live in the centre", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  // Ліва панель тепер відкривається атрибутом панелі, а не класом оболонки.
  const sidebarStart = page.indexOf('data-panel="list"');
  assert.ok(sidebarStart > 0);
  const sidebar = page.slice(sidebarStart, page.indexOf("</aside>", sidebarStart));
  assert.ok(sidebar.includes("data-article-row"));
  assert.doesNotMatch(sidebar, /pointLabel|ARTICLE_RULES|articleRules\.map|outcomeStyles/);
  assert.match(page, /aria-label="Збіг у вибраній статті"/);
  assert.match(page, /<ExplanationDocument article=\{selected.article\}/);
});

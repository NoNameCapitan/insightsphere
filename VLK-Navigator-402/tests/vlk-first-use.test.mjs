import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ARTICLE_RULES } from "../lib/vlk-rules.ts";
import { EXPLANATION_ARTICLES, loadArticleExplanation } from "../lib/vlk-explanations.ts";
import { articleExplanationParagraphs, pointMentions } from "../lib/vlk-explanation-view.ts";
import { explanationSections, explanationPlainText } from "../lib/vlk-explanation-sections.ts";
import { explanationFindMatches, explanationFindParts, explanationPointStart } from "../lib/vlk-explanation-reader.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/page.tsx");
const reader = read("components/vlk/explanation-document.tsx");
const css = read("app/globals.css");

test("first-use guidance replaces decorative topics and there is one full explanation entry", () => {
  assert.match(page, /aria-label="Як почати роботу"/);
  for (const label of ["Знайдіть статтю", "Оберіть пункт", "Прочитайте пояснення"]) assert.ok(page.includes(label));
  assert.equal((page.match(/<FullExplanationDialog/g) ?? []).length, 1);
  assert.doesNotMatch(page, /<InlineExplanation|value="point-explanation"|className="clinical-context"|ТДВ · Додаток 3/);
  assert.match(page, /selectedPoint=\{selectedRule\?\.point\}[\s\S]*?ariaLabel=/);
  assert.match(page, /<ReviewContextResult/);
  assert.match(page, /\{contextual.scheduleText \|\| "— \(клітинка цієї графи порожня\)"\}/);
  assert.match(page, /Це не постанова ВЛК/);
  assert.match(page, /<PointTdvDetails/);
});

test("tablet split at 1024 has one visible context/filter surface and no accidental focus jump", () => {
  assert.match(page, /className="reading-context lg:hidden"/);
  assert.match(page, /className="reading-filters lg:hidden"/);
  assert.doesNotMatch(page, /reading-(?:context|filters) xl:hidden/);
  assert.match(page, /className="review-context-line hidden lg:block"/);
  assert.match(page, /max-width: 1023px/);
  assert.match(css, /@media \(min-width: 1024px\) \{ \.reading-filter-summary \{ display: none; \}/);
});

test("active filters expose their match count and reset outside the collapsed settings", () => {
  const sidebar = page.slice(page.indexOf('<aside className="command-sidebar'), page.indexOf('</aside>'));
  const filterStart = sidebar.indexOf('data-sidebar-section="filters"');
  const settingsEnd = sidebar.indexOf('</details>', filterStart);
  assert.ok(sidebar.indexOf('Збіги: {filteredCount} із {baseArticles.length}') > settingsEnd);
  assert.ok(sidebar.indexOf('aria-label="Скинути фільтри пунктів"') > settingsEnd);
  assert.match(sidebar, /listIndex === filteredCount && dimmed/);
  assert.match(sidebar, /Інші статті · поза фільтром/);
  assert.match(page, /Решта статей доступна нижче/);
  assert.match(page, /Усі пункти доступні\. Фільтр не визначає придатність/);
});

test("point jumps use actual headings, including numbered headings, and never infer a section", () => {
  const paragraphs = ["Загальні правила", "Враховується пункт «б»", "До пункту «а» належать:", "2) До пункту «б» належать:", "3) пункт «в», до якого належать:"];
  assert.equal(explanationPointStart(paragraphs, "а"), 2);
  assert.equal(explanationPointStart(paragraphs, "б"), 3);
  assert.equal(explanationPointStart(paragraphs, "в"), 4);
  assert.equal(explanationPointStart(paragraphs, "г"), undefined);
  assert.equal(explanationPointStart(paragraphs, "—"), 0);
  assert.equal(explanationPointStart([], "—"), undefined);
  assert.equal(explanationPointStart(paragraphs), undefined);
});

test("every corpus point jump opens a source-backed section and retains every original block", async () => {
  for (const article of EXPLANATION_ARTICLES) {
    const explanation = await loadArticleExplanation(article);
    const paragraphs = articleExplanationParagraphs(explanation);
    const before = JSON.stringify(paragraphs);
    const sections = explanationSections(article, paragraphs);
    const copied = explanationPlainText(article, paragraphs);
    for (const rule of ARTICLE_RULES[article] ?? []) {
      const index = explanationPointStart(paragraphs, rule.point);
      if (index === undefined) continue;
      assert.ok(index >= 0 && index < paragraphs.length);
      assert.ok(rule.point === "—" || pointMentions(paragraphs[index]).includes(rule.point));
      assert.ok(sections.some((section) => section.indices.includes(index)), `${article}-${rule.point}`);
    }
    assert.equal(JSON.stringify(paragraphs), before);
    assert.equal(explanationPlainText(article, paragraphs), copied);
  }
});

test("reader find is literal and case-insensitive, including numbers, single letters and punctuation", () => {
  const paragraphs = ["Таблиця 5", "Таблиця 6", "Пункт б", "Пункт а", "5,5 мм", "[5] (а) + ?"];
  assert.deepEqual(explanationFindMatches(paragraphs, "ТАБЛИЦЯ 5"), [0]);
  assert.deepEqual(explanationFindMatches(paragraphs, "пункт б"), [2]);
  assert.deepEqual(explanationFindMatches(paragraphs, "5"), [0, 4, 5]);
  assert.deepEqual(explanationFindMatches(paragraphs, "[5]"), [5]);
  assert.deepEqual(explanationFindMatches(paragraphs, "(а) + ?"), [5]);
  assert.deepEqual(explanationFindMatches(paragraphs, "відсутній термін"), []);
  assert.deepEqual(explanationFindMatches(paragraphs, "  "), []);
  for (const query of ["Таблиця 5", "5", "[5]", "(", ".*", "а"]) for (const paragraph of paragraphs) {
    const parts = explanationFindParts(paragraph, query);
    assert.equal(parts.map((part) => part.text).join(""), paragraph);
    for (const part of parts.filter((item) => item.match)) assert.equal(part.text.toLocaleLowerCase("uk"), query.toLocaleLowerCase("uk"));
  }
});

test("reader find covers table titles/cells without splitting tables or borrowing another heading", async () => {
  const paragraphs = articleExplanationParagraphs(await loadArticleExplanation("38"));
  const matches = explanationFindMatches(paragraphs, "Таблиця 5");
  assert.equal(matches.length, 1);
  assert.equal(paragraphs[matches[0]], "Таблиця 5");
  const section = explanationSections("38", paragraphs).find((item) => item.indices.includes(matches[0]));
  assert.equal(section.blocks[0].kind, "table");
  assert.match(reader, /data-source-index=\{table.start\}/);
  assert.match(reader, /data-source-index=\{table.start \+ 1\}/);
  assert.match(reader, /literalFind=\{Boolean\(findQuery.trim\(\)\)\}/);
  assert.match(reader, /onEscapeKeyDown=/);
  assert.match(reader, /if \(nextOpen\) \{ setFindQuery\(""\); setMatchCursor\(0\); \}/);
});

test("new controls preserve normal reading size, focus visibility and 44px targets", () => {
  assert.match(css, /\.reader-find-input input \{[^}]*min-height: 44px/);
  assert.match(css, /\.reader-find-results button \{[^}]*min-width: 44px; min-height: 44px/);
  assert.match(css, /\.filter-summary button \{[^}]*min-height: 44px/);
  assert.match(css, /\.tdv-view-picker select \{ min-height: 44px/);
  assert.match(css, /\.reader-find-toolbar :is\(input, button\):focus-visible/);
  assert.match(css, /\.article-content \.normative-context-result p,/);
  assert.match(css, /\.article-content \[data-schedule-result\] p,/);
  assert.match(css, /\.article-content \.vlk-normative \{ font-size: 15px; line-height: 1.75/);
});

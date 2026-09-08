import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("below xl the workspace shows one panel at a time", () => {
  const page = source("app/page.tsx");
  assert.match(page, /role="tablist"/);
  assert.match(page, /aria-label="Панель робочого екрана"/);
  assert.match(page, /MOBILE_PANELS/);

  // Кожна з трьох панелей ховається, коли активна інша.
  for (const panel of ["list", "article", "summary"]) {
    assert.ok(
      page.includes(`mobilePanel === "${panel}" ? "" : "hidden xl:flex"`),
      `панель ${panel} не ховається в мобільному режимі`,
    );
  }

  // Вибір статті переводить телефон на її текст, а не лишає в списку.
  const select = page.slice(page.indexOf("function selectFromList"), page.indexOf("function selectRule"));
  assert.match(select, /setMobilePanel\("article"\)/);
  const chooseHit = page.slice(page.indexOf("function chooseHit"), page.indexOf("function runQuery"));
  assert.match(chooseHit, /setMobilePanel\("article"\)/);
});

test("printing goes through a document sheet in the DOM, not a popup window", () => {
  const page = source("app/page.tsx");
  const css = source("app/globals.css");

  assert.doesNotMatch(page, /window\.open\(/);
  assert.match(page, /className="print-root print-sheet"/);
  assert.match(page, /window\.print\(\)/);

  const print = css.slice(css.indexOf("@media print"));
  assert.match(print, /body > \*:not\(\.print-root\)\s*\{\s*display: none !important;/);
  assert.match(print, /\.print-root\s*\{\s*display: block !important;/);
  assert.match(print, /@page\s*\{\s*margin:/);
});

test("the printed sheet carries the edition, the literal outcome and the disclaimer", () => {
  const page = source("app/page.tsx");
  const sheet = page.slice(page.indexOf('className="print-root print-sheet"'));

  assert.match(sheet, /редакція від \{EDITION\}/);
  assert.match(sheet, /Результат за четвертою графою, дослівно/);
  assert.match(sheet, /\{item\.outcome\}/);
  assert.match(sheet, /\{item\.condition\}/);
  assert.match(sheet, /не постанова ВЛК/);
  assert.match(sheet, /\{SOURCE_URL\}/);
});

test("the left panel keeps its height for the article list", () => {
  const page = source("app/page.tsx");
  const start = page.indexOf('data-panel="list"');
  const sidebar = page.slice(start, page.indexOf("</aside>", start));

  // Спеціальність обирається одним полем, а не сіткою з восьми карток.
  assert.match(sidebar, /id="specialty-select"/);
  assert.match(sidebar, /SPECIALTY_ARTICLE_COUNTS/);
  assert.ok(!sidebar.includes("min-h-[52px]"));
});

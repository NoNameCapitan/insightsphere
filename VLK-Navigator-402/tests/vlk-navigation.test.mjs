import assert from "node:assert/strict";
import test from "node:test";

import { ARTICLE_ANCHORS } from "../lib/vlk-anchors.ts";
import { EXPLANATION_META, loadArticleExplanation } from "../lib/vlk-explanations.ts";
import { explanationSignals, pointExplanation } from "../lib/vlk-explanation-view.ts";
import {
  explanationUrl,
  officialArticleUrl,
  officialRuleUrl,
  ORDER_BASE_URL,
  ruleHighlight,
  textFragment,
} from "../lib/vlk-links.ts";
import { ARTICLE_RULES } from "../lib/vlk-rules.ts";
import { ARTICLES, SOURCE_URL } from "../lib/vlk-sample-data.ts";

test("every article links to its own anchor in the current edition", () => {
  for (const article of ARTICLES) {
    const url = officialArticleUrl(article.article);
    assert.equal(url, `${ORDER_BASE_URL}#${ARTICLE_ANCHORS[article.article]}`);
    assert.match(url, /ed20250822#n\d+$/);
  }
  assert.equal(officialArticleUrl("999"), SOURCE_URL, "Невідома стаття не веде на випадковий якір");
});

test("a selected point adds a text fragment that highlights its literal wording", () => {
  const rule = ARTICLE_RULES["39"].find((entry) => entry.point === "б");
  const url = officialRuleUrl("39", rule);

  assert.ok(url.startsWith(`${ORDER_BASE_URL}#${ARTICLE_ANCHORS["39"]}:~:text=`));
  assert.ok(decodeURIComponent(url.split(":~:text=")[1]).startsWith("б) "));
  assert.equal(ruleHighlight(rule), `б) ${rule.condition}`);

  const undivided = officialRuleUrl("2", ARTICLE_RULES["2"][0]);
  assert.ok(!decodeURIComponent(undivided.split(":~:text=")[1]).startsWith("—"));
});

test("the highlighted fragment is cut on a word boundary", () => {
  const long = `слово ${"дуже довге формулювання ".repeat(20)}`;
  const fragment = decodeURIComponent(textFragment(long));
  assert.ok(fragment.length <= 150);
  assert.ok(!fragment.endsWith(" "));
  assert.equal(decodeURIComponent(textFragment("  короткий   текст ")), "короткий текст");
});

test("explanation links point at the article's own explanation anchor", () => {
  for (const [article, meta] of Object.entries(EXPLANATION_META)) {
    const url = explanationUrl(meta.anchor, SOURCE_URL);
    if (meta.status === "absent") {
      assert.equal(url, SOURCE_URL, `Стаття ${article}`);
      continue;
    }
    assert.equal(url, `${ORDER_BASE_URL}#${ARTICLE_ANCHORS[article]}`, `Стаття ${article}`);
  }
});

test("point explanation keeps only the literal fragments of that point", async () => {
  const explanation = await loadArticleExplanation("39");
  const forPointB = pointExplanation(explanation, "б");

  assert.ok(forPointB.length > 0);
  for (const paragraph of forPointB) {
    assert.ok(explanation.paragraphs.includes(paragraph), "Фрагмент має бути дослівним");
  }
  assert.ok(forPointB.length < explanation.paragraphs.length);
  assert.deepEqual(pointExplanation(undefined, "б"), []);

  const signals = explanationSignals(explanation);
  assert.ok(signals.includes("Інструментальні дані"), "Пояснення статті 39 посилається на інструментальні дані");
  assert.deepEqual(explanationSignals(undefined), []);
});

test("an article without a point division shows the beginning of the explanation", async () => {
  const explanation = await loadArticleExplanation("2");
  const undivided = pointExplanation(explanation, "—");
  assert.deepEqual(undivided, explanation.paragraphs.slice(0, 8));
});

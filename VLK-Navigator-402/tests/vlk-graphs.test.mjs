import assert from "node:assert/strict";
import test from "node:test";

import {
  graphContextLabel,
  graphGuidance,
  paragraphAppliesToGraph,
} from "../lib/vlk-graphs.ts";
import { EXPLANATION as ARTICLE_56 } from "../lib/explanations/article-56.ts";
import { EXPLANATION as ARTICLE_62 } from "../lib/explanations/article-62.ts";

test("graph ranges are parsed without confusing I, II and III", () => {
  assert.equal(paragraphAppliesToGraph("За графою I застосовується норма.", "I"), true);
  assert.equal(paragraphAppliesToGraph("За графою I застосовується норма.", "II"), false);
  assert.equal(paragraphAppliesToGraph("За графами II-III застосовується норма.", "I"), false);
  assert.equal(paragraphAppliesToGraph("За графами II–III застосовується норма.", "II"), true);
  assert.equal(paragraphAppliesToGraph("За графами II–III застосовується норма.", "III"), true);
  assert.equal(paragraphAppliesToGraph("За графами І–ІІІ застосовується норма.", "II"), true);
});

test("ordinary roman numerals are not treated as graph references", () => {
  assert.equal(paragraphAppliesToGraph("Хронічна серцева недостатність II стадії.", "II"), false);
});

test("guidance keeps only paragraphs that directly name the selected graph", () => {
  const paragraphs = [
    "Загальне пояснення без графи.",
    "За графою I застосовується перший критерій.",
    "За графами II, III застосовується другий критерій.",
  ];

  assert.deepEqual(graphGuidance(paragraphs, "I"), [paragraphs[1]]);
  assert.deepEqual(graphGuidance(paragraphs, "II"), [paragraphs[2]]);
  assert.deepEqual(graphGuidance(paragraphs, "III"), [paragraphs[2]]);
  assert.deepEqual(graphGuidance(paragraphs, "all"), []);
  assert.equal(graphContextLabel("all"), "Графу не вибрано");
  assert.equal(graphContextLabel("III"), "Графа III");
});

test("known graph distinctions in the protected corpus remain discoverable", () => {
  const article56ForI = graphGuidance(ARTICLE_56.paragraphs, "I");
  const article56ForII = graphGuidance(ARTICLE_56.paragraphs, "II");
  const article62ForI = graphGuidance(ARTICLE_62.paragraphs, "I");
  const article62ForIII = graphGuidance(ARTICLE_62.paragraphs, "III");

  assert.ok(article56ForI.some((text) => text.includes("графою I")));
  assert.ok(article56ForII.some((text) => text.includes("графами II-III")));
  assert.equal(article62ForI.length, 0);
  assert.ok(article62ForIII.length >= 3);
});

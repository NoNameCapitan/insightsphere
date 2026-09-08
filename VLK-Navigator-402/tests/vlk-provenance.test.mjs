import assert from "node:assert/strict";
import test from "node:test";

import { detectOfficialEdition } from "../lib/vlk-edition-monitor.ts";
import {
  EXPERT_REVIEWS,
  hasDoubleExpertVerification,
  NORMATIVE_PASSPORT,
  normReferenceId,
} from "../lib/vlk-provenance.ts";
import { EDITION } from "../lib/vlk-sample-data.ts";

test("the normative passport identifies the protected corpus", () => {
  assert.equal(NORMATIVE_PASSPORT.edition, EDITION);
  assert.equal(NORMATIVE_PASSPORT.coverage.articles, 87);
  assert.equal(NORMATIVE_PASSPORT.coverage.officialRows, 87);
  assert.equal(NORMATIVE_PASSPORT.coverage.exactIcdSets, 29);
  assert.equal(normReferenceId("39", "б").endsWith(":article-39:point-б"), true);
});

test("double verification cannot be claimed before both named reviews exist", () => {
  assert.equal(hasDoubleExpertVerification(), false);
  assert.equal(EXPERT_REVIEWS.every((review) => review.status === "pending"), true);
  assert.equal(
    hasDoubleExpertVerification([
      { role: "Лікар ВЛК", status: "verified", reviewer: "Лікар", reviewedAt: "2026-09-07" },
      {
        role: "Військовий медичний юрист",
        status: "verified",
        reviewer: "Юрист",
        reviewedAt: "2026-09-07",
      },
    ]),
    true,
  );
});

test("the edition monitor selects the newest official edition marker", () => {
  const html = `
    <a href="/laws/show/z1109-08/ed20250401">попередня редакція</a>
    <p>Редакція від 22.08.2025</p>
  `;
  assert.equal(detectOfficialEdition(html), "22.08.2025");
  assert.equal(detectOfficialEdition("немає дати"), undefined);
});

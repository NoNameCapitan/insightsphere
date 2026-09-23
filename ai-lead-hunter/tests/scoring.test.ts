import { test } from "node:test";
import assert from "node:assert/strict";
import { labelFor, scoreBusiness } from "../lib/scoring";
import { makeBusiness } from "./_fixtures";

test("labelFor uses the documented thresholds", () => {
  assert.equal(labelFor(85), "hot");
  assert.equal(labelFor(65), "warm");
  assert.equal(labelFor(45), "cold");
  assert.equal(labelFor(20), "bad_fit");
});

test("a no-website business flags missing_website with high severity", () => {
  const { score, signals } = scoreBusiness(
    makeBusiness({ website: undefined }),
    "website",
  );
  const sig = signals.find((s) => s.type === "missing_website");
  assert.ok(sig, "expected a missing_website signal");
  assert.equal(sig?.severity, "high");
  assert.ok(score.total >= 0 && score.total <= 100);
  assert.ok(["hot", "warm", "cold", "bad_fit"].includes(score.label));
});

test("scoring is deterministic for identical input", () => {
  const b = makeBusiness({ website: undefined, rating: 4.0, reviewCount: 60 });
  const a1 = scoreBusiness(b, "booking");
  const a2 = scoreBusiness(b, "booking");
  assert.equal(a1.score.total, a2.score.total);
  assert.equal(a1.score.fit, a2.score.fit);
  assert.equal(a1.score.pain, a2.score.pain);
});

test("a missing website produces more pain than a healthy booking site", () => {
  const noSite = scoreBusiness(makeBusiness({ website: undefined }), "booking");
  const goodSite = scoreBusiness(
    makeBusiness({
      website: "https://x.example.com",
      websiteAnalysis: {
        checked: true,
        url: "https://x.example.com",
        reachable: true,
        https: true,
        hasTitle: true,
        hasViewport: true,
        hasContactKeyword: true,
        hasBookingKeyword: true,
        hasSocialLinks: true,
        hasFormKeyword: true,
      },
    }),
    "booking",
  );
  assert.ok(noSite.score.pain > goodSite.score.pain);
});

test("opportunityReason is always present and non-empty", () => {
  const { score } = scoreBusiness(makeBusiness(), "website");
  assert.equal(typeof score.opportunityReason, "string");
  assert.ok(score.opportunityReason.length > 10);
});

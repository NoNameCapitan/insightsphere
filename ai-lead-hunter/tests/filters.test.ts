import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyFilters,
  leadPassesFilters,
  normalizeFilters,
} from "../lib/filters";
import { makeLead } from "./_fixtures";

test("noWebsite / hasWebsite are respected", () => {
  const noSite = makeLead({ website: undefined });
  const withSite = makeLead({ website: "https://x.example.com" });
  assert.equal(leadPassesFilters(noSite, { noWebsite: true }), true);
  assert.equal(leadPassesFilters(noSite, { hasWebsite: true }), false);
  assert.equal(leadPassesFilters(withSite, { hasWebsite: true }), true);
  assert.equal(leadPassesFilters(withSite, { noWebsite: true }), false);
});

test("hasPhone filter", () => {
  const noPhone = makeLead({ phone: undefined });
  assert.equal(leadPassesFilters(noPhone, { hasPhone: true }), false);
  assert.equal(leadPassesFilters(makeLead(), { hasPhone: true }), true);
});

test("rating + reviews thresholds", () => {
  const lead = makeLead({ rating: 3.8, reviewCount: 120 });
  assert.equal(leadPassesFilters(lead, { ratingBelow: 4.2 }), true);
  assert.equal(leadPassesFilters(lead, { ratingBelow: 3.0 }), false);
  assert.equal(leadPassesFilters(lead, { minReviews: 50 }), true);
  assert.equal(leadPassesFilters(lead, { minReviews: 200 }), false);
});

test("category filter matches the lead niche", () => {
  const beauty = makeLead({ niche: "beauty" });
  assert.equal(leadPassesFilters(beauty, { category: "beauty" }), true);
  assert.equal(leadPassesFilters(beauty, { category: "dental" }), false);
  assert.equal(leadPassesFilters(beauty, { category: "all" }), true);
});

test("normalizeFilters resolves the no/has website conflict", () => {
  const n = normalizeFilters({ noWebsite: true, hasWebsite: true });
  assert.equal(n.noWebsite, true);
  assert.equal(n.hasWebsite, false);
});

test("applyFilters narrows a list", () => {
  const leads = [
    makeLead({ website: undefined, name: "A" }),
    makeLead({ website: "https://b.example.com", name: "B" }),
  ];
  const out = applyFilters(leads, { noWebsite: true });
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "A");
});

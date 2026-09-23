import { test } from "node:test";
import assert from "node:assert/strict";
import { KYIV_CENTER, resolveSearchGeo } from "../lib/geo";
import { parseQuery } from "../lib/queryParser";
import { assembleResults } from "../lib/searchResults";
import { businessKey } from "../lib/leadIdentity";
import { searchSchema } from "../lib/validation";
import { validateUrlSafety } from "../lib/ssrf";
import { leadsToCsv } from "../lib/csv";
import { dedupeBusinesses } from "../lib/utils";
import { parseBackup, serializeBackup } from "../lib/backup";
import { nextActionForLead } from "../lib/campaignStages";
import { makeBusiness, makeLead } from "./_fixtures";
const req = {
  query: "",
  niche: "generic" as const,
  offerType: "website" as const,
  locationMode: "near_me" as const,
  lat: 50.45,
  lng: 30.52,
  radiusKm: 1,
  limit: 30,
  lang: "uk" as const,
};
test("strict radius returns zero rather than distant businesses", () => {
  const r = assembleResults(
    [makeBusiness({ lat: 49, lng: 24 })],
    req,
    resolveSearchGeo(req),
    "demo",
  );
  assert.equal(r.leads.length, 0);
  assert.equal(r.totalCandidates, 0);
});
test("medical center does not become Kyiv city center", () => {
  const g = resolveSearchGeo({
    locationMode: "city",
    city: "Львів",
    query: "медичний центр",
  });
  assert.equal(g.cityName, "Львів");
  assert.notDeepEqual(g.center, KYIV_CENTER);
});
test("cities containing ки are not Kyiv", () => {
  const g = resolveSearchGeo({ locationMode: "city", city: "Кропивницький" });
  assert.equal(g.cityName, "Кропивницький");
  assert.notDeepEqual(g.center, KYIV_CENTER);
  assert.equal(
    resolveSearchGeo({ locationMode: "city", city: "Невідомськ" }).center,
    null,
  );
});
test("city search without explicit radius covers the whole city", () => {
  const g = resolveSearchGeo({ locationMode: "city", city: "Київ", radiusKm: 0 });
  assert.equal(g.wholeCity, true);
  assert.equal(g.radiusKm, 20);
  const r = resolveSearchGeo({ locationMode: "city", city: "у Львові", radiusKm: 3 });
  assert.equal(r.radiusKm, 3);
  assert.equal(r.wholeCity, false);
});
test("explicit address wins and unknown address is not silently centered on Kyiv", () => {
  const g = resolveSearchGeo({
    locationMode: "address",
    city: "Київ",
    address: "вул. Невідома 4",
    query: "стоматології на Позняках",
  });
  assert.equal(g.center, null);
  assert.equal(g.approximate, true);
});
test("Kyiv district coordinates are used for explicit Kyiv addresses", () => {
  const g = resolveSearchGeo({
    locationMode: "address",
    city: "Київ",
    address: "Позняки",
  });
  assert.equal(g.source, "district");
});
test("a street outside Kyiv cannot silently become a Kyiv district", () => {
  assert.equal(
    resolveSearchGeo({
      locationMode: "address",
      city: "Львів",
      address: "Подільська",
    }).center,
    null,
  );
});
test("prices do not become a lead limit", () => {
  assert.equal(parseQuery("Я продаю сайти за $300").limit, 30);
  assert.equal(parseQuery("Знайди 50 салонів для сайтів за 200 грн").limit, 50);
});
test("English repair and nail are not implicitly AI offers", () => {
  assert.equal(parseQuery("repair service").offer, "website");
  assert.equal(parseQuery("nail salons").offer, "booking");
});
test("service center is not classified as СТО from substring", () => {
  assert.equal(parseQuery("сервісний центр").niche, "repair");
});
test("declined Ukrainian city names resolve", () => {
  assert.equal(parseQuery("кафе у Львові").city, "Львів");
  assert.equal(parseQuery("салони в Одесі").city, "Одеса");
});
test("request rejects arrays, null, strings and unbounded values", () => {
  for (const input of [
    null,
    [],
    { niche: "oops" },
    { limit: 999 },
    { lat: 91 },
    { radiusKm: "5" },
    { excludeKeys: 123 },
    { filters: { hasPhone: "true" } },
  ])
    assert.equal(searchSchema.safeParse(input).success, false);
});
test("near-me requires both coordinates", () => {
  assert.equal(
    searchSchema.safeParse({ locationMode: "near_me" }).success,
    false,
  );
  assert.equal(searchSchema.safeParse(req).success, true);
});
test("SSRF blocks mapped, expanded, reserved and credentialed URLs", () => {
  for (const u of [
    "http://[::ffff:127.0.0.1]",
    "http://[::ffff:7f00:1]",
    "http://[0:0:0:0:0:0:0:1]",
    "http://[ff02::1]",
    "http://192.0.0.1",
    "http://224.0.0.1",
    "http://example.com:8080",
    "http://user:pass@example.com",
    "javascript:alert(1)",
  ])
    assert.equal(validateUrlSafety(u).ok, false, u);
});
test("CSV neutralizes formula payloads and preserves do-not-contact", () => {
  const l = {
    ...makeLead(),
    name: '=HYPERLINK("x")',
    notes: "\n@SUM(1)",
    verification: { doNotContact: true },
  };
  const csv = leadsToCsv([l]);
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes("'\n@SUM"));
  assert.ok(csv.includes("doNotContact"));
  assert.ok(csv.includes("true"));
});
test("separate business branches with same domain and phone survive deduplication", () => {
  const one = makeBusiness({
    sourcePlaceId: "A",
    website: "https://example.com",
  });
  const two = { ...one, sourcePlaceId: "B", address: "Інша адреса" };
  assert.equal(dedupeBusinesses([one, two, one]).length, 2);
});
test("place IDs remain case-sensitive", () => {
  assert.notEqual(
    businessKey(makeBusiness({ sourcePlaceId: "ABC" })),
    businessKey(makeBusiness({ sourcePlaceId: "abc" })),
  );
});
test("backup roundtrip preserves notes, stages, follow-up and no-contact flag", () => {
  const campaigns = [
    {
      id: "c1",
      name: "Test",
      createdAt: new Date().toISOString(),
      leads: [
        {
          ...makeLead(),
          notes: "Відповісти завтра",
          status: "dialog" as const,
          followUpAt: "2026-10-01",
          verification: { doNotContact: true },
        },
      ],
    },
  ];
  const parsed = parseBackup(serializeBackup(campaigns));
  assert.deepEqual(parsed, JSON.parse(JSON.stringify(campaigns)));
});
test("malformed backup and unsafe links are rejected before changing data", () => {
  const base = {
    id: "c",
    name: "Test",
    createdAt: new Date().toISOString(),
    leads: [makeLead()],
  };
  for (const s of [
    "{}",
    "null",
    "oops",
    serializeBackup([
      {
        ...base,
        leads: [{ ...base.leads[0], website: "javascript:alert(1)" }],
      },
    ]),
    serializeBackup([base, base]),
  ])
    assert.throws(() => parseBackup(s));
});
test("do-not-contact takes precedence over suggested outreach", () => {
  assert.equal(
    nextActionForLead({
      ...makeLead(),
      status: "verified",
      verification: { doNotContact: true },
    }).label,
    "Не контактувати",
  );
});

test("unknown business status is not presented as confirmed activity", () => {
  const lead = makeLead({ businessStatus: undefined });
  assert.ok(!lead.signals.some((s) => s.type === "active_business"));
  assert.ok(!lead.score.opportunityReason.includes("бізнес активний"));
});
test("outreach does not promise invented losses or payback", () => {
  const lead = makeLead();
  assert.ok(!lead.outreach.emailMessage.includes("окупається"));
  assert.ok(!lead.outreach.emailMessage.includes("Зазвичай це означає втрату"));
});

// Rounding for display must not admit a point just outside the chosen circle.
test("radius boundary uses the full distance precision", () => {
  const response = assembleResults(
    [makeBusiness({ lat: req.lat + 1.04 / 111.1949, lng: req.lng })],
    req,
    resolveSearchGeo(req),
    "demo",
  );
  assert.equal(response.leads.length, 0);
});

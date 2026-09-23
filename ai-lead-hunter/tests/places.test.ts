import { test } from "node:test";
import assert from "node:assert/strict";
import { detectNicheFromTypes, geocodeWithPlaces, searchGooglePlaces } from "../lib/places";

test("generic 'store' type never turns a bakery or pharmacy into repair", () => {
  assert.equal(detectNicheFromTypes(["bakery", "store", "food"]), "generic");
  assert.equal(detectNicheFromTypes(["pharmacy", "health", "store"]), "generic");
  assert.equal(detectNicheFromTypes(["cell_phone_store", "store"]), "repair");
});

test("requested niche wins when the place matches it", () => {
  assert.equal(detectNicheFromTypes(["cafe", "restaurant"]), "cafe");
  assert.equal(detectNicheFromTypes(["cafe", "restaurant"], "restaurant"), "restaurant");
});

test("permanently closed places are dropped from live results", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      places: [
        { id: "a", displayName: { text: "Open" }, businessStatus: "OPERATIONAL", types: ["dentist"] },
        { id: "b", displayName: { text: "Gone" }, businessStatus: "CLOSED_PERMANENTLY", types: ["dentist"] },
      ],
    }),
  );
  const out = await searchGooglePlaces(
    {
      query: "",
      niche: "dental",
      offerType: "booking",
      locationMode: "city",
      city: "Київ",
      radiusKm: 20,
      limit: 1,
      lang: "uk",
    },
    "test-key",
  );
  assert.deepEqual(out.map((b) => b.name), ["Open"]);
});

test("geocoding returns a point or null, never throws", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ places: [{ location: { latitude: 49.84, longitude: 24.03 }, formattedAddress: "Львів" }] }),
  );
  assert.deepEqual(await geocodeWithPlaces("вул. Городоцька 1, Львів", "k"), {
    lat: 49.84,
    lng: 24.03,
    label: "Львів",
  });
  t.mock.method(globalThis, "fetch", async () => new Response("no", { status: 403 }));
  assert.equal(await geocodeWithPlaces("x", "k"), null);
});

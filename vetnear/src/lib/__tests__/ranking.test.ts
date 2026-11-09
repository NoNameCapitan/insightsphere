import { describe, it, expect } from "vitest";
import { rankPlacesForPet, getRecommendedPlaces } from "@/lib/geo/ranking";
import { withDistances } from "@/lib/distance";
import { makePlace, makePet, makeFilters, KYIV_CENTER, NOON } from "./fixtures";

// Points at increasing distance from Kyiv center (approx).
const AT_500M = { latitude: 50.4546, longitude: 30.5234 };
const AT_2KM = { latitude: 50.4681, longitude: 30.5234 };
const AT_8KM = { latitude: 50.5016, longitude: 30.4981 };

describe("rankPlacesForPet", () => {
  it("sorts by distance first", () => {
    const near = makePlace({ ...AT_500M, name: "Near" });
    const far = makePlace({ ...AT_2KM, name: "Far" });
    const ranked = rankPlacesForPet(
      withDistances([far, near], KYIV_CENTER),
      { filters: makeFilters(), now: NOON },
    );
    expect(ranked.map((p) => p.name)).toEqual(["Near", "Far"]);
  });

  it("boosts places matching the active pet's animal type", () => {
    // Same coordinates → distance is a tie; pet match decides.
    const dogsOnly = makePlace({ animalTypes: ["dog"], name: "DogsOnly" });
    const catsToo = makePlace({ animalTypes: ["cat", "dog"], name: "CatsToo" });
    const ranked = rankPlacesForPet(
      withDistances([dogsOnly, catsToo], KYIV_CENTER),
      { pet: makePet({ animalType: "cat" }), filters: makeFilters(), now: NOON },
    );
    expect(ranked[0].name).toBe("CatsToo");
  });

  it("prefers open-now on distance ties", () => {
    const closed = makePlace({ workingHours: [], name: "Closed" });
    const open = makePlace({ name: "Open" });
    const ranked = rankPlacesForPet(
      withDistances([closed, open], KYIV_CENTER),
      { filters: makeFilters(), now: NOON },
    );
    expect(ranked[0].name).toBe("Open");
  });

  it("sort=rating overrides the score", () => {
    const nearLow = makePlace({ ...AT_500M, rating: 3.0, name: "NearLow" });
    const farHigh = makePlace({ ...AT_2KM, rating: 5.0, name: "FarHigh" });
    const ranked = rankPlacesForPet(
      withDistances([nearLow, farHigh], KYIV_CENTER),
      { filters: makeFilters({ sort: "rating" }), now: NOON },
    );
    expect(ranked[0].name).toBe("FarHigh");
  });
});

describe("getRecommendedPlaces — discovery pipeline", () => {
  it("only approved places with coordinates are discoverable", () => {
    const ok = makePlace({ name: "OK" });
    const pending = makePlace({ status: "pending" as never, name: "Pending" });
    const rejected = makePlace({ verificationStatus: "rejected", name: "Rejected" });
    const noCoords = makePlace({ latitude: NaN, name: "NoCoords" });
    const res = getRecommendedPlaces([ok, pending, rejected, noCoords], KYIV_CENTER, {
      filters: makeFilters(),
      now: NOON,
    });
    expect(res.places.map((p) => p.name)).toEqual(["OK"]);
  });

  it("applies category / animal / district filters", () => {
    const clinic = makePlace({ category: "veterinary_clinic", name: "Clinic" });
    const store = makePlace({ category: "pet_store", name: "Store" });
    const res = getRecommendedPlaces([clinic, store], KYIV_CENTER, {
      filters: makeFilters({ category: "pet_store" }),
      now: NOON,
    });
    expect(res.places.map((p) => p.name)).toEqual(["Store"]);
  });

  it("auto-expands the radius when the requested one is empty", () => {
    const far = makePlace({ ...AT_8KM, name: "Far" }); // ~8 km away
    const res = getRecommendedPlaces([far], KYIV_CENTER, {
      filters: makeFilters({ radius: 1000 }),
      now: NOON,
    });
    expect(res.places).toHaveLength(1);
    expect(res.expandedFrom).toBe(1000);
    expect(res.appliedRadius).toBe(10000);
  });

  it("does not expand when results exist in the requested radius", () => {
    const near = makePlace({ ...AT_500M });
    const res = getRecommendedPlaces([near], KYIV_CENTER, {
      filters: makeFilters({ radius: 1000 }),
      now: NOON,
    });
    expect(res.expandedFrom).toBeNull();
    expect(res.appliedRadius).toBe(1000);
  });

  it("emergency filter hides unverified emergency listings (no fake 24/7)", () => {
    const demoEmergency = makePlace({
      name: "DemoEmergency",
      isOpen24_7: true,
      emergencyAvailable: true,
      verified: false,
      dataSource: "demo",
      verificationStatus: "demo",
    });
    const verifiedEmergency = makePlace({
      name: "VerifiedEmergency",
      isOpen24_7: true,
      emergencyAvailable: true,
    });
    const res = getRecommendedPlaces([demoEmergency, verifiedEmergency], KYIV_CENTER, {
      filters: makeFilters({ emergency: true }),
      now: NOON,
    });
    expect(res.places.map((p) => p.name)).toEqual(["VerifiedEmergency"]);
  });

  it("works without an origin (geolocation denied): no radius cut", () => {
    const far = makePlace({ ...AT_8KM });
    const res = getRecommendedPlaces([far], null, {
      filters: makeFilters({ radius: 1000 }),
      now: NOON,
    });
    expect(res.places).toHaveLength(1);
  });
});

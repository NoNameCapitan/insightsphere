import { describe, expect, it } from "vitest";
import { localityOf, regionOf, shouldUseKyivSafety, withinCoverageBounds } from "@/config/coverage";
import { filtersFromSearchParams } from "@/lib/geo/discoveryFilters";
import { getRecommendedPlaces } from "@/lib/geo/ranking";
import { placeLocationLabel } from "@/lib/labels";
import { googleMapsRoute } from "@/lib/maps";
import { placeJsonLd } from "@/lib/seo";
import { sanitizeSubmissionInput } from "@/lib/server/submissionValidation";
import { isPlaceLike, submissionToPlace } from "@/lib/places/publish";
import { makePlace, makeFilters, KYIV_CENTER } from "./fixtures";
import { normalizeCandidate, withinImportCoverage } from "../../../scripts/import-google-places.mjs";

const oblast = () => makePlace({ region: "kyiv_oblast", locality: "Біла Церква", countryCode: "UA", district: undefined, latitude: 49.7968, longitude: 30.1157 });
const submission = {
  name: "Клініка тест", category: "veterinary_clinic", region: "kyiv_oblast", locality: "Біла Церква",
  address: "вул. Тестова, 1", phone: "+380441234567", latitude: 49.7968, longitude: 30.1157,
  representativeConfirmed: true, consentModeration: true,
};

describe("Kyiv city and oblast geography contract", () => {
  it("does not auto-open Kyiv safety maps for Bila Tserkva or an unknown position", () => {
    expect(shouldUseKyivSafety("all", oblast())).toBe(false);
    expect(shouldUseKyivSafety("all", null)).toBe(false);
    expect(shouldUseKyivSafety("kyiv_oblast", KYIV_CENTER)).toBe(false);
    expect(shouldUseKyivSafety("all", KYIV_CENTER)).toBe(true);
    expect(shouldUseKyivSafety("kyiv_city", null)).toBe(true);
  });
  it("keeps old records and old district links in Kyiv city", () => {
    expect(regionOf(makePlace())).toBe("kyiv_city");
    expect(localityOf(makePlace())).toBe("Київ");
    const filters = filtersFromSearchParams(new URLSearchParams("district=pozniaky&category=veterinary_clinic"));
    expect(filters.region).toBe("kyiv_city");
    expect(filters.district).toBe("darnytskyi");
    expect(filters.category).toBe("veterinary_clinic");
  });

  it("accepts oblast links without imposing a Kyiv district", () => {
    const filters = filtersFromSearchParams(new URLSearchParams("region=kyiv_oblast&locality=Біла+Церква&district=pecherskyi&radius=100000"));
    expect(filters.region).toBe("kyiv_oblast");
    expect(filters.locality).toBe("Біла Церква");
    expect(filters.district).toBe("all");
    expect(filters.radius).toBe(100000);
  });

  it("separates city, oblast and all available catalogues without fabricating a position", () => {
    const kyiv = makePlace({ name: "Київ" });
    const region = oblast();
    const places = [kyiv, region];
    expect(getRecommendedPlaces(places, null, { filters: makeFilters({ region: "kyiv_city" }) }).places.map(p => p.id)).toEqual([kyiv.id]);
    const result = getRecommendedPlaces(places, null, { filters: makeFilters({ region: "kyiv_oblast" }) });
    expect(result.places.map(p => p.id)).toEqual([region.id]);
    expect(result.places[0].distanceMeters).toBeNull();
    expect(getRecommendedPlaces(places, null, { filters: makeFilters({ region: "all" }) }).places).toHaveLength(2);
  });

  it("combines locality, animal and category rather than dropping useful filters", () => {
    const one = oblast();
    const other = makePlace({ region: "kyiv_oblast", locality: "Буча", district: undefined, category: "pet_store" });
    const result = getRecommendedPlaces([one, other], null, { filters: makeFilters({ region: "kyiv_oblast", locality: "  біла   церква ", category: "veterinary_clinic", animal: "cat" }) });
    expect(result.places.map(p => p.id)).toEqual([one.id]);
  });

  it("offers a real distance beyond 10 km and reports expanded radius", () => {
    const p = oblast();
    const result = getRecommendedPlaces([p], KYIV_CENTER, { filters: makeFilters({ region: "kyiv_oblast", radius: 10000 }) });
    expect(result.expandedFrom).toBe(10000);
    expect(result.appliedRadius).toBe(100000);
    expect(result.places[0].distanceMeters).toBeGreaterThan(70000);
    expect(result.places[0].distanceMeters).toBeLessThan(100000);
  });

  it("does not make a city district match an oblast record", () => {
    const p = oblast();
    expect(getRecommendedPlaces([p], null, { filters: makeFilters({ district: "pecherskyi" }) }).places).toEqual([]);
  });

  it("labels and routes an oblast address using its real settlement", () => {
    const p = { ...oblast(), routeByAddress: true };
    expect(placeLocationLabel(p)).toBe("Біла Церква · Київська область");
    const destination = new URL(googleMapsRoute(p)).searchParams.get("destination");
    expect(destination).toBe(`Київська область, Біла Церква, ${p.address}`);
    expect(destination).not.toMatch(/^Київ,/);
    expect(placeJsonLd(p).address.addressLocality).toBe("Біла Церква");
    expect(placeJsonLd(makePlace()).address.addressLocality).toBe("Київ");
  });

  it("accepts regional coordinates, and rejects wrong regions/non-finite coordinates", () => {
    expect(withinCoverageBounds("kyiv_oblast", oblast())).toBe(true);
    expect(withinCoverageBounds("kyiv_city", oblast())).toBe(false);
    expect(withinCoverageBounds("kyiv_oblast", { latitude: 49.84, longitude: 24.03 })).toBe(false);
    expect(withinCoverageBounds("kyiv_oblast", { latitude: NaN, longitude: 30 })).toBe(false);
    expect(withinCoverageBounds("kyiv_oblast", { latitude: 50.891532, longitude: 30.219491 })).toBe(true);
  });
});

describe("regional partner publishing", () => {
  it("accepts a town or village with no Kyiv district and preserves its geography", () => {
    const valid = sanitizeSubmissionInput(submission);
    expect(valid.ok).toBe(true);
    expect(valid.value?.district).toBeUndefined();
    expect(valid.value?.verificationStatus).toBe("needs_review");
    const result = submissionToPlace({ ...valid.value!, id: "town-1", status: "approved", createdAt: "2026-11-17", updatedAt: "2026-11-17" }, { actorId: "mod" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.place.locality).toBe("Біла Церква");
    expect(result.place.region).toBe("kyiv_oblast");
    expect(result.place.district).toBeUndefined();
    expect(result.place.latitude).toBe(49.7968);
    expect(result.place.description).not.toContain("у Києві");
    expect(result.place.emergencyAvailable).toBe(false);
    expect(result.place.isOpen24_7).toBe(false);
    expect(isPlaceLike(result.place)).toBe(true);
  });

  it.each([{ locality: "" }, { district: "pecherskyi" }, { region: "world" }, { countryCode: "US" }])("rejects contradictory or incomplete geographic input: %j", (patch) => {
    expect(sanitizeSubmissionInput({ ...submission, ...patch }).ok).toBe(false);
  });

  it("keeps out-of-area/missing coordinates out of discovery instead of substituting a centre", () => {
    const valid = sanitizeSubmissionInput({ ...submission, latitude: 49.84, longitude: 24.03 });
    expect(valid.ok).toBe(true);
    expect(valid.value?.verificationStatus).toBe("needs_geocoding");
    expect(valid.value?.latitude).toBeUndefined();
  });

  it("allows an unknown Kyiv district and normalizes old district slugs", () => {
    expect(sanitizeSubmissionInput({ ...submission, region: "kyiv_city", latitude: 50.45, longitude: 30.52, district: undefined }).ok).toBe(true);
    expect(sanitizeSubmissionInput({ ...submission, region: "kyiv_city", district: "obolon" }).value?.district).toBe("obolonskyi");
  });

  it("rejects a malformed oblast record read back from the database", () => {
    expect(isPlaceLike({ ...oblast(), locality: "" })).toBe(false);
    expect(isPlaceLike({ ...oblast(), district: "podilskyi" })).toBe(false);
  });
});

describe("Google review importer geography", () => {
  it("supports oblast bounds and never assigns a nearby Kyiv district to a town", () => {
    const point = { latitude: 49.7968, longitude: 30.1157 };
    expect(withinImportCoverage(point, "kyiv_oblast")).toBe(true);
    expect(withinImportCoverage(point, "kyiv_city")).toBe(false);
    const candidate = normalizeCandidate({ id: "provider", displayName: { text: "Clinic" }, formattedAddress: "Біла Церква, вул. Тестова, 1", location: point }, { animals: ["cat"] }, "veterinary_clinic", { region: "kyiv_oblast", locality: "Біла Церква", query: "ветклініка" }, true);
    expect(candidate.region).toBe("kyiv_oblast");
    expect(candidate.district).toBeNull();
    expect(candidate.latitude).toBe(point.latitude);
    expect(candidate.verified).toBe(false);
    expect(candidate.verificationStatus).toBe("needs_review");
  });

  it("does not turn missing/invalid provider coordinates into the search-bias point", () => {
    const candidate = normalizeCandidate({ id: "bad", location: { latitude: 500, longitude: 30 } }, { animals: [] }, "veterinary_clinic", { region: "kyiv_oblast", locality: "Буча", query: "clinic" }, true);
    expect(candidate.latitude).toBeNull();
    expect(candidate.longitude).toBeNull();
    expect(candidate.district).toBeNull();
    expect(candidate.address).toBe("");
  });
});

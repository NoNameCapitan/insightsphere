import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasRecordedPhoneConfirmation } from "@/lib/data/phoneConfirmation";
import { verificationLabel } from "@/lib/data/provenance";
import {
  hasPhoneConfirmedEmergency,
  isEmergencySearchSafe,
  isPhoneConfirmedEmergency,
  isPublicEmergencyVisible,
  SAFE_EMERGENCY_CTA_HREF,
} from "@/lib/data/verification";
import { getRecommendedPlaces } from "@/lib/geo/ranking";
import { computeBadges } from "@/lib/trust";
import { placeJsonLd } from "@/lib/seo";
import { KYIV_CENTER, makeFilters, makePlace, NOON } from "./fixtures";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOON); });
afterEach(() => vi.useRealTimers());

const recordedCall = {
  phoneConfirmedAt: "2026-06-30T10:00:00.000Z",
  phoneConfirmedBy: "moderator_1",
};

describe("recorded phone confirmation", () => {
  it.each([
    { phoneConfirmedAt: undefined, phoneConfirmedBy: "moderator_1" },
    { phoneConfirmedAt: "2026-02-01", phoneConfirmedBy: null },
    { phoneConfirmedAt: "2026-02-01", phoneConfirmedBy: " \t " },
    { phoneConfirmedAt: "not-a-date", phoneConfirmedBy: "moderator_1" },
    { phoneConfirmedAt: "2026-02-31T10:00:00.000Z", phoneConfirmedBy: "moderator_1" },
    { phoneConfirmedAt: "0", phoneConfirmedBy: "moderator_1" },
  ])("rejects missing or malformed evidence: %j", (record) => {
    expect(hasRecordedPhoneConfirmation(record)).toBe(false);
  });

  it("accepts recorded ISO instants and valid legacy dates without inventing an expiry policy", () => {
    expect(hasRecordedPhoneConfirmation(recordedCall)).toBe(true);
    expect(hasRecordedPhoneConfirmation({ ...recordedCall, phoneConfirmedAt: "2025-02-01" })).toBe(true);
  });
});

describe("public emergency trust", () => {
  it("never treats public-source verification or a descriptive verifiedBy as a phone call", () => {
    const place = makePlace({ emergencyAvailable: true, verifiedBy: "public listings, phone not checked" });
    expect(isEmergencySearchSafe(place)).toBe(false);
    expect(isPhoneConfirmedEmergency(place)).toBe(false);
    expect(isPublicEmergencyVisible(place)).toBe(false);
    expect(hasPhoneConfirmedEmergency([place])).toBe(false);
    expect(verificationLabel(place)).toBe("Дані звірено з джерелом");
    expect(computeBadges(place, NOON)).not.toContain("emergency");
  });

  it("requires an approved, non-demo, verified record as well as the call", () => {
    const place = makePlace({ ...recordedCall, emergencyAvailable: true });
    expect(isPhoneConfirmedEmergency(place)).toBe(true);
    expect(verificationLabel(place)).toBe("Контакт підтверджено дзвінком");
    expect(computeBadges(place, NOON)).toContain("emergency");
    for (const override of [
      { status: "suspended" as const },
      { verificationStatus: "rejected" as const },
      { verificationStatus: "needs_review" as const },
      { dataSource: "demo" as const },
      { phone: "   " },
    ]) {
      expect(isPhoneConfirmedEmergency({ ...place, ...override })).toBe(false);
      expect(isEmergencySearchSafe({ ...place, ...override })).toBe(false);
    }
  });

  it("keeps ordinary clinics eligible for the safe fallback without an emergency claim", () => {
    const place = makePlace();
    expect(isEmergencySearchSafe(place)).toBe(true);
    expect(isPhoneConfirmedEmergency(place)).toBe(false);
    expect(getRecommendedPlaces([place], KYIV_CENTER, { filters: makeFilters({ category: "veterinary_clinic" }), now: NOON }).places).toHaveLength(1);
  });

  it("preserves urgent intent in the safe fallback link without enabling the emergency-only filter", () => {
    const params = new URL(SAFE_EMERGENCY_CTA_HREF, "https://vetnear.test").searchParams;
    expect(params.get("urgent")).toBe("1");
    expect(params.get("category")).toBe("veterinary_clinic");
    expect(params.get("emergency")).toBeNull();
  });

  it("disables promotion in an urgent ordinary-clinic fallback while retaining both clinics", () => {
    const organic = makePlace({ name: "Organic", latitude: 50.4546 });
    const promoted = makePlace({ name: "Promoted", latitude: 50.4555,
      tier: "promoted", promotedUntil: "2027-01-01T00:00:00.000Z" });
    const filters = makeFilters({ category: "veterinary_clinic" });
    const normal = getRecommendedPlaces([organic, promoted], KYIV_CENTER, { filters, now: NOON });
    const urgent = getRecommendedPlaces([organic, promoted], KYIV_CENTER, {
      filters: { ...filters, urgentIntent: true }, now: NOON,
    });
    expect(normal.places.map((place) => place.name)).toEqual(["Promoted", "Organic"]);
    expect(urgent.places.map((place) => place.name)).toEqual(["Organic", "Promoted"]);
    expect(urgent.places.every((place) => !place.emergencyAvailable)).toBe(true);
  });

  it("does not turn 24/7 opening or a pet store into emergency veterinary care", () => {
    const place = makePlace({ ...recordedCall, isOpen24_7: true, emergencyAvailable: false });
    const store = makePlace({ ...recordedCall, category: "pet_store", isOpen24_7: true, emergencyAvailable: true });
    expect(isPhoneConfirmedEmergency(place)).toBe(false);
    expect(isPhoneConfirmedEmergency(store)).toBe(false);
    expect(computeBadges(place, NOON)).not.toContain("emergency");
    expect(getRecommendedPlaces([place, store], KYIV_CENTER, { filters: makeFilters({ emergency: true }), now: NOON }).places).toHaveLength(0);
  });

  it("applies the same safety gate to the emergency category even without the emergency flag", () => {
    const unconfirmed = makePlace({ category: "emergency_vet", emergencyAvailable: true });
    const confirmed = makePlace({ ...recordedCall, category: "emergency_vet", emergencyAvailable: true });
    const result = getRecommendedPlaces([unconfirmed, confirmed], KYIV_CENTER, {
      filters: makeFilters({ category: "emergency_vet", emergency: false }), now: NOON,
    });
    expect(result.places.map((place) => place.id)).toEqual([confirmed.id]);
  });
});

describe("structured data honesty", () => {
  it("does not advertise unconfirmed 24/7 hours to search engines", () => {
    const place = makePlace({ isOpen24_7: true });
    expect(placeJsonLd(place).openingHours).toBeUndefined();
    expect(placeJsonLd({ ...place, ...recordedCall }).openingHours).toBe("Mo-Su 00:00-23:59");
  });

  it("does not invent a review count from a rating score", () => {
    expect(placeJsonLd(makePlace({ rating: 4.8 }))).not.toHaveProperty("aggregateRating");
  });
});

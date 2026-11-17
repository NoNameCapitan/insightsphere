import { describe, expect, it } from "vitest";
import { hasRecentPhoneConfirmation, hasRecordedPhoneConfirmation, phoneConfirmationFreshness } from "@/lib/data/phoneConfirmation";
import { isPhoneConfirmedEmergency, isPublicEmergencyVisible } from "@/lib/data/verification";
import { getRecommendedPlaces } from "@/lib/geo/ranking";
import { computeBadges } from "@/lib/trust";
import { placeJsonLd } from "@/lib/seo";
import { verificationLabel } from "@/lib/data/provenance";
import { makeFilters, makePlace } from "./fixtures";
const now = new Date("2026-11-17T12:00:00Z");
const evidence = { phoneConfirmedAt: "2026-10-18T12:00:00Z", phoneConfirmedBy: "moderator" };
describe("public phone evidence freshness", () => {
  it("keeps the recorded audit evidence but removes the public claim after 30 days", () => {
    expect(hasRecordedPhoneConfirmation(evidence)).toBe(true);
    expect(hasRecentPhoneConfirmation(evidence, now)).toBe(true);
    const later = new Date(now.getTime() + 1);
    expect(phoneConfirmationFreshness(evidence, later)).toBe("stale");
    expect(hasRecentPhoneConfirmation(evidence, later)).toBe(false);
    expect(hasRecordedPhoneConfirmation(evidence)).toBe(true);
  });
  it("rejects future timestamps, invalid clocks and incomplete actors", () => {
    expect(phoneConfirmationFreshness({ ...evidence, phoneConfirmedAt: "2026-11-18T12:00:00Z" }, now)).toBe("future");
    expect(hasRecentPhoneConfirmation(evidence, new Date("invalid"))).toBe(false);
    expect(hasRecentPhoneConfirmation({ ...evidence, phoneConfirmedBy: " " }, now)).toBe(false);
  });
  it("expires emergency discovery, badge and SEO together without hiding the ordinary fallback", () => {
    const place = makePlace({ ...evidence, emergencyAvailable: true, isOpen24_7: true });
    const later = new Date(now.getTime() + 1);
    expect(isPhoneConfirmedEmergency(place, now)).toBe(true);
    expect(isPhoneConfirmedEmergency(place, later)).toBe(false);
    expect(isPublicEmergencyVisible(place, later)).toBe(false);
    expect(computeBadges(place, later)).not.toContain("emergency");
    expect(placeJsonLd(place, later).openingHours).toBeUndefined();
    expect(verificationLabel(place, later)).toBe("Дзвінок потребує оновлення");
    expect(getRecommendedPlaces([place], null, { now: later, filters: makeFilters({ emergency: true }) }).places).toHaveLength(0);
    expect(getRecommendedPlaces([place], null, { now: later, filters: makeFilters({ category: "veterinary_clinic", urgentIntent: true }) }).places).toHaveLength(1);
  });
  it("a recent call about a clinic is never a claim of current capacity", () => {
    const place = makePlace({ ...evidence, emergencyAvailable: false });
    expect(verificationLabel(place, now)).toBe("Контакт підтверджено дзвінком");
    expect(isPhoneConfirmedEmergency(place, now)).toBe(false);
  });
});

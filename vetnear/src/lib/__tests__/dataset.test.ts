import { describe, it, expect } from "vitest";
import { PLACES } from "@/lib/data/places";
import { isSearchablePublicPlace } from "@/lib/data/provenance";
import { isPublicEmergencyVisible } from "@/lib/data/verification";

// Kyiv bounding box (approximate)
const KYIV = { latMin: 50.2, latMax: 50.65, lngMin: 30.2, lngMax: 30.85 };

describe("dataset invariants — data honesty rules", () => {
  it("has unique ids and slugs", () => {
    const ids = new Set(PLACES.map((p) => p.id));
    const slugs = new Set(PLACES.map((p) => p.slug));
    expect(ids.size).toBe(PLACES.length);
    expect(slugs.size).toBe(PLACES.length);
  });

  it("every place has a phone and address", () => {
    for (const p of PLACES) {
      expect(p.phone, p.id).toBeTruthy();
      expect(p.address, p.id).toBeTruthy();
    }
  });

  it("all coordinates are inside the Kyiv bounding box", () => {
    for (const p of PLACES) {
      expect(p.latitude, p.id).toBeGreaterThan(KYIV.latMin);
      expect(p.latitude, p.id).toBeLessThan(KYIV.latMax);
      expect(p.longitude, p.id).toBeGreaterThan(KYIV.lngMin);
      expect(p.longitude, p.id).toBeLessThan(KYIV.lngMax);
    }
  });

  it("does not publish any provider as phone-confirmed emergency care", () => {
    for (const p of PLACES) {
      expect(p.emergencyAvailable, p.id).toBe(false);
      expect(p.category, p.id).not.toBe("emergency_vet");
    }
  });

  it("keeps source-checked 24/7 claims out of emergency-first results", () => {
    const sourceChecked24h = PLACES.filter((p) => p.isOpen24_7 && p.verificationStatus === "source_checked");
    expect(sourceChecked24h.length).toBeGreaterThan(0);
    for (const place of sourceChecked24h) {
      expect(place.dataWarning, place.id).toBeTruthy();
      expect(isPublicEmergencyVisible(place), place.id).toBe(false);
    }
  });

  it("web-researched candidates are honestly labeled needs_review with a source", () => {
    const candidates = PLACES.filter((p) => p.verificationStatus === "needs_review");
    expect(candidates.length).toBeGreaterThanOrEqual(30);
    for (const p of candidates) {
      expect(p.verified, p.id).toBe(false);
      expect(p.dataSource, p.id).toBe("manual_unverified");
      expect(p.sourceUrl, p.id).toBeTruthy();
      expect(p.dataWarning, p.id).toBeTruthy();
      expect(p.lastVerifiedAt, p.id).toBeNull();
      expect(p.verifiedBy, p.id).toBeNull();
    }
  });

  it("needs_review places remain discoverable (shown with the review badge)", () => {
    const candidates = PLACES.filter((p) => p.verificationStatus === "needs_review");
    for (const p of candidates) {
      expect(isSearchablePublicPlace(p), p.id).toBe(true);
    }
  });

  it("verified places keep the honest method label (public sources, not phone)", () => {
    const verified = PLACES.filter((p) => p.verificationStatus === "verified");
    expect(verified.length).toBe(32);
    for (const p of verified) {
      expect(p.verifiedBy, p.id).toContain("public");
    }
  });

  it("replaces the stale Virmenska record with all three official municipal clinics", () => {
    expect(PLACES.some((p) => p.name === "Dr. Shedi")).toBe(false);
    const municipal = PLACES.filter((p) => p.alertPolicy === "municipal_severity_based");
    expect(municipal).toHaveLength(3);
    expect(municipal.map((p) => p.address)).toEqual(expect.arrayContaining([
      "вул. Вірменська, 29",
      "вул. Ярославська, 13-А",
      "вул. Героїв Енергетиків, 5-А",
    ]));
    expect(municipal.every((p) => p.lastVerifiedAt === "2026-09-17")).toBe(true);
    expect(municipal.every((p) => p.routeByAddress)).toBe(true);
  });

  it("keeps A-Vet source-checked and call-first without phone-confirmed emergency status", () => {
    const avet = PLACES.find((p) => p.name === "А-Вет (Оболонь)");
    expect(avet?.verificationStatus).toBe("source_checked");
    expect(avet?.verified).toBe(false);
    expect(avet?.isOpen24_7).toBe(true);
    expect(avet?.emergencyAvailable).toBe(false);
    expect(avet?.emergencyIntakeMode).toBe("call_first");
    expect(avet?.nightDoctorOnSite).toBe(true);
    expect(avet?.autonomousPower).toBe(true);
    expect(avet?.oxygenBoxCount).toBe(6);
    expect(isPublicEmergencyVisible(avet!)).toBe(false);
  });

  it("publishes MAVET from its official site without claiming 24/7 intake", () => {
    const mavet = PLACES.find((p) => p.name === "MAVET Clinic & Groom");
    expect(mavet).toBeDefined();
    expect(mavet?.verificationStatus).toBe("verified");
    expect(mavet?.lastVerifiedAt).toBe("2026-09-07");
    expect(mavet?.isOpen24_7).toBe(false);
    expect(mavet?.emergencyAvailable).toBe(false);
    expect(mavet?.services).toContain("Грумінг");
    expect(mavet?.services).toContain("Документи");
  });
});

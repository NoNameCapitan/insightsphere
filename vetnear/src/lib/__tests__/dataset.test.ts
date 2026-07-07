import { describe, it, expect } from "vitest";
import { PLACES } from "@/lib/data/places";
import { isSearchablePublicPlace } from "@/lib/data/provenance";

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

  it("NO place claims emergency/24-7 (must stay false until phone-confirmed)", () => {
    for (const p of PLACES) {
      expect(p.emergencyAvailable, p.id).toBe(false);
      expect(p.isOpen24_7, p.id).toBe(false);
      expect(p.category, p.id).not.toBe("emergency_vet");
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
    expect(verified.length).toBe(30);
    for (const p of verified) {
      expect(p.verifiedBy, p.id).toContain("public");
    }
  });
});

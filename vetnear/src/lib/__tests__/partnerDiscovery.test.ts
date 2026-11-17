import { describe, expect, it } from "vitest";
import { findPartnerPlaces, type PartnerPlaceSummary } from "@/lib/partners/discovery";
import { parsePartnerInterest } from "@/lib/partners/interest";

const places: PartnerPlaceSummary[] = [
  { id: "a", slug: "clinic-a", name: "Клініка Здоров’я", address: "вул. Садова, 12", phone: "+380671234567", locality: "Буча", category: "veterinary_clinic" },
  { id: "b", slug: "groom-b", name: "Догляд", address: "вул. Садова, 12", phone: "+380509876543", locality: "Київ", category: "grooming" },
];
const input = { requestId: "00000000-0000-4000-8000-000000000001", organization: "Клініка", locality: "Буча", contactEmail: "owner@example.org", requestedPlan: "free", consent: true };

describe("partner lookup and manual ownership request", () => {
  it("recognizes differently formatted Ukrainian phone numbers", () => {
    expect(findPartnerPlaces(places, "067 123-45-67").map(p => p.id)).toEqual(["a"]);
  });
  it("uses all words to disambiguate the same street in different cities", () => {
    expect(findPartnerPlaces(places, "Садова Буча").map(p => p.id)).toEqual(["a"]);
  });
  it("normalizes apostrophes and avoids noisy one-character matches", () => {
    expect(findPartnerPlaces(places, "ЗДОРОВ'Я").map(p => p.id)).toEqual(["a"]);
    expect(findPartnerPlaces(places, "К")).toEqual([]);
  });
  it("does not assign ownership from a claim request or an injected flag", () => {
    const parsed = parsePartnerInterest({ ...input, claimPlaceSlug: "clinic-a", claimed: true, ownerId: "someone", verificationStatus: "verified" });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.claimPlaceSlug).toBe("clinic-a");
      expect(parsed.value).not.toHaveProperty("claimed");
      expect(parsed.value).not.toHaveProperty("ownerId");
      expect(parsed.value).not.toHaveProperty("verificationStatus");
    }
  });
  it("rejects a malformed profile target", () => {
    expect(parsePartnerInterest({ ...input, claimPlaceSlug: "../admin?verified=1" }).ok).toBe(false);
  });
});

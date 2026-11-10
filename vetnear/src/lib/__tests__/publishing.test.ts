import { describe, expect, it } from "vitest";
import {
  isPlaceLike,
  isPhoneConfirmed,
  mergePlaceLayers,
  slugify,
  submissionToPlace,
} from "@/lib/places/publish";
import { isSearchablePublicPlace } from "@/lib/data/provenance";
import type { PartnerSubmission, Place } from "@/lib/types";

function submission(over: Partial<PartnerSubmission> = {}): PartnerSubmission {
  return {
    id: "sub_abc123def",
    name: "Ветклініка Лапка",
    category: "veterinary_clinic",
    description: "Клініка для котів і собак.",
    address: "вул. Тестова, 1",
    district: "podilskyi",
    latitude: 50.46,
    longitude: 30.51,
    phone: "+380441234567",
    services: ["Терапія"],
    animalTypes: ["cat", "dog"],
    emergencyAvailable: false,
    appointmentRequired: true,
    deliveryAvailable: false,
    pickupAvailable: false,
    tags: [],
    status: "approved",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("slugify", () => {
  it("transliterates Ukrainian into a URL-safe slug", () => {
    expect(slugify("Ветклініка Лапка")).toBe("vetklinika-lapka");
  });

  it("never returns an empty slug", () => {
    expect(slugify("!!! ???")).toBe("place");
  });

  it("collapses separators and trims", () => {
    expect(slugify("  Зоо — Світ!!  ")).toBe("zoo-svit");
  });
});

describe("submissionToPlace — gating", () => {
  it("refuses to publish a submission that is not approved", () => {
    const r = submissionToPlace(submission({ status: "pending_review" }), {
      actorId: "mod_1",
    });
    expect(r).toEqual({ ok: false, reason: "not_approved" });
  });

  it("requires name, address, phone and district", () => {
    expect(submissionToPlace(submission({ name: "  " }), { actorId: "m" })).toEqual({
      ok: false,
      reason: "missing_name",
    });
    expect(submissionToPlace(submission({ phone: "" }), { actorId: "m" })).toEqual({
      ok: false,
      reason: "missing_phone",
    });
  });
});

describe("submissionToPlace — safety invariants", () => {
  it("NEVER publishes emergency availability without a phone confirmation", () => {
    const r = submissionToPlace(submission({ emergencyAvailable: true }), {
      actorId: "mod_1",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.place.emergencyAvailable).toBe(false);
    expect(r.place.isOpen24_7).toBe(false);
    expect(r.place.verified).toBe(false);
  });

  it("unlocks emergency only once the call is recorded", () => {
    const r = submissionToPlace(
      submission({
        emergencyAvailable: true,
        phoneConfirmedAt: "2026-02-01T10:00:00.000Z",
        phoneConfirmedBy: "mod_ira",
      }),
      { actorId: "mod_1" },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.place.emergencyAvailable).toBe(true);
    expect(r.place.verified).toBe(true);
    expect(r.place.verificationStatus).toBe("verified");
    // 24/7 is a separate claim and still stays off.
    expect(r.place.isOpen24_7).toBe(false);
  });

  it("keeps a coordinate-less place out of public discovery", () => {
    const r = submissionToPlace(
      submission({ latitude: undefined, longitude: undefined }),
      { actorId: "mod_1" },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.place.verificationStatus).toBe("needs_geocoding");
    expect(isSearchablePublicPlace(r.place)).toBe(false);
  });

  it("rejects coordinates outside the Kyiv sanity box", () => {
    const r = submissionToPlace(submission({ latitude: 49.0, longitude: 24.0 }), {
      actorId: "mod_1",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.place.verificationStatus).toBe("needs_geocoding");
  });

  it("publishes a valid submission as discoverable with an honest warning", () => {
    const r = submissionToPlace(submission(), { actorId: "mod_1" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(isSearchablePublicPlace(r.place)).toBe(true);
    expect(r.place.dataSource).toBe("partner_submitted");
    expect(r.place.tier).toBe("free");
    expect(r.place.dataWarning).toMatch(/не підтверджені дзвінком/);
  });

  it("produces a deterministic slug that includes the submission suffix", () => {
    const r = submissionToPlace(submission(), { actorId: "mod_1" });
    if (!r.ok) throw new Error("expected success");
    expect(r.place.slug).toBe("vetklinika-lapka-123def");
    expect(r.place.slug.endsWith("sub_abc123def".slice(-6))).toBe(true);
  });
});

describe("isPhoneConfirmed", () => {
  it("needs both timestamp and actor", () => {
    expect(isPhoneConfirmed(submission({ phoneConfirmedAt: "x" }))).toBe(false);
    expect(
      isPhoneConfirmed(submission({ phoneConfirmedAt: "x", phoneConfirmedBy: "y" })),
    ).toBe(true);
  });
});

describe("isPlaceLike", () => {
  it("accepts a mapped place and rejects junk", () => {
    const r = submissionToPlace(submission(), { actorId: "m" });
    if (!r.ok) throw new Error("expected success");
    expect(isPlaceLike(r.place)).toBe(true);
    expect(isPlaceLike(null)).toBe(false);
    expect(isPlaceLike({ id: "x" })).toBe(false);
    expect(isPlaceLike({ ...r.place, latitude: "50.4" })).toBe(false);
  });
});

describe("mergePlaceLayers", () => {
  const base = (over: Partial<Place>): Place =>
    ({ id: "a", slug: "a", name: "A" }) as Place & typeof over;

  it("lets a published row override a seed row with the same id", () => {
    const merged = mergePlaceLayers(
      [{ ...base({}), name: "seed" } as Place],
      [{ ...base({}), name: "published" } as Place],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe("published");
  });

  it("drops a seed row that collides on slug under a different id", () => {
    const seed = [{ id: "old", slug: "shared", name: "seed" } as Place];
    const published = [{ id: "new", slug: "shared", name: "published" } as Place];
    const merged = mergePlaceLayers(seed, published);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("new");
  });

  it("keeps unrelated seed rows untouched", () => {
    const seed = [
      { id: "a", slug: "a" } as Place,
      { id: "b", slug: "b" } as Place,
    ];
    expect(mergePlaceLayers(seed, [])).toHaveLength(2);
  });
});

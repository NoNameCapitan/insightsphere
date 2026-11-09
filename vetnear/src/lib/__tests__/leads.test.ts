import { describe, expect, it } from "vitest";
import {
  aggregateLeadEvents,
  countBillableLeads,
  dayBucket,
  parseLeadEvent,
  sessionHash,
} from "@/lib/places/leads";
import {
  isPromotionActive,
  promotionBoost,
  shouldLabelAsPromoted,
  tierOf,
} from "@/lib/places/tier";
import { rankPlacesForPet, DEFAULT_FILTERS } from "@/lib/geo/ranking";
import type { PlaceWithDistance } from "@/lib/types";

describe("parseLeadEvent", () => {
  it("accepts a well-formed event", () => {
    const r = parseLeadEvent({
      placeId: "alden-vet-pozniaky-1",
      eventType: "call",
      sourcePath: "/nearby",
    });
    expect(r).toEqual({
      ok: true,
      value: { placeId: "alden-vet-pozniaky-1", eventType: "call", sourcePath: "/nearby" },
    });
  });

  it("rejects unknown event types", () => {
    expect(parseLeadEvent({ placeId: "abc", eventType: "purchase" })).toEqual({
      ok: false,
      error: "invalid_event_type",
    });
  });

  it("rejects malformed place ids", () => {
    for (const bad of ["", "a", "../etc/passwd", "x".repeat(200), "has space"]) {
      expect(parseLeadEvent({ placeId: bad, eventType: "call" }).ok).toBe(false);
    }
  });

  it("strips query strings from the source path", () => {
    const r = parseLeadEvent({
      placeId: "abc-1",
      eventType: "route",
      sourcePath: "/nearby?lat=50.44&lng=30.51",
    });
    if (!r.ok) throw new Error("expected ok");
    expect(r.value.sourcePath).toBe("/nearby");
  });

  it("drops a non-path source (no absolute URLs)", () => {
    const r = parseLeadEvent({
      placeId: "abc-1",
      eventType: "route",
      sourcePath: "https://evil.example/x",
    });
    if (!r.ok) throw new Error("expected ok");
    expect(r.value.sourcePath).toBeUndefined();
  });

  it("rejects non-object bodies", () => {
    expect(parseLeadEvent(null).ok).toBe(false);
    expect(parseLeadEvent("call").ok).toBe(false);
  });
});

describe("sessionHash — privacy", () => {
  const day1 = new Date("2026-03-01T12:00:00.000Z");
  const day2 = new Date("2026-03-02T12:00:00.000Z");

  it("never contains the raw client key", () => {
    const h = sessionHash("203.0.113.9", "salt", day1);
    expect(h).not.toContain("203.0.113.9");
    expect(h).toMatch(/^[a-f0-9]{32}$/);
  });

  it("is stable within a day (so de-duplication works)", () => {
    expect(sessionHash("ip", "salt", day1)).toBe(
      sessionHash("ip", "salt", new Date("2026-03-01T23:59:00.000Z")),
    );
  });

  it("rotates across days (so it cannot track a person)", () => {
    expect(sessionHash("ip", "salt", day1)).not.toBe(sessionHash("ip", "salt", day2));
  });

  it("differs per salt", () => {
    expect(sessionHash("ip", "a", day1)).not.toBe(sessionHash("ip", "b", day1));
  });

  it("buckets by UTC day", () => {
    expect(dayBucket(day1)).toBe("2026-03-01");
  });
});

describe("aggregateLeadEvents", () => {
  const now = new Date("2026-03-10T09:00:00.000Z");
  const rows = [
    { place_id: "p1", event_type: "call", created_at: "2026-03-10T08:00:00.000Z" },
    { place_id: "p1", event_type: "call", created_at: "2026-03-09T08:00:00.000Z" },
    { place_id: "p1", event_type: "route", created_at: "2026-03-09T09:00:00.000Z" },
    { place_id: "p1", event_type: "detail_view", created_at: "2026-03-08T09:00:00.000Z" },
    { place_id: "p2", event_type: "call", created_at: "2026-03-10T08:00:00.000Z" },
  ];

  it("counts only the requested place", () => {
    const s = aggregateLeadEvents(rows, "p1", 7, now);
    expect(s.total).toBe(4);
    expect(s.totals.call).toBe(2);
    expect(s.totals.route).toBe(1);
    expect(s.totals.website).toBe(0);
  });

  it("returns a dense daily series with no gaps", () => {
    const s = aggregateLeadEvents(rows, "p1", 7, now);
    expect(s.daily).toHaveLength(7);
    expect(s.daily[s.daily.length - 1]).toEqual({ date: "2026-03-10", count: 1 });
    expect(s.daily[s.daily.length - 2]).toEqual({ date: "2026-03-09", count: 2 });
  });

  it("ignores unknown event types instead of crashing", () => {
    const s = aggregateLeadEvents(
      [{ place_id: "p1", event_type: "hack", created_at: "2026-03-10T08:00:00.000Z" }],
      "p1",
      7,
      now,
    );
    expect(s.total).toBe(0);
  });

  it("counts billable leads separately from views", () => {
    const s = aggregateLeadEvents(rows, "p1", 7, now);
    // call x2 + route x1 = 3; detail_view is not billable.
    expect(countBillableLeads(s)).toBe(3);
  });
});

describe("promotion rules", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const past = new Date(Date.now() - 86_400_000).toISOString();

  it("defaults to the free tier", () => {
    expect(tierOf({ tier: undefined })).toBe("free");
  });

  it("is inactive without an end date", () => {
    expect(isPromotionActive({ tier: "promoted", promotedUntil: null })).toBe(false);
  });

  it("expires silently", () => {
    expect(isPromotionActive({ tier: "promoted", promotedUntil: past })).toBe(false);
  });

  it("is active while paid", () => {
    expect(isPromotionActive({ tier: "promoted", promotedUntil: future })).toBe(true);
  });

  it("NEVER applies in emergency mode", () => {
    const place = { tier: "promoted" as const, promotedUntil: future };
    expect(promotionBoost(place, { emergency: false })).toBeGreaterThan(0);
    expect(promotionBoost(place, { emergency: true })).toBe(0);
    expect(shouldLabelAsPromoted(place, { emergency: true })).toBe(false);
  });

  it("gives the verified tier no ranking advantage", () => {
    expect(promotionBoost({ tier: "verified", promotedUntil: future }, { emergency: false })).toBe(0);
  });
});

describe("rankPlacesForPet — promotion is a tie-breaker, not an override", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();

  const place = (over: Partial<PlaceWithDistance>): PlaceWithDistance =>
    ({
      id: "x",
      slug: "x",
      name: "X",
      category: "veterinary_clinic",
      animalTypes: ["dog"],
      services: [],
      workingHours: [],
      isOpen24_7: false,
      emergencyAvailable: false,
      verified: true,
      claimed: true,
      rating: 0,
      updatedAt: new Date().toISOString(),
      distanceMeters: 1000,
      ...over,
    }) as PlaceWithDistance;

  it("lifts a promoted place above a marginally closer organic one", () => {
    const organic = place({ id: "organic", distanceMeters: 900 });
    const promoted = place({
      id: "promoted",
      distanceMeters: 1000,
      tier: "promoted",
      promotedUntil: future,
    });
    const ranked = rankPlacesForPet([organic, promoted], { filters: DEFAULT_FILTERS });
    expect(ranked[0].id).toBe("promoted");
  });

  it("cannot outrank a substantially closer place", () => {
    const organic = place({ id: "organic", distanceMeters: 200 });
    const promoted = place({
      id: "promoted",
      distanceMeters: 4000,
      tier: "promoted",
      promotedUntil: future,
    });
    const ranked = rankPlacesForPet([organic, promoted], { filters: DEFAULT_FILTERS });
    expect(ranked[0].id).toBe("organic");
  });

  it("is switched off entirely for emergency searches", () => {
    const organic = place({
      id: "organic",
      distanceMeters: 900,
      emergencyAvailable: true,
    });
    const promoted = place({
      id: "promoted",
      distanceMeters: 1000,
      emergencyAvailable: true,
      tier: "promoted",
      promotedUntil: future,
    });
    const ranked = rankPlacesForPet([organic, promoted], {
      filters: { ...DEFAULT_FILTERS, emergency: true },
    });
    expect(ranked[0].id).toBe("organic");
  });
});

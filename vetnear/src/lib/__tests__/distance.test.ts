import { describe, it, expect } from "vitest";
import {
  calculateDistance,
  formatDistance,
  getOpenNowStatus,
  withDistances,
  filterPlacesByRadius,
} from "@/lib/distance";
import { makePlace, KYIV_CENTER, NOON, LATE_NIGHT } from "./fixtures";

describe("calculateDistance", () => {
  it("returns 0 for identical points", () => {
    expect(calculateDistance(KYIV_CENTER, KYIV_CENTER)).toBe(0);
  });

  it("is symmetric", () => {
    const a = KYIV_CENTER;
    const b = { latitude: 50.4547, longitude: 30.5238 }; // ~Khreshchatyk north
    expect(calculateDistance(a, b)).toBe(calculateDistance(b, a));
  });

  it("matches a known Kyiv distance within tolerance", () => {
    // Maidan → Obolon metro is roughly 8.5–9.5 km great-circle.
    const obolon = { latitude: 50.5016, longitude: 30.4981 };
    const d = calculateDistance(KYIV_CENTER, obolon);
    expect(d).toBeGreaterThan(5000);
    expect(d).toBeLessThan(10000);
  });

  it("1 degree of latitude ≈ 111 km", () => {
    const d = calculateDistance(
      { latitude: 50, longitude: 30 },
      { latitude: 51, longitude: 30 },
    );
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_500);
  });
});

describe("formatDistance", () => {
  it("shows meters under 1 km", () => {
    expect(formatDistance(450)).toBe("450 м");
  });
  it("shows km with one decimal from 1 km", () => {
    expect(formatDistance(1500)).toBe("1.5 км");
  });
  it("handles null", () => {
    expect(formatDistance(null)).toBe("—");
  });
});

describe("getOpenNowStatus", () => {
  it("24/7 places are always open", () => {
    const p = makePlace({ isOpen24_7: true, workingHours: [] });
    expect(getOpenNowStatus(p, LATE_NIGHT)).toBe(true);
  });

  it("open inside working hours", () => {
    expect(getOpenNowStatus(makePlace(), NOON)).toBe(true);
  });

  it("closed outside working hours", () => {
    expect(getOpenNowStatus(makePlace(), LATE_NIGHT)).toBe(false);
  });

  it("respects closed flag for the day", () => {
    const wed = NOON.getDay();
    const p = makePlace({
      workingHours: [{ day: wed, open: "08:00", close: "20:00", closed: true }],
    });
    expect(getOpenNowStatus(p, NOON)).toBe(false);
  });

  it("handles closing after midnight (e.g. 20:00–02:00)", () => {
    const wed = LATE_NIGHT.getDay();
    const p = makePlace({
      workingHours: [{ day: wed, open: "20:00", close: "02:00" }],
    });
    expect(getOpenNowStatus(p, LATE_NIGHT)).toBe(true); // 23:00 is inside
    expect(getOpenNowStatus(p, NOON)).toBe(false);
  });
});

describe("withDistances / filterPlacesByRadius", () => {
  it("attaches null distance without origin and passes filter through", () => {
    const list = withDistances([makePlace()], null);
    expect(list[0].distanceMeters).toBeNull();
    // No origin → radius filter is a no-op (can't measure).
    expect(filterPlacesByRadius(list, 1000, null)).toHaveLength(1);
  });

  it("filters places outside the radius", () => {
    const near = makePlace(); // at origin
    const far = makePlace({ latitude: 50.5016, longitude: 30.4981 }); // ~8 km
    const list = withDistances([near, far], KYIV_CENTER);
    const within2km = filterPlacesByRadius(list, 2000, KYIV_CENTER);
    expect(within2km.map((p) => p.id)).toEqual([near.id]);
  });
});

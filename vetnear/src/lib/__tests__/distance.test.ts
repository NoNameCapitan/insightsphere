import { describe, it, expect } from "vitest";
import {
  calculateDistance,
  formatDistance,
  getOpenNowStatus,
  getOpeningHoursStatus,
  withDistances,
  filterPlacesByRadius,
} from "@/lib/distance";
import { makePlace, KYIV_CENTER } from "./fixtures";

// Explicit instants: Wednesday 12:00 and 23:00 in Kyiv, independent of runner TZ.
const NOON = new Date("2026-07-01T09:00:00Z");
const LATE_NIGHT = new Date("2026-07-01T20:00:00Z");

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
    const p = makePlace({
      workingHours: [{ day: 3, open: "08:00", close: "20:00", closed: true }],
    });
    expect(getOpenNowStatus(p, NOON)).toBe(false);
  });

  it("handles closing after midnight (e.g. 20:00–02:00)", () => {
    const p = makePlace({
      workingHours: [{ day: 3, open: "20:00", close: "02:00" }],
    });
    expect(getOpenNowStatus(p, LATE_NIGHT)).toBe(true); // 23:00 is inside
    expect(getOpenNowStatus(p, NOON)).toBe(false);
  });
});

describe("opening hours in the provider's time zone", () => {
  it("uses Kyiv rather than UTC for legacy places", () => {
    const p = makePlace({ workingHours: [{ day: 3, open: "08:00", close: "10:00" }] });
    expect(getOpeningHoursStatus(p, new Date("2026-07-01T06:00:00Z"))).toBe("open");
    expect(getOpeningHoursStatus(p, new Date("2026-07-01T08:00:00Z"))).toBe("closed");
  });

  it("includes the tail of yesterday's overnight shift, even on today's closed day", () => {
    const p = makePlace({ workingHours: [
      { day: 3, open: "20:00", close: "02:00" },
      { day: 4, open: "", close: "", closed: true },
    ] });
    expect(getOpeningHoursStatus(p, new Date("2026-07-01T22:00:00Z"))).toBe("open"); // Thu 01:00
    expect(getOpeningHoursStatus(p, new Date("2026-07-01T23:00:00Z"))).toBe("closed"); // Thu 02:00
  });

  it("carries Saturday's night shift into Sunday", () => {
    const p = makePlace({ workingHours: [{ day: 6, open: "22:00", close: "03:00" }] });
    expect(getOpeningHoursStatus(p, new Date("2026-07-04T22:30:00Z"))).toBe("open");
  });

  it("includes opening and excludes the exact closing minute", () => {
    const p = makePlace();
    expect(getOpeningHoursStatus(p, new Date("2026-07-01T05:00:00Z"))).toBe("open");
    expect(getOpeningHoursStatus(p, new Date("2026-07-01T16:59:59Z"))).toBe("open");
    expect(getOpeningHoursStatus(p, new Date("2026-07-01T17:00:00Z"))).toBe("closed");
  });

  it("handles a full day expressed as 00:00–24:00 and split shifts", () => {
    expect(getOpeningHoursStatus(makePlace({ workingHours: [{ day: 3, open: "00:00", close: "24:00" }] }), LATE_NIGHT)).toBe("open");
    const p = makePlace({ workingHours: [
      { day: 3, open: "08:00", close: "12:00" },
      { day: 3, open: "13:00", close: "20:00" },
    ] });
    expect(getOpeningHoursStatus(p, NOON)).toBe("closed");
    expect(getOpeningHoursStatus(p, new Date("2026-07-01T10:00:00Z"))).toBe("open");
  });

  it("uses the optional IANA time zone, including a different local calendar day", () => {
    const p = makePlace({ timeZone: "America/New_York", workingHours: [{ day: 2, open: "20:00", close: "23:00" }] });
    expect(getOpeningHoursStatus(p, new Date("2026-07-01T01:00:00Z"))).toBe("open"); // Tue 21:00
  });

  it("observes Kyiv's spring-forward and repeated autumn hour", () => {
    const spring = makePlace({ workingHours: [{ day: 0, open: "03:30", close: "05:00" }] });
    expect(getOpeningHoursStatus(spring, new Date("2026-03-29T00:30:00Z"))).toBe("closed");
    expect(getOpeningHoursStatus(spring, new Date("2026-03-29T01:00:00Z"))).toBe("open");
    const autumn = makePlace({ workingHours: [{ day: 0, open: "03:00", close: "04:00" }] });
    expect(getOpeningHoursStatus(autumn, new Date("2026-10-25T00:30:00Z"))).toBe("open");
    expect(getOpeningHoursStatus(autumn, new Date("2026-10-25T01:30:00Z"))).toBe("open");
    expect(getOpeningHoursStatus(autumn, new Date("2026-10-25T02:00:00Z"))).toBe("closed");
  });

  it("distinguishes missing hours from a confirmed closed day", () => {
    expect(getOpeningHoursStatus(makePlace({ workingHours: [] }), NOON)).toBe("unknown");
    expect(getOpeningHoursStatus(makePlace({ workingHours: [{ day: 2, open: "08:00", close: "20:00" }] }), NOON)).toBe("unknown");
    expect(getOpeningHoursStatus(makePlace({ workingHours: [{ day: 3, open: "", close: "", closed: true }] }), NOON)).toBe("closed");
  });

  it.each([
    { workingHours: [{ day: 3, open: "25:00", close: "26:00" }] },
    { workingHours: [{ day: 3, open: "00:00", close: "00:00" }] },
    { workingHours: [{ day: 7, open: "08:00", close: "20:00" }] },
    { timeZone: "Mars/Olympus" },
  ])("does not claim opening for invalid schedule data: %j", (overrides) => {
    const p = makePlace(overrides);
    expect(getOpeningHoursStatus(p, NOON)).toBe("unknown");
    expect(getOpenNowStatus(p, NOON)).toBe(false);
  });

  it("handles invalid dates without throwing or claiming availability", () => {
    expect(getOpeningHoursStatus(makePlace(), new Date("invalid"))).toBe("unknown");
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

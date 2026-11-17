import { describe, expect, it } from "vitest";
import { buildEventCalendar, eventStatus, filterKyivEvents, isCalendarEligible, KYIV_EVENTS, KYIV_UPDATES_AS_OF, kyivCalendarDate, type KyivEvent } from "@/lib/data/kyivUpdates";

const checkedNow = new Date("2026-11-17T12:00:00Z");
const scheduled = (patch: Partial<KyivEvent> = {}): KyivEvent => ({
  ...KYIV_EVENTS[0], id: "confirmed-event", title: "Зустріч; собаки, коти", confirmation: "source_confirmed",
  schedule: { kind: "date", startDate: "2026-11-28", endDate: "2026-11-29", label: "28–29 листопада", datesConfirmed: true },
  reviewAfter: "2026-12-01", ...patch,
});

describe("Kyiv editorial dates and provenance", () => {
  it("keeps material dated, located and linked to direct sources", () => {
    expect(KYIV_UPDATES_AS_OF).toBe("2026-11-17");
    expect(new Set(KYIV_EVENTS.map((event) => event.id)).size).toBe(KYIV_EVENTS.length);
    for (const event of KYIV_EVENTS) {
      expect(event.locality).toBeTruthy();
      expect(event.venue).toBeTruthy();
      expect(event.eligibility).toBeTruthy();
      expect(event.lastCheckedAt).toBe(KYIV_UPDATES_AS_OF);
      expect(event.reviewAfter >= event.lastCheckedAt).toBe(true);
      expect(event.sources.length).toBeGreaterThan(0);
      for (const source of event.sources) expect(new URL(source.url).protocol).toBe("https:");
    }
  });
  it("uses Kyiv's calendar date in winter and summer, independent of the host timezone", () => {
    expect(kyivCalendarDate(new Date("2026-11-17T21:59:59Z"))).toBe("2026-11-17");
    expect(kyivCalendarDate(new Date("2026-11-17T22:00:00Z"))).toBe("2026-11-18");
    expect(kyivCalendarDate(new Date("2026-07-17T21:00:00Z"))).toBe("2026-07-18");
  });
  it("ends an all-day event only after the last calendar day in Kyiv", () => {
    const event = scheduled();
    expect(eventStatus(event, checkedNow)).toBe("upcoming");
    expect(eventStatus(event, new Date("2026-11-29T21:59:59Z"))).toBe("ongoing");
    expect(eventStatus(event, new Date("2026-11-29T22:00:00Z"))).toBe("expired");
  });
  it("never presents an ended or unannounced event as a new upcoming opportunity", () => {
    expect(eventStatus(KYIV_EVENTS.find((event) => event.id === "obukhiv-vaccination-november")!, checkedNow)).toBe("expired");
    expect(eventStatus(KYIV_EVENTS.find((event) => event.id === "adoptme-next-date")!, checkedNow)).toBe("needs_confirmation");
    expect(KYIV_EVENTS.filter((event) => eventStatus(event, checkedNow) === "upcoming")).toHaveLength(0);
  });
  it("requires a fresh source check instead of leaving an old service marked current forever", () => {
    expect(eventStatus(KYIV_EVENTS[0], checkedNow)).toBe("ongoing");
    expect(eventStatus(KYIV_EVENTS[0], new Date("2026-12-18T10:00:00Z"))).toBe("needs_confirmation");
  });
});

describe("news selection", () => {
  it("combines category and region without leaking archived events", () => {
    const events = filterKyivEvents(KYIV_EVENTS, { category: "vaccination", region: "kyiv_oblast" }, checkedNow);
    expect(events.map((event) => event.id)).toEqual(["oblast-rabies-vaccination"]);
  });
  it("keeps past events in the archive and saved archive entries explicitly available", () => {
    expect(filterKyivEvents(KYIV_EVENTS, { scope: "archive" }, checkedNow).map((event) => event.id)).toEqual(["obukhiv-vaccination-november"]);
    expect(filterKyivEvents(KYIV_EVENTS, { scope: "saved", savedIds: ["obukhiv-vaccination-november"] }, checkedNow)).toHaveLength(1);
  });
  it("returns only followed topics and does not invent a feed when none are selected", () => {
    expect(filterKyivEvents(KYIV_EVENTS, { scope: "following" }, checkedNow)).toHaveLength(0);
    const events = filterKyivEvents(KYIV_EVENTS, { scope: "following", followedCategories: ["adoption"] }, checkedNow);
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.category === "adoption")).toBe(true);
  });
});

describe("event calendar guard", () => {
  it("rejects unresolved, undated, stale and past events", () => {
    for (const event of KYIV_EVENTS) {
      expect(isCalendarEligible(event, checkedNow)).toBe(false);
      expect(buildEventCalendar(event, checkedNow)).toBeNull();
    }
    expect(buildEventCalendar(scheduled({ reviewAfter: "2026-11-16" }), checkedNow)).toBeNull();
  });
  it("exports confirmed all-day dates with a stable ID, escaped text and exclusive end", () => {
    const ics = buildEventCalendar(scheduled(), checkedNow)!;
    expect(ics).toContain("UID:confirmed-event@vetnear");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261128");
    expect(ics).toContain("DTEND;VALUE=DATE:20261130");
    expect(ics.replace(/\r\n /g, "")).toContain("SUMMARY:Зустріч\\; собаки\\, коти");
    expect(ics).toContain("DTSTAMP:20261117T120000Z");
    expect(ics.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { KYIV_EVENTS, type KyivEvent } from "@/lib/data/kyivUpdates";
import { groupEventFeed } from "@/lib/events/feed";

const now = new Date("2026-11-17T12:00:00Z");
describe("editorial feed grouping", () => {
  it("does not promote incomplete dated announcements to confirmed events", () => {
    const groups = groupEventFeed(KYIV_EVENTS, now);
    expect(groups.map((group) => group.id)).toEqual(["ongoing", "pending", "archive"]);
    expect(groups.find((group) => group.id === "pending")?.events.map((event) => event.id)).toContain("ukc-pinscher-november");
    expect(groups.find((group) => group.id === "archive")?.events.map((event) => event.id)).toEqual(["obukhiv-vaccination-november"]);
    expect(groups.flatMap((group) => group.events)).toHaveLength(KYIV_EVENTS.length);
  });
  it("moves stale permanent sources into the confirmation group", () => {
    const groups = groupEventFeed(KYIV_EVENTS.filter((event) => event.schedule.kind === "ongoing"), new Date("2027-01-20T12:00:00Z"));
    expect(groups.map((group) => group.id)).toEqual(["pending"]);
  });
  it("sorts only sufficiently confirmed dates and preserves saved archived material", () => {
    const seed = KYIV_EVENTS.find((event) => event.id === "ukc-pinscher-november")!;
    const confirmed: KyivEvent = { ...seed, confirmation: "source_confirmed" };
    const later: KyivEvent = { ...confirmed, id: "later", schedule: { kind: "date", startDate: "2026-11-30", endDate: "2026-11-30", label: "30 листопада", datesConfirmed: true } };
    const groups = groupEventFeed([later, KYIV_EVENTS.at(-1)!, confirmed], now);
    expect(groups.map((group) => group.id)).toEqual(["dated", "archive"]);
    expect(groups[0].events.map((event) => event.id)).toEqual([confirmed.id, "later"]);
  });
});

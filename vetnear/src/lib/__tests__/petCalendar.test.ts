import { describe, expect, it } from "vitest";
import { addMonths, buildIcs, DEFAULT_INTERVAL_MONTHS } from "@/lib/pets/calendar";

describe("pet calendar helpers", () => {
  it("adds months and clamps to the end of shorter months", () => {
    expect(addMonths("2026-11-09", 12)).toBe("2027-11-09");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("", 1)).toBe("");
  });

  it("uses conservative default intervals", () => {
    expect(DEFAULT_INTERVAL_MONTHS).toEqual({ vaccination: 12, deworming: 3, flea_tick: 1 });
  });

  it("builds an all-day event with an exclusive end date and escaped text", () => {
    const ics = buildIcs([{ date: "2026-12-31", title: "Сказ; комплексна, повторно", petName: "Барні" }], new Date("2026-11-09T10:00:00Z"));
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261231");
    expect(ics).toContain("DTEND;VALUE=DATE:20270101");
    expect(ics).toContain("SUMMARY:Барні: Сказ\; комплексна\\, повторно");
    expect(ics).toContain("DTSTAMP:20261109T100000Z");
    expect(ics.split("\r\n").at(-1)).toBe("END:VCALENDAR");
  });
});

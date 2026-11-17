import { describe, expect, it } from "vitest";
import { addMonths, buildIcs } from "@/lib/pets/calendar";

const unfold = (value: string) => value.replace(/\r\n[ \t]/g, "");
const uids = (value: string) => unfold(value).split("\r\n").filter((line) => line.startsWith("UID:"));

describe("pet calendar helpers", () => {
  it("adds months and clamps to the end of shorter months", () => {
    expect(addMonths("2026-11-09", 12)).toBe("2027-11-09");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("", 1)).toBe("");
  });

  it("builds an all-day event with an exclusive end date and escaped text", () => {
    const ics = buildIcs([{ date: "2026-12-31", title: "Сказ; комплексна, повторно", petName: "Барні" }], new Date("2026-11-09T10:00:00Z"));
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261231");
    expect(ics).toContain("DTEND;VALUE=DATE:20270101");
    expect(unfold(ics)).toContain("SUMMARY:Барні: Сказ\\; комплексна\\, повторно");
    expect(ics).toContain("DTSTAMP:20261109T100000Z");
    expect(ics.split("\r\n").at(-1)).toBe("END:VCALENDAR");
  });

  it("keeps record identities stable across exports, reorder, and rescheduling", () => {
    const first = { id: "reminder-a", petId: "pet-a", date: "2026-12-01", title: "Огляд", petName: "Барні" };
    const second = { id: "reminder-b", petId: "pet-a", date: "2026-12-02", title: "Грумінг", petName: "Барні" };
    const original = buildIcs([first, second], new Date("2026-11-17T10:00:00Z"));
    const updated = buildIcs([second, { ...first, date: "2026-12-03", title: "Огляд у клініці", petName: "Барні-молодший" }], new Date("2026-11-18T11:00:00Z"));
    expect(uids(updated)).toEqual(uids(original).reverse());
    expect(updated).toContain("DTSTART;VALUE=DATE:20261203");
    expect(updated).toContain("DTSTAMP:20261118T110000Z");
  });

  it("separates identical records for different pets and stable IDs", () => {
    const event = { id: "reminder-a", petId: "pet-a", date: "2026-12-01", title: "Огляд", petName: "Барні" };
    const result = uids(buildIcs([event, { ...event, petId: "pet-b" }, { ...event, id: "reminder-b" }]));
    expect(new Set(result).size).toBe(3);
  });

  it("keeps legacy event IDs independent of export time and array order", () => {
    const first = { date: "2026-12-01", title: "Огляд", petName: "Барні" };
    const second = { date: "2026-12-02", title: "Грумінг", petName: "Мурчик" };
    expect(uids(buildIcs([first, second], new Date("2026-11-17T10:00:00Z"))))
      .toEqual(uids(buildIcs([second, first], new Date("2026-11-18T10:00:00Z"))).reverse());
  });

  it("folds long Ukrainian text and emoji without splitting UTF-8 characters", () => {
    const title = "Огляд і перевірка документів 🐾 ".repeat(12);
    const result = buildIcs([{ date: "2026-12-01", title, petName: "Мурчик" }]);
    for (const line of result.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(unfold(result)).toContain(`SUMMARY:Мурчик: ${title}`);
    expect(result).not.toContain("�");
  });

  it("escapes punctuation and all newline forms so text cannot add properties", () => {
    const result = unfold(buildIcs([{ date: "2026-12-01", title: "Огляд; документи, нотатки\\\r\nURL:javascript:bad\rEND:VEVENT\nПісля", petName: "Мурчик" }]));
    expect(result).toContain("SUMMARY:Мурчик: Огляд\\; документи\\, нотатки\\\\\\nURL:javascript:bad\\nEND:VEVENT\\nПісля");
    expect(result.split("\r\n").filter((line) => line === "END:VEVENT")).toHaveLength(1);
    expect(result.split("\r\n").some((line) => line.startsWith("URL:"))).toBe(false);
  });

  it("includes a safe profile deep link and rejects injected or unsafe URLs", () => {
    const event = { date: "2026-12-01", title: "Огляд", petName: "Мурчик" };
    expect(unfold(buildIcs([{ ...event, url: "https://vetnear.example/my-pets/pet-a" }])))
      .toContain("URL:https://vetnear.example/my-pets/pet-a");
    for (const url of ["javascript:alert(1)", "https://vetnear.example/\r\nATTENDEE:bad", "https://secret:password@vetnear.example/", "/my-pets/pet-a"]) {
      expect(unfold(buildIcs([{ ...event, url }])).split("\r\n").some((line) => line.startsWith("URL:"))).toBe(false);
    }
  });

  it("exports explicit all-day dates through leap days and DST boundaries", () => {
    const result = buildIcs([
      { date: "2028-02-29", title: "Огляд", petName: "Мурчик" },
      { date: "2026-10-25", title: "Візит", petName: "Барні" },
    ]);
    expect(result).toContain("DTSTART;VALUE=DATE:20280229\r\nDTEND;VALUE=DATE:20280301");
    expect(result).toContain("DTSTART;VALUE=DATE:20261025\r\nDTEND;VALUE=DATE:20261026");
  });

  it("refuses nonexistent dates instead of silently moving the reminder", () => {
    for (const date of ["2026-02-29", "2026-02-31", "", "2026-12-01\r\nSUMMARY:bad", "9999-12-31"]) {
      expect(() => buildIcs([{ date, title: "Огляд", petName: "Мурчик" }])).toThrow(RangeError);
    }
  });
});

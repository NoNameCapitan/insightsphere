// Calendar export for pet reminders. Without accounts or a push backend the
// honest way to remind someone is their own calendar, so we hand over a
// standard all-day .ics event. Pure functions — no browser APIs here.

export type CalendarEvent = { date: string; title: string; petName: string };

const compact = (isoDate: string) => isoDate.replaceAll("-", "");

/** Next calendar day as YYYYMMDD (DTEND of an all-day event is exclusive). */
function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}

/** Escape text per RFC 5545 (backslash, semicolon, comma, newline). */
function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export function buildIcs(events: CalendarEvent[], stamp = new Date()): string {
  const dtstamp = `${stamp.toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//VetNear//Pet reminders//UK", "CALSCALE:GREGORIAN"];
  events.forEach((event, index) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${compact(event.date)}-${index}-${dtstamp}@vetnear`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${compact(event.date)}`,
      `DTEND;VALUE=DATE:${nextDay(event.date)}`,
      `SUMMARY:${escapeText(`${event.petName}: ${event.title}`)}`,
      "DESCRIPTION:Нагадування з медкартки VetNear. Дату уточніть у ветеринара.",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(event.title)}`,
      "TRIGGER:-P1D",
      "END:VALARM",
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export type RecordKind = "vaccination" | "deworming" | "flea_tick";

/** Typical repeat intervals in months — a starting point, never a prescription. */
export const DEFAULT_INTERVAL_MONTHS: Record<RecordKind, number> = {
  vaccination: 12,
  deworming: 3,
  flea_tick: 1,
};

/** Adds whole months to a YYYY-MM-DD date, clamping to the month's last day. */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

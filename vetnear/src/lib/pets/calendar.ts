// Calendar export for pet reminders. Without accounts or a push backend the
// honest way to remind someone is their own calendar, so we hand over a
// standard all-day .ics event. Pure functions — no browser APIs here.

import { isCalendarDate } from "@/lib/pets/validation";

export type CalendarEvent = {
  date: string;
  title: string;
  petName: string;
  /** Stable medical-record/reminder identity, independent of its displayed date. */
  id?: string;
  /** Keeps identically named animals and their records separate. */
  petId?: string;
  /** Optional absolute link to the locally stored profile. */
  url?: string;
};

const compact = (isoDate: string) => isoDate.replaceAll("-", "");

/** Next calendar day as YYYYMMDD (DTEND of an all-day event is exclusive). */
function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}

/** Escape text per RFC 5545 (backslash, semicolon, comma, newline). */
function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

/** Deterministic identifiers, not a security hash. Export time is deliberately absent. */
function eventUid(event: CalendarEvent): string {
  const identity = event.id
    ? JSON.stringify([event.petId ?? event.petName, event.id])
    : JSON.stringify([event.petId ?? event.petName, event.date, event.title]);
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < identity.length; index += 1) {
    const code = identity.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}@vetnear`;
}

function profileUrl(value?: string): string | undefined {
  if (!value || /[\u0000-\u0020\u007f]/.test(value)) return undefined;
  try {
    const parsed = new URL(value);
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) return undefined;
    return parsed.href;
  } catch {
    return undefined;
  }
}

/** RFC 5545: physical content lines are at most 75 UTF-8 octets. */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let part = "";
  let bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) {
      parts.push(part);
      part = " ";
      bytes = 1;
    }
    part += character;
    bytes += size;
  }
  parts.push(part);
  return parts.join("\r\n");
}

export function buildIcs(events: CalendarEvent[], stamp = new Date()): string {
  const dtstamp = `${stamp.toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//VetNear//Pet reminders//UK", "CALSCALE:GREGORIAN"];
  events.forEach((event) => {
    if (!isCalendarDate(event.date) || event.date === "9999-12-31") {
      throw new RangeError("Неможливо експортувати подію: перевірте дату.");
    }
    const url = profileUrl(event.url);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${eventUid(event)}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${compact(event.date)}`,
      `DTEND;VALUE=DATE:${nextDay(event.date)}`,
      `SUMMARY:${escapeText(`${event.petName}: ${event.title}`)}`,
      `DESCRIPTION:${escapeText("Подія з медкартки VetNear. Дату уточніть у ветеринара. Картка доступна в браузері, де її збережено.")}`,
      ...(url ? [`URL:${url}`] : []),
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(event.title)}`,
      "TRIGGER:-P1D",
      "END:VALARM",
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n");
}

/** Adds whole months to a YYYY-MM-DD date, clamping to the month's last day. */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

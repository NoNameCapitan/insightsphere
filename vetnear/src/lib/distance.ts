// Distance + open-now utilities (Module 2). Pure functions, server-safe.
import type { Coordinates, Place, PlaceWithDistance } from "@/lib/types";

const R = 6371000; // Earth radius (m)
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in meters between two coordinates. */
export function calculateDistance(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Back-compat alias used by earlier code. */
export const haversineMeters = calculateDistance;

export function formatDistance(
  meters: number | null,
  units = { m: "м", km: "км" },
): string {
  if (meters == null) return "—";
  if (meters < 1000) return `${Math.round(meters)} ${units.m}`;
  return `${(meters / 1000).toFixed(1)} ${units.km}`;
}

export type OpeningHoursStatus = "open" | "closed" | "unknown";
type ScheduledPlace = Pick<Place, "isOpen24_7" | "workingHours" | "timeZone">;
const timeFormatters = new Map<string, Intl.DateTimeFormat>();
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function localScheduleTime(now: Date, timeZone: string) {
  try {
    let formatter = timeFormatters.get(timeZone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat("en-US", {
        timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      });
      // Bounded cache: provider data must not grow the process cache indefinitely.
      if (timeFormatters.size >= 16) timeFormatters.clear();
      timeFormatters.set(timeZone, formatter);
    }
    const parts = formatter.formatToParts(now);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
    const day = WEEKDAYS.indexOf(part("weekday") ?? "");
    const minutes = Number(part("hour")) * 60 + Number(part("minute"));
    return day >= 0 && Number.isFinite(minutes) ? { day, minutes } : null;
  } catch {
    // An invalid zone/date is unknown, never silently evaluated in the device zone.
    return null;
  }
}

function scheduleMinutes(value: string, closing = false): number | null {
  if (closing && value === "24:00") return 1440;
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

/**
 * Scheduled availability in the PLACE's time zone, not the visitor's/device's.
 * This does not guarantee intake, holiday opening or emergency availability.
 * Missing or malformed data is unknown. Equal opening/closing times are
 * ambiguous; a full day must use 00:00–24:00 or the explicit 24/7 flag.
 */
export function getOpeningHoursStatus(
  place: ScheduledPlace,
  now: Date = new Date(),
): OpeningHoursStatus {
  if (!Number.isFinite(now.getTime())) return "unknown";
  if (place.isOpen24_7) return "open";
  const local = localScheduleTime(now, place.timeZone ?? "Europe/Kyiv");
  if (!local || !Array.isArray(place.workingHours) || !place.workingHours.length) return "unknown";

  const intervals: { day: number; closed: boolean; open: number; close: number }[] = [];
  for (const hours of place.workingHours) {
    if (!hours || !Number.isInteger(hours.day) || hours.day < 0 || hours.day > 6) return "unknown";
    if (hours.closed) {
      intervals.push({ day: hours.day, closed: true, open: 0, close: 0 });
      continue;
    }
    const open = scheduleMinutes(hours.open);
    const close = scheduleMinutes(hours.close, true);
    if (open === null || close === null || open === close) return "unknown";
    intervals.push({ day: hours.day, closed: false, open, close });
  }

  const previousDay = (local.day + 6) % 7;
  for (const hours of intervals) {
    if (hours.closed) continue;
    // The early-morning tail belongs to the previous day's overnight shift.
    if (hours.day === previousDay && hours.close < hours.open && local.minutes < hours.close) return "open";
    if (hours.day !== local.day) continue;
    if (hours.close < hours.open ? local.minutes >= hours.open
      : local.minutes >= hours.open && local.minutes < hours.close) return "open";
  }
  return intervals.some((hours) => hours.day === local.day) ? "closed" : "unknown";
}

/** Boolean compatibility helper for filtering: unknown never means open. */
export function getOpenNowStatus(place: ScheduledPlace, now: Date = new Date()): boolean {
  return getOpeningHoursStatus(place, now) === "open";
}

/** Back-compat alias. */
export const isOpenNow = getOpenNowStatus;

/** Attach a computed distance (meters) to each place from an origin. */
export function withDistances(
  places: Place[],
  origin: Coordinates | null,
): PlaceWithDistance[] {
  return places.map((p) => ({
    ...p,
    distanceMeters: origin
      ? calculateDistance(origin, { latitude: p.latitude, longitude: p.longitude })
      : null,
  }));
}

/** Keep only places within `radius` meters of the origin (if origin known). */
export function filterPlacesByRadius(
  places: PlaceWithDistance[],
  radius: number,
  origin: Coordinates | null,
): PlaceWithDistance[] {
  if (!origin) return places;
  return places.filter((p) => p.distanceMeters != null && p.distanceMeters <= radius);
}

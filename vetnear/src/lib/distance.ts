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

/** Whether a place is open at the given moment (handles 24/7 + past-midnight). */
export function getOpenNowStatus(
  place: Pick<Place, "isOpen24_7" | "workingHours">,
  now: Date = new Date(),
): boolean {
  if (place.isOpen24_7) return true;
  const day = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  const toMin = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  for (const wh of place.workingHours) {
    if (wh.day !== day || wh.closed) continue;
    const open = toMin(wh.open);
    let close = toMin(wh.close);
    if (close <= open) close += 24 * 60; // closes after midnight
    if (mins >= open && mins <= close) return true;
  }
  return false;
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

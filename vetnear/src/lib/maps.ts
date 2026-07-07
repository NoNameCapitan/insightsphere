import type { Coordinates } from "./types";

/**
 * Build a Google Maps directions URL. Server-safe (no "use client"), so it can
 * be called from both server components and client components.
 */
export function googleMapsRoute(
  dest: { latitude: number; longitude: number },
  origin?: Coordinates | null,
): string {
  const d = `${dest.latitude},${dest.longitude}`;
  const o = origin ? `${origin.latitude},${origin.longitude}` : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${d}${
    o ? `&origin=${o}` : ""
  }&travelmode=driving`;
}

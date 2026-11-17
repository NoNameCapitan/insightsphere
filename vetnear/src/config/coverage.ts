import type { Coordinates, PlaceLocation, PlaceRegion } from "@/lib/types";
import { isValidCoordinates } from "@/lib/geo/coordinates";

export const COVERAGE_LABEL = "Київ та Київська область";
export const COVERAGE_REGIONS: Record<PlaceRegion, string> = {
  kyiv_city: "Київ",
  kyiv_oblast: "Київська область",
};

// Sanity envelopes, NOT administrative polygons or proof of area membership.
// Region/locality must still be checked against the provider's real address.
const COVERAGE_BOUNDS: Record<PlaceRegion, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  kyiv_city: { minLat: 50.1, maxLat: 50.65, minLng: 30.2, maxLng: 30.9 },
  kyiv_oblast: { minLat: 49.0, maxLat: 51.6, minLng: 29.0, maxLng: 32.0 },
};

export function normalizeRegion(value: unknown): PlaceRegion | null {
  return value === "kyiv_city" || value === "kyiv_oblast" ? value : null;
}

export function regionOf(place: PlaceLocation): PlaceRegion {
  return place.region ?? "kyiv_city";
}

export function localityOf(place: PlaceLocation): string {
  return place.locality?.trim() || (regionOf(place) === "kyiv_city" ? "Київ" : "");
}

export function localityKey(value: string): string {
  return value.trim().normalize("NFC").toLocaleLowerCase("uk").replace(/[’ʼ`]/g, "'").replace(/\s+/g, " ");
}

export function withinCoverageBounds(region: PlaceRegion, coords: Coordinates): boolean {
  if (!isValidCoordinates(coords)) return false;
  const bounds = COVERAGE_BOUNDS[region];
  return coords.latitude >= bounds.minLat && coords.latitude <= bounds.maxLat
    && coords.longitude >= bounds.minLng && coords.longitude <= bounds.maxLng;
}

/** Kyiv-only safety sources must not drive automatic maps for the wider oblast. */
export function shouldUseKyivSafety(region: PlaceRegion | "all" | undefined, origin: Coordinates | null): boolean {
  if (region === "kyiv_oblast") return false;
  if (region === "kyiv_city") return true;
  return origin !== null && withinCoverageBounds("kyiv_city", origin);
}

import type { Coordinates, PlaceLocation } from "./types";
import { localityOf, regionOf } from "@/config/coverage";

/**
 * Build a Google Maps directions URL. Server-safe (no "use client"), so it can
 * be called from both server components and client components.
 */
export function googleMapsRoute(
  dest: Coordinates & PlaceLocation & { address?: string; routeByAddress?: boolean },
  origin?: Coordinates | null,
): string {
  const d = dest.routeByAddress && dest.address
    ? encodeURIComponent([regionOf(dest) === "kyiv_oblast" ? "Київська область" : "", localityOf(dest), dest.address].filter(Boolean).join(", "))
    : `${dest.latitude},${dest.longitude}`;
  const o = origin ? `${origin.latitude},${origin.longitude}` : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${d}${
    o ? `&origin=${o}` : ""
  }&travelmode=driving`;
}

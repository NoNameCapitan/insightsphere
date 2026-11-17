import type { Coordinates } from "@/lib/types";

/** WGS84 range check shared by stored positions and geocoder responses. */
export function isValidCoordinates(value: unknown): value is Coordinates {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<Coordinates>;
  return typeof point.latitude === "number" && Number.isFinite(point.latitude)
    && Math.abs(point.latitude) <= 90
    && typeof point.longitude === "number" && Number.isFinite(point.longitude)
    && Math.abs(point.longitude) <= 180;
}

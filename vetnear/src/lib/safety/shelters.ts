import { calculateDistance } from "@/lib/distance";
import type { Coordinates } from "@/lib/types";
import type { KyivShelter } from "@/lib/safety/types";

export const KYIV_SHELTERS_DATASET_URL =
  "https://data.kyivcity.gov.ua/dataset/dani-pro-roztashuvannia-zakhysnykh-sporud-tsyvilnoho-zakhystu-dep-municipal";

export type ArcGisFeature = {
  attributes?: Record<string, unknown>;
  geometry?: { x?: unknown; y?: unknown };
};

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeShelterFeatures(
  features: unknown[],
  origin: Coordinates,
  limit = 5,
): KyivShelter[] {
  return features
    .map((value): KyivShelter | null => {
      if (!value || typeof value !== "object") return null;
      const feature = value as ArcGisFeature;
      const a = feature.attributes ?? {};
      if (a.actual !== 1 && a.actual !== "1" && a.actual !== true) return null;
      const latitude = numberOrNull(a.lat) ?? numberOrNull(feature.geometry?.y);
      const longitude = numberOrNull(a.long) ?? numberOrNull(feature.geometry?.x);
      const address = stringOrNull(a.address);
      if (latitude === null || longitude === null || !address ||
        latitude < 50.1 || latitude > 50.65 || longitude < 30.2 || longitude > 30.9) return null;
      const workingHours = stringOrNull(a.working_time);
      const declaredOpen24h = Boolean(workingHours && /цілодобово|24\s*\/\s*7/i.test(workingHours));
      if (!declaredOpen24h) return null;
      const sourceEdited = numberOrNull(a.last_edited_date);
      const sourceEditedDate = sourceEdited === null ? null : new Date(sourceEdited);
      const distanceMeters = calculateDistance(origin, { latitude, longitude });
      if (distanceMeters > 10_000) return null;
      return {
        id: String(a.guid ?? a.globalid ?? a.objectid ?? `${latitude},${longitude}`),
        address,
        district: stringOrNull(a.district),
        shelterType: stringOrNull(a.kind) ?? stringOrNull(a.type),
        buildingType: stringOrNull(a.type_building),
        accessibility: stringOrNull(a.invalid),
        workingHours,
        declaredOpen24h,
        latitude,
        longitude,
        distanceMeters,
        sourceUpdatedAt: sourceEditedDate && Number.isFinite(sourceEditedDate.getTime()) ? sourceEditedDate.toISOString() : null,
      };
    })
    .filter((item): item is KyivShelter => item !== null)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, Math.max(1, Math.min(limit, 10)));
}

/** Read every spatial-query page before ranking; a truncated first page can miss the nearest shelter. */
export async function loadShelterFeatures(
  source: string,
  params: URLSearchParams,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<unknown[]> {
  const features: unknown[] = [];
  const seenPages = new Set<string>();
  for (let page = 0; page < 10; page += 1) {
    signal.throwIfAborted();
    const url = new URL(source);
    params.forEach((value, key) => url.searchParams.set(key, value));
    url.searchParams.set("resultRecordCount", "1000");
    url.searchParams.set("resultOffset", String(features.length));
    url.searchParams.set("orderByFields", "objectid ASC");
    const response = await fetcher(url.toString(), { cache: "no-store", signal });
    if (!response.ok) throw new Error("Shelter source unavailable");
    const value: unknown = await response.json();
    if (!value || typeof value !== "object") throw new Error("Invalid shelter payload");
    const payload = value as { features?: unknown; error?: unknown; exceededTransferLimit?: boolean };
    if (payload.error || !Array.isArray(payload.features)) throw new Error("Invalid shelter payload");
    const fingerprint = JSON.stringify(payload.features);
    if (seenPages.has(fingerprint)) throw new Error("Shelter source ignored pagination");
    seenPages.add(fingerprint);
    features.push(...payload.features);
    if (payload.exceededTransferLimit !== true) return features;
    if (!payload.features.length) throw new Error("Incomplete shelter page");
  }
  throw new Error("Shelter source returned too many pages; refusing a partial nearest result");
}

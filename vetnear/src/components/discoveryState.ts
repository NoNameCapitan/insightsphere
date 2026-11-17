import { filtersFromSearchParams } from "@/lib/geo/discoveryFilters";
import type { FilterState } from "@/lib/types";

export const DISCOVERY_RETURN_KEY = "vetnear:discovery-return";
export const DISCOVERY_RESTORE_KEY = "vetnear:discovery-restore";
export function discoveryFilters(params: URLSearchParams): FilterState {
  return { ...filtersFromSearchParams(params), openNow: params.get("open") === "1", verified: params.get("verified") === "1" };
}
export function discoveryCount(params: URLSearchParams): number {
  const count = Number(params.get("shown"));
  return Number.isInteger(count) && count >= 12 && count <= 504 ? count : 12;
}
/** Only search criteria, never coordinates, pet identifiers, or private notes. */
export function discoveryUrl(filters: FilterState, query: string, shown = 12): string {
  const p = new URLSearchParams();
  if (filters.category !== "all") p.set("category", filters.category);
  if (filters.animal !== "all") p.set("animal", filters.animal);
  if (filters.region && filters.region !== "all") p.set("region", filters.region);
  if (filters.locality) p.set("locality", filters.locality);
  if (filters.district !== "all") p.set("district", filters.district);
  if (filters.radius !== 3000) p.set("radius", String(filters.radius));
  if (filters.openNow) p.set("open", "1");
  if (filters.verified) p.set("verified", "1");
  if (filters.emergency) p.set("emergency", "1");
  if (filters.urgentIntent) p.set("urgent", "1");
  if (filters.sort !== "distance") p.set("sort", filters.sort);
  if (query.trim()) p.set("q", query.trim().slice(0, 150));
  if (shown > 12) p.set("shown", String(Math.min(shown, 504)));
  return `/nearby${p.size ? `?${p}` : ""}`;
}
export function safeDiscoveryReturn(value: unknown): value is { path: string; scroll: number } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.path === "string" && /^\/nearby(?:\?[^#]*)?$/.test(v.path) && v.path.length <= 2000
    && typeof v.scroll === "number" && Number.isFinite(v.scroll) && v.scroll >= 0 && v.scroll <= 100000;
}

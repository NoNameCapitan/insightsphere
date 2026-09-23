import { applyFilters, normalizeFilters } from "./filters";
import { buildLead } from "./leads";
import type { GeoResolution } from "./geo";
import type { RawBusiness, SearchRequest, SearchResponse } from "./types";
export { businessKey } from "./leadIdentity";
export function assembleResults(
  raw: RawBusiness[],
  req: SearchRequest,
  geo: GeoResolution,
  mode: SearchResponse["mode"],
  warning?: string,
): SearchResponse {
  let leads = raw.map((b) =>
    buildLead(b, req.offerType, req.lang, geo.center ?? undefined),
  );
  if (geo.center && !geo.approximate)
    leads = leads.filter(
      (l) => l.distanceKm != null && l.distanceKm <= geo.radiusKm,
    );
  const totalCandidates = leads.length;
  const filtered = applyFilters(leads, normalizeFilters(req.filters ?? {}));
  return {
    mode,
    warning,
    leads: filtered
      .sort((a, b) => b.score.total - a.score.total)
      .slice(0, req.limit),
    totalCandidates,
    afterFilters: filtered.length,
    requestedLimit: req.limit,
    geoNote: geo.note,
    approximate: geo.approximate,
    districtName: geo.districtName,
    radiusKm: geo.radiusKm,
    wholeCity: geo.wholeCity,
    center: geo.center ?? undefined,
  };
}

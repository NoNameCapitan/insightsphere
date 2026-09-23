// Shared filter + sort logic used by BOTH the backend search route and the
// frontend results view, so initial search intent and interactive refinement
// behave identically.

import type { Lead, SearchFilters, SortKey } from "./types";

export function leadPassesFilters(lead: Lead, f: SearchFilters): boolean {
  if (f.noWebsite && lead.hasWebsite) return false;
  if (f.hasWebsite && !lead.hasWebsite) return false;
  if (f.hasPhone && !lead.hasPhone) return false;
  if (f.hotOnly && lead.score.label !== "hot") return false;
  if (f.openNow && lead.isOpenNow !== true) return false;
  if (
    f.needsManualReview &&
    !lead.signals.some((s) =>
      ["needs_manual_review", "website_needs_manual_review"].includes(s.type),
    )
  )
    return false;
  if (f.ratingAbove != null && (lead.rating ?? 0) < f.ratingAbove) return false;
  if (f.ratingBelow != null && (lead.rating ?? 99) > f.ratingBelow)
    return false;
  if (f.minReviews != null && (lead.reviewCount ?? 0) < f.minReviews)
    return false;
  if (f.category && f.category !== "all" && lead.niche !== f.category)
    return false;
  return true;
}

export function applyFilters(leads: Lead[], f: SearchFilters): Lead[] {
  return leads.filter((l) => leadPassesFilters(l, f));
}

export function sortLeads(leads: Lead[], sort: SortKey): Lead[] {
  const out = [...leads];
  switch (sort) {
    case "distance":
      return out.sort(
        (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
      );
    case "rating":
      return out.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case "reviews":
      return out.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    case "missing_website":
      return out.sort((a, b) => {
        if (a.hasWebsite !== b.hasWebsite) return a.hasWebsite ? 1 : -1;
        return b.score.total - a.score.total;
      });
    default:
      return out.sort((a, b) => b.score.total - a.score.total);
  }
}

// Normalize a filter set so impossible combinations can't slip through
// (a lead can't be both with and without a website).
export function normalizeFilters(f: SearchFilters): SearchFilters {
  const out = { ...f };
  if (out.noWebsite && out.hasWebsite) {
    // Prefer the more specific "no website" intent.
    out.hasWebsite = false;
  }
  return out;
}

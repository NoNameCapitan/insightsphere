"use client";
// Places store (Module 4/14). Seed dataset + admin edits + approved partner
// submissions, persisted in localStorage. Reads are SSR-safe.
import { PLACES } from "@/lib/data/places";
import { getApprovedAsPlaces } from "@/lib/partners/store";
import { mergePlaceLayers } from "@/lib/places/publish";
import { readJSON, writeJSON } from "@/lib/storage";
import type { Place } from "@/lib/types";

const KEY = "vetnear:places";

// ── Server-published layer (v1.9) ──────────────────────────────────────────
// Filled once per page load from /api/places/published. Held in module memory:
// it is a cache of public data, not user state, so it must not go to
// localStorage where it would go stale behind a moderation change.
let publishedLayer: Place[] = [];
let hydration: Promise<Place[]> | null = null;

/**
 * Fetch the server-published places and merge them into subsequent getPlaces()
 * calls. Safe to call repeatedly — the request is made once per page load.
 * Resolves to an empty array when the backend is disabled (demo mode).
 */
export function hydratePublishedPlaces(): Promise<Place[]> {
  if (typeof window === "undefined") return Promise.resolve([]);
  if (hydration) return hydration;
  hydration = fetch("/api/places/published")
    .then((r) => (r.ok ? r.json() : { places: [] }))
    .then((body: { places?: unknown }) => {
      publishedLayer = Array.isArray(body.places) ? (body.places as Place[]) : [];
      return publishedLayer;
    })
    .catch(() => {
      // Network failure must not blank the listing: keep the seed layer.
      publishedLayer = [];
      return publishedLayer;
    });
  return hydration;
}

/** Test/SSR seam. */
export function __setPublishedLayer(places: Place[]): void {
  publishedLayer = places;
}

/** All publicly visible places: seed + published + admin/local overrides. */
export function getPlaces(): Place[] {
  const stored = readJSON<Place[] | null>(KEY, null);
  const base = mergePlaceLayers(stored ?? PLACES, publishedLayer);
  const approved = getApprovedAsPlaces();
  // De-dupe by id (approved submissions may already be in the seed in theory).
  const byId = new Map<string, Place>();
  for (const p of [...base, ...approved]) byId.set(p.id, p);
  return [...byId.values()];
}

export function getPlaceBySlug(slug: string): Place | null {
  return getPlaces().find((p) => p.slug === slug || p.id === slug) ?? null;
}

export function savePlaces(places: Place[]): void {
  writeJSON(KEY, places);
}

export function resetPlaces(): void {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
}

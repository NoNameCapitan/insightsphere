"use client";
// Places store (Module 4/14). Seed dataset + admin edits + approved partner
// submissions, persisted in localStorage. Reads are SSR-safe.
import { PLACES } from "@/lib/data/places";
import { getApprovedAsPlaces } from "@/lib/partners/store";
import { readJSON, writeJSON } from "@/lib/storage";
import type { Place } from "@/lib/types";

const KEY = "vetnear:places";

/** All publicly visible places: seed + admin overrides + approved submissions. */
export function getPlaces(): Place[] {
  const stored = readJSON<Place[] | null>(KEY, null);
  const base = stored ?? PLACES;
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

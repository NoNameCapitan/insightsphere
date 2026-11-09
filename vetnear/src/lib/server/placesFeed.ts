// Server-side public places feed (v1.9).
//
// This is the change that makes Supabase the source of truth for the public
// listing: an approved submission is materialised into `published_places` and
// appears in discovery. The bundled seed dataset stays as the zero-config
// baseline, so the app still runs, builds and demos with no env vars at all.
//
// Failure policy: a database problem NEVER blanks the site. On any error we log
// and return the seed layer only.
import "server-only";
import { PLACES } from "@/lib/data/places";
import { isPlaceLike, mergePlaceLayers } from "@/lib/places/publish";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import type { Place, PlaceTier } from "@/lib/types";

export interface PublishedFeed {
  places: Place[];
  source: "seed" | "seed+db";
  publishedCount: number;
}

interface PublishedRow {
  id: string;
  data: unknown;
  tier: string | null;
  promoted_until: string | null;
}

function withCommercialFields(place: Place, row: PublishedRow): Place {
  const tier: PlaceTier =
    row.tier === "promoted" || row.tier === "verified" ? row.tier : "free";
  return { ...place, tier, promotedUntil: row.promoted_until };
}

/** Places published through moderation. Empty array when the backend is off. */
export async function getPublishedPlaces(): Promise<Place[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];

  const { data, error } = await db
    .from("published_places")
    .select("id,data,tier,promoted_until")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(2000);

  if (error) {
    console.error("[placesFeed] published read failed:", error.message);
    return [];
  }

  const out: Place[] = [];
  for (const row of (data ?? []) as PublishedRow[]) {
    // Rows are validated on the way out: a malformed payload is skipped, not
    // rendered. The public feed must never crash on one bad record.
    if (!isPlaceLike(row.data)) {
      console.warn("[placesFeed] skipped malformed published row:", row.id);
      continue;
    }
    out.push(withCommercialFields(row.data, row));
  }
  return out;
}

/** Seed + published, de-duplicated. The canonical server-side public list. */
export async function getPublicPlaces(): Promise<PublishedFeed> {
  const published = await getPublishedPlaces();
  return {
    places: mergePlaceLayers(PLACES, published),
    source: published.length ? "seed+db" : "seed",
    publishedCount: published.length,
  };
}

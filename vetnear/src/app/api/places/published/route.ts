import { NextResponse } from "next/server";
import { getPublishedPlaces } from "@/lib/server/placesFeed";

export const runtime = "nodejs";
export const revalidate = 60;

/**
 * GET /api/places/published
 *
 * Returns ONLY the server-published layer. The client already ships the seed
 * dataset in its bundle, so sending the merged list would duplicate ~64 records
 * on every load. The client merges the two layers (see lib/store.ts).
 *
 * Returns an empty list (200, not 503) when the backend is disabled, so callers
 * need no conditional logic and demo mode stays unbroken.
 */
export async function GET(): Promise<Response> {
  const places = await getPublishedPlaces();
  return NextResponse.json(
    { places, count: places.length },
    {
      headers: {
        // Short public cache: a newly approved place appears within a minute.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}

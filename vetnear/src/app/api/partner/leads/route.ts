import { NextResponse } from "next/server";
import { aggregateLeadEvents, countBillableLeads } from "@/lib/places/leads";
import { authenticateModerator } from "@/lib/server/moderatorAuth";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RANGE_DAYS = 90;
const DEFAULT_RANGE_DAYS = 30;

/**
 * GET /api/partner/leads?placeId=...&days=30
 *
 * Real lead counts for one place — the number that turns this listing into a
 * priced product. Moderator-authenticated for now; a partner-scoped token is
 * the next step once partner accounts exist (see docs/MONETIZATION.md).
 */
export async function GET(req: Request): Promise<Response> {
  const identity = await authenticateModerator(req);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Backend disabled" }, { status: 503 });

  const url = new URL(req.url);
  const placeId = url.searchParams.get("placeId")?.trim() ?? "";
  if (!placeId) {
    return NextResponse.json({ error: "placeId is required" }, { status: 422 });
  }

  const requested = Number(url.searchParams.get("days"));
  const days =
    Number.isFinite(requested) && requested > 0
      ? Math.min(Math.floor(requested), MAX_RANGE_DAYS)
      : DEFAULT_RANGE_DAYS;

  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data, error } = await db
    .from("place_lead_events")
    .select("place_id,event_type,created_at")
    .eq("place_id", placeId)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(10_000);

  if (error) {
    console.error("[api/partner/leads] read failed:", error.message);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }

  const summary = aggregateLeadEvents(data ?? [], placeId, days);
  return NextResponse.json({
    summary,
    billableLeads: countBillableLeads(summary),
  });
}

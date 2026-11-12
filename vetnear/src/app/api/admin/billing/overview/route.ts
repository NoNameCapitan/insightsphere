import { NextResponse } from "next/server";
import { authenticateModerator, requireRole } from "@/lib/server/moderatorAuth";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLACE_FIELDS = "id,slug,tier,subscription_status,billing_provider,billing_plan_code,prepaid_until,promoted_until,last_payment_at,tier_changed_at";

/**
 * GET /api/admin/billing/overview?placeId=…&days=7
 * Everything an admin needs on one screen: paid places whose period ends
 * within `days`, and — for one place — its current plan, payments and history.
 */
export async function GET(req: Request): Promise<Response> {
  const identity = await authenticateModerator(req);
  if (!identity || !requireRole(identity, "admin")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Backend disabled" }, { status: 503 });

  const url = new URL(req.url);
  const placeId = (url.searchParams.get("placeId") ?? "").trim().slice(0, 120);
  const days = Math.min(60, Math.max(1, Number(url.searchParams.get("days")) || 7));
  const until = new Date(Date.now() + days * 86_400_000).toISOString();

  const expiring = await db
    .from("published_places")
    .select(PLACE_FIELDS)
    .neq("tier", "free")
    .not("prepaid_until", "is", null)
    .lte("prepaid_until", until)
    .order("prepaid_until", { ascending: true })
    .limit(100);
  if (expiring.error) {
    console.error("[api/admin/billing/overview] expiring failed:", expiring.error.message);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }

  if (!placeId) return NextResponse.json({ days, expiring: expiring.data ?? [], place: null, events: [], payments: [] });

  const [place, events, payments] = await Promise.all([
    db.from("published_places").select(PLACE_FIELDS).eq("id", placeId).maybeSingle(),
    db.from("place_tier_events").select("id,from_tier,to_tier,promoted_until,subscription_status,reason,plan_code,payment_id,actor_id,note,created_at").eq("place_id", placeId).order("created_at", { ascending: false }).limit(50),
    db.from("billing_payments").select("id,plan_code,tier,months,amount_uah,provider,provider_payment_id,period_start,period_end,actor_id,note,created_at").eq("place_id", placeId).order("created_at", { ascending: false }).limit(50),
  ]);
  const failed = place.error ?? events.error ?? payments.error;
  if (failed) {
    console.error("[api/admin/billing/overview] read failed:", failed.message);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
  return NextResponse.json({ days, expiring: expiring.data ?? [], place: place.data ?? null, events: events.data ?? [], payments: payments.data ?? [] });
}

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/server/requestBody";
import { VERTICAL } from "@/config/verticals/pet-care-kyiv";
import { planTierChange } from "@/lib/places/billing";
import { authenticateModerator, requireRole } from "@/lib/server/moderatorAuth";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PROMOTION_DAYS = VERTICAL.monetization.maxPromotionDays;

/**
 * POST /api/admin/places/tier — { placeId, tier, promotedDays?, subscriptionStatus?, note? }
 *
 * Admin-only: this is the billing lever (and, until a payment provider is
 * connected, the only one). A `promoted` tier without an explicit end date is
 * rejected. Every change is appended to `place_tier_events`.
 */
export async function POST(req: Request): Promise<Response> {
  const identity = await authenticateModerator(req);
  if (!identity || !requireRole(identity, "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Backend disabled" }, { status: 503 });

  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }
  const body = (parsedBody.value && typeof parsedBody.value === "object" ? parsedBody.value : {}) as Record<string, unknown>;

  const placeId = typeof body.placeId === "string" ? body.placeId.trim().slice(0, 120) : "";
  const plan = planTierChange(body, MAX_PROMOTION_DAYS);
  if (!placeId || !plan.ok) {
    return NextResponse.json(
      { error: !placeId ? "placeId and a valid tier are required" : plan.ok ? "invalid" : plan.error },
      { status: 422 },
    );
  }
  const { tier, promotedUntil, subscriptionStatus, billingProvider, note } = plan.change;
  const now = new Date().toISOString();

  const { data: current, error: readError } = await db
    .from("published_places")
    .select("id,tier")
    .eq("id", placeId)
    .maybeSingle();
  if (readError) {
    console.error("[api/admin/places/tier] read failed:", readError.message);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
  if (!current) return NextResponse.json({ error: "Place not found" }, { status: 404 });

  const { error } = await db
    .from("published_places")
    .update({
      tier,
      promoted_until: promotedUntil,
      subscription_status: subscriptionStatus,
      billing_provider: billingProvider,
      // A hand-set tier is not a paid period: the prepaid markers are cleared,
      // so the expiry job never acts on (or revives) a stale date.
      prepaid_until: null,
      billing_plan_code: null,
      tier_changed_at: now,
      updated_at: now,
    })
    .eq("id", placeId);

  if (error) {
    console.error("[api/admin/places/tier] update failed:", error.message);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }

  const { error: historyError } = await db.from("place_tier_events").insert({
    id: `tier_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`,
    place_id: placeId,
    from_tier: (current as { tier?: string }).tier ?? null,
    to_tier: tier,
    promoted_until: promotedUntil,
    subscription_status: subscriptionStatus,
    billing_provider: billingProvider,
    actor_id: identity.actorId,
    note,
    reason: "admin",
    created_at: now,
  });
  if (historyError) console.error("[api/admin/places/tier] history insert failed:", historyError.message);

  return NextResponse.json({
    ok: true,
    placeId,
    tier,
    promotedUntil,
    subscriptionStatus,
    historyRecorded: !historyError,
  });
}

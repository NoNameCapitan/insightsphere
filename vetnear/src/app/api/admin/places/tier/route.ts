import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/server/requestBody";
import { VERTICAL } from "@/config/verticals/pet-care-kyiv";
import { authenticateModerator, requireRole } from "@/lib/server/moderatorAuth";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import type { PlaceTier } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIERS: PlaceTier[] = ["free", "verified", "promoted"];
const MAX_PROMOTION_DAYS = VERTICAL.monetization.maxPromotionDays;

/**
 * POST /api/admin/places/tier — { placeId, tier, promotedDays? }
 *
 * Admin-only: this is the billing lever. A `promoted` tier without an explicit
 * end date is rejected — an unbounded paid boost is exactly the thing that
 * silently rots a directory's ranking honesty.
 */
export async function POST(req: Request): Promise<Response> {
  const identity = await authenticateModerator(req);
  if (!requireRole(identity, "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Backend disabled" }, { status: 503 });

  let body: { placeId?: unknown; tier?: unknown; promotedDays?: unknown };
  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }
  body = (parsedBody.value && typeof parsedBody.value === "object" ? parsedBody.value : {}) as { placeId?: unknown; tier?: unknown; promotedDays?: unknown };

  const placeId = typeof body.placeId === "string" ? body.placeId.trim().slice(0, 120) : "";
  const tier = body.tier as PlaceTier;
  if (!placeId || !TIERS.includes(tier)) {
    return NextResponse.json(
      { error: "placeId and a valid tier are required" },
      { status: 422 },
    );
  }

  let promotedUntil: string | null = null;
  if (tier === "promoted") {
    const days = Number(body.promotedDays);
    if (!Number.isInteger(days) || days <= 0 || days > MAX_PROMOTION_DAYS) {
      return NextResponse.json(
        { error: `promotedDays must be 1..${MAX_PROMOTION_DAYS}` },
        { status: 422 },
      );
    }
    promotedUntil = new Date(Date.now() + days * 86_400_000).toISOString();
  }

  const { error } = await db
    .from("published_places")
    .update({ tier, promoted_until: promotedUntil, updated_at: new Date().toISOString() })
    .eq("id", placeId);

  if (error) {
    console.error("[api/admin/places/tier] update failed:", error.message);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, placeId, tier, promotedUntil });
}

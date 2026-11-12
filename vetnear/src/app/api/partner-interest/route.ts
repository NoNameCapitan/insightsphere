import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { sanitizePartnerInterest } from "@/lib/places/billing";
import { clientKeyFromRequest, createServerRateLimiter } from "@/lib/security/serverRateLimit";
import { readJsonBody } from "@/lib/server/requestBody";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public write endpoint: 4 requests / 10 min / IP.
const limit = createServerRateLimiter({ namespace: "partner-interest", limit: 4, windowMs: 10 * 60_000 });

/**
 * POST /api/partner-interest — { placeName, phone, email, plan, note? }
 * A sales lead for a paid tier. It changes nothing on the listing: a person
 * calls back, and only an admin can set a tier.
 */
export async function POST(req: Request): Promise<Response> {
  const rl = await limit(clientKeyFromRequest(req));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Забагато запитів. Спробуйте пізніше." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, backend: "disabled" }, { status: 503 });

  const body = await readJsonBody(req, 4096);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const parsed = sanitizePartnerInterest(body.value);
  if (!parsed.ok) return NextResponse.json({ error: "Validation failed", details: parsed.errors }, { status: 422 });

  const { error } = await db.from("partner_interest").insert({
    id: `int_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`,
    place_name: parsed.value.placeName,
    phone: parsed.value.phone,
    email: parsed.value.email,
    plan: parsed.value.plan,
    note: parsed.value.note,
  });
  if (error) {
    console.error("[api/partner-interest] insert failed:", error.message);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

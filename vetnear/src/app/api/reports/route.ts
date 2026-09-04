import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { sanitizeReportInput } from "@/lib/server/submissionValidation";
import {
  clientKeyFromRequest,
  createServerRateLimiter,
} from "@/lib/security/serverRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limit = createServerRateLimiter({ limit: 10, windowMs: 10 * 60_000 });

export async function POST(req: Request): Promise<Response> {
  const rl = limit(clientKeyFromRequest(req));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Забагато повідомлень. Спробуйте пізніше." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, backend: "disabled" }, { status: 503 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = sanitizeReportInput(body);
  if (!parsed.ok || !parsed.value) {
    return NextResponse.json({ error: "Validation failed", details: parsed.errors }, { status: 422 });
  }

  const id = `rep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await db.from("place_reports").insert({
    id,
    place_id: parsed.value.placeId,
    reason: parsed.value.reason,
    message: parsed.value.message ?? null,
  });
  if (error) {
    console.error("[api/reports] insert failed:", error.message);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id }, { status: 201 });
}

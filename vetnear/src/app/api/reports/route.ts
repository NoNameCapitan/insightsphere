import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/server/requestBody";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { sanitizeReportInput } from "@/lib/server/submissionValidation";
import {
  clientKeyFromRequest,
  createServerRateLimiter,
} from "@/lib/security/serverRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limit = createServerRateLimiter({ namespace: "reports", limit: 10, windowMs: 10 * 60_000 });

export async function POST(req: Request): Promise<Response> {
  const rl = await limit(clientKeyFromRequest(req));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Забагато повідомлень. Спробуйте пізніше." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, backend: "disabled" }, { status: 503 });

  let body: unknown;
  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }
  body = parsedBody.value;

  const parsed = sanitizeReportInput(body);
  if (!parsed.ok || !parsed.value) {
    return NextResponse.json({ error: "Validation failed", details: parsed.errors }, { status: 422 });
  }

  const id = `rep_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`;
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

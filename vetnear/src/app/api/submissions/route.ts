import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { sanitizeSubmissionInput } from "@/lib/server/submissionValidation";
import {
  clientKeyFromRequest,
  createServerRateLimiter,
} from "@/lib/security/serverRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public write endpoint => strict limit: 5 submissions / 10 min / IP.
const limit = createServerRateLimiter({ limit: 5, windowMs: 10 * 60_000 });

export async function POST(req: Request): Promise<Response> {
  const rl = limit(clientKeyFromRequest(req));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Забагато заявок. Спробуйте пізніше." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const db = getSupabaseAdmin();
  if (!db) {
    // Backend not configured — client keeps its localStorage copy (demo mode).
    return NextResponse.json({ ok: false, backend: "disabled" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = sanitizeSubmissionInput(body);
  if (!parsed.ok || !parsed.value) {
    return NextResponse.json({ error: "Validation failed", details: parsed.errors }, { status: 422 });
  }

  const now = new Date().toISOString();
  const id = `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const submission = { ...parsed.value, id, createdAt: now, updatedAt: now };

  const { error } = await db.from("partner_submissions").insert({
    id,
    status: submission.status,
    category: submission.category,
    district: submission.district,
    name: submission.name,
    data: submission,
    created_at: now,
    updated_at: now,
  });
  if (error) {
    console.error("[api/submissions] insert failed:", error.message);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id, status: submission.status }, { status: 201 });
}

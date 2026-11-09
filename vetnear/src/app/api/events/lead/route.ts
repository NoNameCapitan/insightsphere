import { NextResponse } from "next/server";
import {
  leadEventId,
  parseLeadEvent,
  sessionHash,
} from "@/lib/places/leads";
import {
  clientKeyFromRequest,
  createServerRateLimiter,
} from "@/lib/security/serverRateLimit";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Generous but bounded: a real visitor taps a handful of actions per minute.
const limiter = createServerRateLimiter({ limit: 40, windowMs: 60_000 });

/** Salt for the day-rotating session digest. Falls back to a process-local
 *  value, which is still fine: it only weakens de-duplication, never privacy. */
const SALT =
  process.env.LEAD_HASH_SALT ??
  process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 24) ??
  "vetnear-local-salt";

/**
 * POST /api/events/lead — record an outbound intent action on a place.
 * Body: { placeId, eventType, sourcePath? }
 *
 * Always answers 204 on success, including when the backend is disabled, so the
 * client can fire this unconditionally (sendBeacon cannot branch on config).
 */
export async function POST(req: Request): Promise<Response> {
  const key = clientKeyFromRequest(req);
  const rl = limiter(key);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseLeadEvent(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 422 });
  }

  const db = getSupabaseAdmin();
  if (!db) return new Response(null, { status: 204 }); // demo mode: accept, drop.

  const { error } = await db.from("place_lead_events").insert({
    id: leadEventId(),
    place_id: parsed.value.placeId,
    event_type: parsed.value.eventType,
    // Raw client key never leaves this function un-hashed.
    session_hash: sessionHash(key, SALT),
    source_path: parsed.value.sourcePath ?? null,
  });

  // A duplicate (same place+type+session+day) hits the unique index. That is the
  // de-duplication working as designed, not a failure.
  if (error && !error.message.includes("duplicate")) {
    console.error("[api/events/lead] insert failed:", error.message);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}

import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/server/requestBody";
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
const limiter = createServerRateLimiter({ namespace: "lead-events", limit: 40, windowMs: 60_000 });

/** Salt for the day-rotating session digest. Falls back to a process-local
 *  value, which is still fine: it only weakens de-duplication, never privacy. */
const SALT =
  process.env.LEAD_HASH_SALT ??
  // NOTE: never slice the key itself: the first chars of a JWT are its public,
  // constant header, which made the "salt" guessable and the IP hash reversible.
  (process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createHash("sha256").update(`lead-salt:${process.env.SUPABASE_SERVICE_ROLE_KEY}`).digest("hex")
    : randomBytes(16).toString("hex"));

/**
 * POST /api/events/lead — record an outbound intent action on a place.
 * Body: { placeId, eventType, sourcePath? }
 *
 * A storage receipt is returned only after insertion or a duplicate.
 * Disabled/demo mode explicitly reports recorded:false.
 */
export async function POST(req: Request): Promise<Response> {
  if (process.env.MEASUREMENT_ENABLED !== "1") return NextResponse.json({ recorded: false, reason: "disabled" }, { status: 202, headers: { "Cache-Control": "no-store" } });
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const key = clientKeyFromRequest(req);
  const rl = await limiter(key);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }
  body = parsedBody.value;

  const parsed = parseLeadEvent(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 422 });
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ recorded: false, reason: "storage_unavailable" }, { status: 503 });

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
  if (error && error.code !== "23505") {
    console.error("[api/events/lead] insert failed:", error.message);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }

  return NextResponse.json({ recorded: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

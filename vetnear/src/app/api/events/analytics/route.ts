import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { readJsonBody } from "@/lib/server/requestBody";
import { clientKeyFromRequest, createServerRateLimiter } from "@/lib/security/serverRateLimit";
import { campaignCodes, parseMeasurement } from "@/lib/measurement/schema";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const limiter = createServerRateLimiter({ namespace: "launch-measurement", limit: 90, windowMs: 60_000 });
const fallbackSalt = randomBytes(32).toString("hex");
export async function POST(req: Request): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  if (process.env.MEASUREMENT_ENABLED !== "1") return NextResponse.json({ recorded: false, reason: "disabled" }, { status: 202, headers });
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403, headers });
  const rate = await limiter(clientKeyFromRequest(req));
  if (!rate.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers });
  const body = await readJsonBody(req); if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers });
  const event = parseMeasurement(body.value, campaignCodes(process.env.MEASUREMENT_CAMPAIGN_CODES));
  if (!event) return NextResponse.json({ error: "Invalid event" }, { status: 422, headers });
  const db = getSupabaseAdmin(); if (!db) return NextResponse.json({ recorded: false, reason: "storage_unavailable" }, { status: 503, headers });
  const day = new Date().toISOString().slice(0, 10);
  const session = createHash("sha256").update(`${day}:${process.env.LEAD_HASH_SALT || fallbackSalt}:${event.sessionId}`).digest("hex").slice(0, 32);
  const { error } = await db.from("launch_events").upsert({ id: event.id, event_name: event.name, session_hash: session, route_group: event.route, props: event.props, campaign: event.campaign }, { onConflict: "id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ recorded: false, reason: "storage_error" }, { status: 503, headers });
  return NextResponse.json({ recorded: true, id: event.id }, { status: 201, headers });
}

import { NextResponse } from "next/server";
import { authenticateModerator, requireRole } from "@/lib/server/moderatorAuth";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { summarizeMeasurement, type MeasurementRow } from "@/lib/measurement/schema";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store" };
  const actor = await authenticateModerator(req);
  if (!requireRole(actor, "admin")) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const db = getSupabaseAdmin(); if (!db) return NextResponse.json({ error: "Storage unavailable" }, { status: 503, headers });
  const value = Number(new URL(req.url).searchParams.get("days"));
  const days = Number.isFinite(value) && value > 0 ? Math.min(90, Math.floor(value)) : 7;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error, count } = await db.from("launch_events").select("event_name,session_hash,props,campaign,created_at", { count: "exact" }).gte("created_at", since).order("created_at", { ascending: false }).limit(10001);
  if (error) return NextResponse.json({ error: "Storage error" }, { status: 503, headers });
  const rows = (data ?? []) as MeasurementRow[];
  return NextResponse.json({ ...summarizeMeasurement(rows.slice(0, 10000)), days, sampleSize: Math.min(rows.length, 10000), totalEvents: count ?? null, truncated: typeof count === "number" ? count > Math.min(rows.length, 10000) : rows.length >= 1000, enabled: process.env.MEASUREMENT_ENABLED === "1", generatedAt: new Date().toISOString() }, { headers });
}

import { NextResponse } from "next/server";
import { deactivateExpiredPlans } from "@/lib/server/billing/service";
import { authenticateModerator, requireRole } from "@/lib/server/moderatorAuth";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/admin/billing/expire — run the expiry now (it also runs daily in the database). */
export async function POST(req: Request): Promise<Response> {
  const identity = await authenticateModerator(req);
  if (!identity || !requireRole(identity, "admin")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Backend disabled" }, { status: 503 });
  const result = await deactivateExpiredPlans(db);
  return result.ok ? NextResponse.json(result) : NextResponse.json({ error: result.error }, { status: 500 });
}

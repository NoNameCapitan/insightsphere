import { NextResponse } from "next/server";
import { authenticateModerator, requireRole } from "@/lib/server/moderatorAuth";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/partner-interest → latest paid-tier requests (admin only). */
export async function GET(req: Request): Promise<Response> {
  const identity = await authenticateModerator(req);
  if (!identity || !requireRole(identity, "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Backend disabled" }, { status: 503 });

  const { data, error } = await db
    .from("partner_interest")
    .select("id,place_name,phone,email,plan,note,status,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("[api/admin/partner-interest] list failed:", error.message);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

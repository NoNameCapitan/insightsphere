import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/server/adminAuth";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/reports — latest "incorrect info" reports. */
export async function GET(req: Request): Promise<Response> {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Backend disabled" }, { status: 503 });

  const { data, error } = await db
    .from("place_reports")
    .select("id,place_id,reason,message,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[api/admin/reports] list failed:", error.message);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
  return NextResponse.json({
    reports: (data ?? []).map((r) => ({
      id: r.id,
      placeId: r.place_id,
      reason: r.reason,
      message: r.message ?? undefined,
      createdAt: r.created_at,
    })),
  });
}

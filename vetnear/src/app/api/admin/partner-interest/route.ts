import { NextResponse } from "next/server";
import { authenticateModerator, requireRole } from "@/lib/server/moderatorAuth";
import { readJsonBody } from "@/lib/server/requestBody";
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

const STATUSES = ["new", "contacted", "won", "lost"];

/** PATCH /api/admin/partner-interest — { id, status } */
export async function PATCH(req: Request): Promise<Response> {
  const identity = await authenticateModerator(req);
  if (!identity || !requireRole(identity, "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Backend disabled" }, { status: 503 });
  const body = await readJsonBody(req, 1024);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const input = (body.value && typeof body.value === "object" ? body.value : {}) as { id?: unknown; status?: unknown };
  const id = typeof input.id === "string" ? input.id.slice(0, 80) : "";
  if (!id || typeof input.status !== "string" || !STATUSES.includes(input.status)) {
    return NextResponse.json({ error: "id and a valid status are required" }, { status: 422 });
  }
  const { error } = await db.from("partner_interest").update({ status: input.status }).eq("id", id);
  if (error) {
    console.error("[api/admin/partner-interest] update failed:", error.message);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

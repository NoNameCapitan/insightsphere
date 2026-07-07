import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/server/adminAuth";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { isModerationStatus } from "@/lib/server/submissionValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/submissions — moderation queue (server source of truth). */
export async function GET(req: Request): Promise<Response> {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Backend disabled" }, { status: 503 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  let q = db
    .from("partner_submissions")
    .select("id,status,data,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) {
    console.error("[api/admin/submissions] list failed:", error.message);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
  return NextResponse.json({
    submissions: (data ?? []).map((row) => ({ ...row.data, status: row.status })),
  });
}

/** POST /api/admin/submissions — { id, status, reason? } status change + moderation event. */
export async function POST(req: Request): Promise<Response> {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Backend disabled" }, { status: 503 });

  let body: { id?: unknown; status?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id || !isModerationStatus(body.status)) {
    return NextResponse.json({ error: "id and valid status are required" }, { status: 422 });
  }
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : undefined;
  const now = new Date().toISOString();

  // Load, patch the JSON payload too (status lives in both places by design).
  const { data: rows, error: readErr } = await db
    .from("partner_submissions").select("data").eq("id", id).limit(1);
  if (readErr || !rows?.length) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }
  const patched = { ...(rows[0].data as object), status: body.status, updatedAt: now };

  const { error: updErr } = await db
    .from("partner_submissions")
    .update({ status: body.status, data: patched, updated_at: now })
    .eq("id", id);
  if (updErr) {
    console.error("[api/admin/submissions] update failed:", updErr.message);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }

  const action =
    body.status === "approved" ? "approved"
    : body.status === "rejected" ? "rejected"
    : body.status === "suspended" ? "suspended"
    : "requested_changes";
  await db.from("moderation_events").insert({
    id: `mod_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    submission_id: id,
    action,
    reason: reason ?? null,
    actor_role: "moderator",
  });

  return NextResponse.json({ ok: true, id, status: body.status });
}

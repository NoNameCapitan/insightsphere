import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/server/requestBody";
import { submissionToPlace } from "@/lib/places/publish";
import { authenticateModerator } from "@/lib/server/moderatorAuth";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { isModerationStatus } from "@/lib/server/submissionValidation";
import type { PartnerSubmission } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/submissions — moderation queue (server source of truth). */
export async function GET(req: Request): Promise<Response> {
  const identity = await authenticateModerator(req);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Backend disabled" }, { status: 503 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  let q = db
    .from("partner_submissions")
    .select("id,status,data,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) {
    if (!isModerationStatus(status)) return NextResponse.json({ error: "invalid status" }, { status: 422 });
    q = q.eq("status", status);
  }

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
  const identity = await authenticateModerator(req);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Backend disabled" }, { status: 503 });

  let body: { id?: unknown; status?: unknown; reason?: unknown };
  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }
  body = (parsedBody.value && typeof parsedBody.value === "object" ? parsedBody.value : {}) as { id?: unknown; status?: unknown; reason?: unknown };
  const id = typeof body.id === "string" ? body.id.trim().slice(0, 120) : "";
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
  const { error: auditErr } = await db.from("moderation_events").insert({
    id: `mod_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`,
    submission_id: id,
    action,
    reason: reason ?? null,
    actor_role: identity.role,
    actor_id: identity.actorId,
  });
  if (auditErr) console.error("[api/admin/submissions] audit insert failed:", auditErr.message);

  // ── Publish / unpublish the public listing ────────────────────────────────
  // This is the step that was missing until v1.9: approval used to stop at the
  // moderation queue, so a server-approved place never reached real users.
  let published: { ok: boolean; reason?: string } = { ok: false, reason: "not_applicable" };

  if (body.status === "approved") {
    const submission = patched as unknown as PartnerSubmission;
    const mapped = submissionToPlace(submission, { actorId: identity.actorId });
    if (!mapped.ok) {
      published = { ok: false, reason: mapped.reason };
    } else {
      const { error: pubErr } = await db.from("published_places").upsert(
        {
          id: mapped.place.id,
          slug: mapped.place.slug,
          data: mapped.place,
          status: "published",
          source_submission_id: id,
          updated_at: now,
        },
        { onConflict: "id" },
      );
      if (pubErr) {
        // The status change already succeeded; report the publish failure
        // instead of silently pretending the place is live.
        console.error("[api/admin/submissions] publish failed:", pubErr.message);
        published = { ok: false, reason: "publish_failed" };
      } else {
        published = { ok: true };
      }
    }
  } else {
    // ANY non-approved status (incl. changes_requested / pending_review) must
    // take the listing out of the public feed. Previously only rejected/
    // suspended did, so a place sent back for changes stayed public.
    // Withdrawing approval must remove the listing from the public feed.
    const { error: unpubErr } = await db
      .from("published_places")
      .update({ status: "unpublished", updated_at: now })
      .eq("id", id);
    if (unpubErr) console.error("[api/admin/submissions] unpublish failed:", unpubErr.message);
    published = { ok: !unpubErr, reason: "unpublished" };
  }

  return NextResponse.json({ ok: true, id, status: body.status, published });
}

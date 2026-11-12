import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/auth/shared";
import { MAX_PET_BODY_BYTES, isValidPetId, petToRow, rowToPet, sanitizePet, type PetRow } from "@/lib/pets/cloudModel";
import { createServerRateLimiter } from "@/lib/security/serverRateLimit";
import { readJsonBody } from "@/lib/server/requestBody";
import { getUserClient, getUserSession, isAuthConfigured, withSession } from "@/lib/server/userAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-user write budget: generous for real use, tight for a script.
const writes = createServerRateLimiter({ namespace: "pets-write", limit: 60, windowMs: 10 * 60_000 });

type Context = { params: Promise<{ id: string }> };

async function authorize(req: Request) {
  if (!isAuthConfigured()) return { error: NextResponse.json({ error: "Accounts disabled" }, { status: 503 }) };
  if (!isSameOriginRequest(req)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const session = await getUserSession(req);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const rl = await writes(`user:${session.user.id}`);
  if (!rl.allowed) {
    return { error: NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }) };
  }
  return { session };
}

/** PUT /api/pets/:id — creates or replaces one of the user's own pet cards. */
export async function PUT(req: Request, ctx: Context): Promise<Response> {
  const { id } = await ctx.params;
  if (!isValidPetId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 422 });
  const auth = await authorize(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  const body = await readJsonBody(req, MAX_PET_BODY_BYTES);
  if (!body.ok) return withSession(NextResponse.json({ error: body.error }, { status: body.status }), session);
  const clean = sanitizePet((body.value as { pet?: unknown } | null)?.pet, id);
  if (!clean.ok) return withSession(NextResponse.json({ error: clean.error }, { status: 422 }), session);

  // owner_id is set explicitly from the verified session; RLS re-checks it.
  const db = getUserClient(session.accessToken)!;
  const { data, error } = await db
    .from("pets")
    .upsert({ ...petToRow(clean.pet), owner_id: session.user.id }, { onConflict: "owner_id,id" })
    .select("*")
    .single();
  if (error) {
    const limit = /pet limit reached/i.test(error.message);
    if (!limit) console.error("[api/pets] save failed:", error.message);
    return withSession(
      NextResponse.json({ error: limit ? "Pet limit reached" : "Storage error" }, { status: limit ? 409 : 500 }),
      session,
    );
  }
  return withSession(NextResponse.json({ pet: rowToPet(data as PetRow) }), session);
}

/** DELETE /api/pets/:id — removes one of the user's own pet cards. */
export async function DELETE(req: Request, ctx: Context): Promise<Response> {
  const { id } = await ctx.params;
  if (!isValidPetId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 422 });
  const auth = await authorize(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  const db = getUserClient(session.accessToken)!;
  const { error } = await db.from("pets").delete().eq("id", id);
  if (error) {
    console.error("[api/pets] delete failed:", error.message);
    return withSession(NextResponse.json({ error: "Storage error" }, { status: 500 }), session);
  }
  return withSession(NextResponse.json({ ok: true }), session);
}

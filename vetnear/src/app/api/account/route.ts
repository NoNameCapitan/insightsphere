import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/auth/shared";
import { createServerRateLimiter } from "@/lib/security/serverRateLimit";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { clearSessionCookies, getUserSession, isAuthConfigured } from "@/lib/server/userAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limit = createServerRateLimiter({ namespace: "account-delete", limit: 3, windowMs: 60 * 60_000 });

/**
 * DELETE /api/account — permanently deletes the signed-in user and, through
 * the foreign key, every pet card they own. The service role is used only
 * after the session has been verified, and only for that user's own id.
 */
export async function DELETE(req: Request): Promise<Response> {
  if (!isAuthConfigured()) return NextResponse.json({ error: "Accounts disabled" }, { status: 503 });
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const session = await getUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await limit(`user:${session.user.id}`);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Backend disabled" }, { status: 503 });
  // The client validates its input and can throw, not only return an error.
  const failure = await admin.auth.admin
    .deleteUser(session.user.id)
    .then(({ error }) => error?.message ?? null)
    .catch((cause: unknown) => (cause instanceof Error ? cause.message : "delete failed"));
  if (failure) {
    console.error("[api/account] delete failed:", failure);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

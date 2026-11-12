import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/auth/shared";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { ACCESS_COOKIE, clearSessionCookies, readCookie } from "@/lib/server/userAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/sign-out — clears the cookies and revokes the session. */
export async function POST(req: Request): Promise<Response> {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const accessToken = readCookie(req, ACCESS_COOKIE);
  const admin = getSupabaseAdmin();
  if (accessToken && admin) {
    // Best effort: the cookies are cleared either way.
    await admin.auth.admin.signOut(accessToken, "local").catch(() => {});
  }
  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

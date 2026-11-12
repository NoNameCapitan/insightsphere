import { NextResponse } from "next/server";
import { isSameOriginRequest, safeNextPath } from "@/lib/auth/shared";
import { readJsonBody } from "@/lib/server/requestBody";
import {
  NEXT_COOKIE,
  getAuthClient,
  getUserSession,
  isAuthConfigured,
  readCookie,
  sessionCookieOptions,
  setSessionCookies,
  withSession,
} from "@/lib/server/userAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/auth/session → { configured, user } (never cached). */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthConfigured()) {
    return withSession(NextResponse.json({ configured: false, user: null }), null);
  }
  const session = await getUserSession(req);
  return withSession(NextResponse.json({ configured: true, user: session?.user ?? null }), session);
}

/**
 * POST /api/auth/session — { accessToken, refreshToken }
 * Completes sign-in for the default Supabase e-mail link, which returns the
 * tokens in the URL fragment. The tokens are verified with Supabase before
 * any cookie is set, then kept only in httpOnly cookies.
 */
export async function POST(req: Request): Promise<Response> {
  const auth = getAuthClient();
  if (!auth) return NextResponse.json({ error: "config" }, { status: 503 });
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await readJsonBody(req, 8192);
  if (!body.ok) return NextResponse.json({ error: "invalid" }, { status: body.status });
  const input = (body.value && typeof body.value === "object" ? body.value : {}) as Record<string, unknown>;
  const accessToken = typeof input.accessToken === "string" ? input.accessToken : "";
  const refreshToken = typeof input.refreshToken === "string" ? input.refreshToken : "";
  if (!accessToken || !refreshToken || accessToken.length > 4096 || refreshToken.length > 512) {
    return NextResponse.json({ error: "invalid" }, { status: 422 });
  }

  const { data, error } = await auth.auth.getUser(accessToken);
  if (error || !data.user) return NextResponse.json({ error: "expired" }, { status: 401 });

  const next = safeNextPath(readCookie(req, NEXT_COOKIE));
  const res = NextResponse.json({ ok: true, next, user: { id: data.user.id, email: data.user.email ?? null } });
  setSessionCookies(res, { accessToken, refreshToken, expiresIn: 3600 });
  res.cookies.set(NEXT_COOKIE, "", sessionCookieOptions(0));
  res.headers.set("Cache-Control", "no-store");
  return res;
}

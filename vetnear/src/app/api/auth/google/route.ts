import { NextResponse } from "next/server";
import { PKCE_COOKIE, buildGoogleAuthorizeUrl, createPkcePair } from "@/lib/auth/oauth";
import { safeNextPath } from "@/lib/auth/shared";
import { clientKeyFromRequest, createServerRateLimiter } from "@/lib/security/serverRateLimit";
import { NEXT_COOKIE, isAuthConfigured, isGoogleEnabled, sessionCookieOptions } from "@/lib/server/userAuth";
import { SITE } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limit = createServerRateLimiter({ namespace: "auth-google", limit: 20, windowMs: 10 * 60_000 });

/**
 * GET /api/auth/google?next=/my-pets
 * Starts Google sign-in: stores a fresh PKCE verifier in an httpOnly cookie and
 * sends the browser to Supabase, which hands over to Google. It is a plain
 * top-level navigation — no popup to block or close.
 */
export async function GET(req: Request): Promise<Response> {
  const back = (code: string) => {
    const res = NextResponse.redirect(`${SITE.url}/auth?error=${code}`, 303);
    res.headers.set("Cache-Control", "no-store");
    return res;
  };
  if (!isAuthConfigured()) return back("config");
  const rl = await limit(clientKeyFromRequest(req));
  if (!rl.allowed) return back("rate");
  if (!(await isGoogleEnabled())) return back("provider");

  const next = safeNextPath(new URL(req.url).searchParams.get("next"));
  const pkce = createPkcePair();
  const res = NextResponse.redirect(buildGoogleAuthorizeUrl(process.env.SUPABASE_URL!, SITE.url, pkce.challenge), 303);
  res.cookies.set(PKCE_COOKIE, pkce.verifier, sessionCookieOptions(600));
  res.cookies.set(NEXT_COOKIE, next, sessionCookieOptions(600));
  res.headers.set("Cache-Control", "no-store");
  return res;
}

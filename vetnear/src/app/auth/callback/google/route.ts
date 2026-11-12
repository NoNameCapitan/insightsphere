import { NextResponse } from "next/server";
import { PKCE_COOKIE, mapOAuthError } from "@/lib/auth/oauth";
import { safeNextPath } from "@/lib/auth/shared";
import {
  NEXT_COOKIE,
  exchangeOAuthCode,
  isAuthConfigured,
  readCookie,
  sessionCookieOptions,
  setSessionCookies,
} from "@/lib/server/userAuth";
import { SITE } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /auth/callback/google?code=…
 * Where Supabase returns the browser after Google. The one-time code is
 * exchanged on the server together with the PKCE verifier from the httpOnly
 * cookie; the page never sees a token.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const done = (location: string) => {
    const res = NextResponse.redirect(`${SITE.url}${location}`, 303);
    res.cookies.set(PKCE_COOKIE, "", sessionCookieOptions(0));
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  };
  if (!isAuthConfigured()) return done("/auth?error=config");

  const failure = url.searchParams.get("error") || url.searchParams.get("error_code");
  if (failure) {
    return done(`/auth?error=${mapOAuthError(url.searchParams.get("error"), url.searchParams.get("error_code"), url.searchParams.get("error_description"))}`);
  }

  const code = url.searchParams.get("code") ?? "";
  const verifier = readCookie(req, PKCE_COOKIE) ?? "";
  // No verifier: the link was opened in another browser or after 10 minutes.
  if (!code || code.length > 512 || !verifier) return done("/auth?error=expired");

  const result = await exchangeOAuthCode(code, verifier);
  if (!result.ok) {
    if (result.status !== 400 && result.status !== 401) console.error("[auth/callback/google] exchange failed:", result.status, result.code);
    const mapped = result.status === 429 ? "rate" : mapOAuthError(null, result.code, result.message);
    return done(`/auth?error=${mapped === "unknown" && result.status < 500 && result.status !== 0 ? "expired" : mapped}`);
  }

  const res = done(safeNextPath(readCookie(req, NEXT_COOKIE)));
  setSessionCookies(res, result.tokens);
  res.cookies.set(NEXT_COOKIE, "", sessionCookieOptions(0));
  return res;
}

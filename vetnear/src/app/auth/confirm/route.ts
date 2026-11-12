import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/shared";
import { NEXT_COOKIE, getAuthClient, readCookie, sessionCookieOptions, setSessionCookies } from "@/lib/server/userAuth";
import { SITE } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = ["email", "magiclink", "signup"] as const;
type OtpType = (typeof TYPES)[number];

/**
 * GET /auth/confirm?token_hash=…&type=email
 * Target of the recommended e-mail template. The one-time token is exchanged
 * on the server, so the link also works when opened on another device.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const fail = (code: string) => {
    const res = NextResponse.redirect(`${SITE.url}/auth?error=${code}`, 303);
    res.headers.set("Cache-Control", "no-store");
    return res;
  };

  const auth = getAuthClient();
  if (!auth) return fail("config");
  const tokenHash = url.searchParams.get("token_hash") ?? "";
  const type = url.searchParams.get("type") as OtpType | null;
  if (!tokenHash || tokenHash.length > 256 || !type || !TYPES.includes(type)) return fail("expired");

  const { data, error } = await auth.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error || !data.session) return fail("expired");

  const next = safeNextPath(url.searchParams.get("next") ?? readCookie(req, NEXT_COOKIE));
  const res = NextResponse.redirect(`${SITE.url}${next}`, 303);
  setSessionCookies(res, {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in ?? 3600,
  });
  res.cookies.set(NEXT_COOKIE, "", sessionCookieOptions(0));
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

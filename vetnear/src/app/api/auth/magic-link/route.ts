import { NextResponse } from "next/server";
import { normalizeEmail, safeNextPath } from "@/lib/auth/shared";
import { clientKeyFromRequest, createServerRateLimiter } from "@/lib/security/serverRateLimit";
import { readJsonBody } from "@/lib/server/requestBody";
import { NEXT_COOKIE, getAuthClient, sessionCookieOptions } from "@/lib/server/userAuth";
import { SITE } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sending e-mail is the expensive, abusable step: 5 links / 15 min per IP and
// 3 / 15 min per address (Supabase applies its own limits on top).
const perIp = createServerRateLimiter({ namespace: "auth-link-ip", limit: 5, windowMs: 15 * 60_000 });
const perEmail = createServerRateLimiter({ namespace: "auth-link-email", limit: 3, windowMs: 15 * 60_000 });

/** POST /api/auth/magic-link — { email, next? } → e-mails a one-time sign-in link. */
export async function POST(req: Request): Promise<Response> {
  const auth = getAuthClient();
  if (!auth) return NextResponse.json({ error: "config" }, { status: 503 });

  const body = await readJsonBody(req, 2048);
  if (!body.ok) return NextResponse.json({ error: "invalid" }, { status: body.status });
  const input = (body.value && typeof body.value === "object" ? body.value : {}) as { email?: unknown; next?: unknown };
  const email = normalizeEmail(input.email);
  if (!email) return NextResponse.json({ error: "invalid" }, { status: 422 });

  const [ip, address] = await Promise.all([perIp(clientKeyFromRequest(req)), perEmail(email)]);
  if (!ip.allowed || !address.allowed) {
    const retry = Math.max(ip.retryAfterSec, address.retryAfterSec);
    return NextResponse.json({ error: "rate" }, { status: 429, headers: { "Retry-After": String(retry) } });
  }

  const next = safeNextPath(typeof input.next === "string" ? input.next : null);
  const { error } = await auth.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${SITE.url}/auth/callback` },
  });
  if (error) {
    const rate = error.status === 429 || /rate limit/i.test(error.message);
    if (!rate) console.error("[api/auth/magic-link] send failed:", error.message);
    return NextResponse.json({ error: rate ? "rate" : "unknown" }, { status: rate ? 429 : 502 });
  }

  // Where to land after the link is opened in this browser (10 minutes).
  const res = NextResponse.json({ ok: true });
  res.cookies.set(NEXT_COOKIE, next, sessionCookieOptions(600));
  res.headers.set("Cache-Control", "no-store");
  return res;
}

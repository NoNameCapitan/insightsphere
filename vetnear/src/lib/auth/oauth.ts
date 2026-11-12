// Google sign-in through Supabase Auth, done on the server with PKCE
// (pure helpers — no server-only imports, so they are unit-testable).
//
// Flow:  /api/auth/google  →  Supabase /authorize  →  Google  →  Supabase
//        →  /auth/callback/google?code=…  →  token exchange  →  httpOnly cookies
// The code verifier never leaves an httpOnly cookie, and no Supabase key or
// token is ever exposed to page scripts.
import { createHash, randomBytes } from "node:crypto";
import type { AuthErrorCode } from "./shared";

export const PKCE_COOKIE = "vn_pkce";
export const GOOGLE_CALLBACK_PATH = "/auth/callback/google";

export interface PkcePair {
  verifier: string;
  challenge: string;
}

/** RFC 7636: 43–128 unreserved chars; challenge = base64url(sha256(verifier)). */
export function createPkcePair(): PkcePair {
  const verifier = randomBytes(48).toString("base64url");
  return { verifier, challenge: challengeFor(verifier) };
}

export function challengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildGoogleAuthorizeUrl(supabaseUrl: string, siteUrl: string, challenge: string): string {
  const params = new URLSearchParams({
    provider: "google",
    redirect_to: `${siteUrl.replace(/\/$/, "")}${GOOGLE_CALLBACK_PATH}`,
    code_challenge: challenge,
    code_challenge_method: "s256",
  });
  return `${supabaseUrl.replace(/\/$/, "")}/auth/v1/authorize?${params}`;
}

/**
 * Maps what Supabase/Google sends back on a failed sign-in to one of our
 * user-facing error codes. Unknown values never leak into the UI.
 */
export function mapOAuthError(error: string | null, code: string | null, description: string | null): AuthErrorCode {
  const text = `${error ?? ""} ${code ?? ""} ${description ?? ""}`.toLowerCase();
  if (/access_denied|cancel|consent_required|interaction_required/.test(text) && !/signup|disabled|banned/.test(text)) return "cancelled";
  if (/rate|too many|over_request|over_email/.test(text)) return "rate";
  if (/identity_already_exists|email_exists|user_already_exists|already registered|linking|identity is already linked|multiple accounts/.test(text)) return "linking";
  if (/provider_disabled|unsupported provider|provider is not enabled|validation_failed|server_error|temporarily_unavailable|unexpected_failure/.test(text)) return "provider";
  if (/expired|invalid.*(code|grant|flow)|flow_state|bad_code_verifier/.test(text)) return "expired";
  return "unknown";
}

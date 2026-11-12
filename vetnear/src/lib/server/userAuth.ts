// User sessions (v1.31). Supabase Auth is used entirely from the server:
// the browser never sees a Supabase key and never talks to Supabase directly.
// The session lives in two httpOnly cookies; every request re-validates the
// access token with Supabase and transparently refreshes it when needed.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";

export const ACCESS_COOKIE = "vn_at";
export const REFRESH_COOKIE = "vn_rt";
export const NEXT_COOKIE = "vn_next";
const REFRESH_MAX_AGE = 60 * 60 * 24 * 60; // 60 days

export interface SessionUser {
  id: string;
  email: string | null;
  /** Sign-in methods linked to this account, e.g. ["email", "google"]. */
  providers: string[];
}

/** Narrows a Supabase user object to what the app needs. */
export function toSessionUser(user: { id: string; email?: string | null; app_metadata?: { provider?: unknown; providers?: unknown } }): SessionUser {
  const meta = user.app_metadata ?? {};
  const list = Array.isArray(meta.providers) ? meta.providers : typeof meta.provider === "string" ? [meta.provider] : [];
  const providers = list.filter((p): p is string => typeof p === "string" && /^[a-z_]{2,20}$/.test(p)).slice(0, 5);
  return { id: user.id, email: user.email ?? null, providers };
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserSession {
  user: SessionUser;
  accessToken: string;
  /** Present when the access token was refreshed and cookies must be re-set. */
  refreshed?: SessionTokens;
}

function anonKey(): string {
  return (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "").trim();
}

export function isAuthConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && anonKey());
}

const CLIENT_OPTIONS = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

/** Anonymous client: only for Auth endpoints (send link, verify, refresh). */
export function getAuthClient(): SupabaseClient | null {
  if (!isAuthConfigured()) return null;
  return createClient(process.env.SUPABASE_URL!, anonKey(), CLIENT_OPTIONS);
}

/** Client that acts AS the user: PostgREST runs under their JWT, so RLS applies. */
export function getUserClient(accessToken: string): SupabaseClient | null {
  if (!isAuthConfigured()) return null;
  return createClient(process.env.SUPABASE_URL!, anonKey(), {
    ...CLIENT_OPTIONS,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Cookie attributes shared by both session cookies. */
export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function setSessionCookies(res: NextResponse, tokens: SessionTokens): void {
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, sessionCookieOptions(Math.max(60, tokens.expiresIn)));
  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, sessionCookieOptions(REFRESH_MAX_AGE));
}

export function clearSessionCookies(res: NextResponse): void {
  res.cookies.set(ACCESS_COOKIE, "", sessionCookieOptions(0));
  res.cookies.set(REFRESH_COOKIE, "", sessionCookieOptions(0));
}

/**
 * Resolves the signed-in user for a request, or null. Never trusts the
 * cookie contents: the access token is verified by Supabase on every call.
 */
export async function getUserSession(req: Request): Promise<UserSession | null> {
  const auth = getAuthClient();
  if (!auth) return null;

  const accessToken = readCookie(req, ACCESS_COOKIE);
  if (accessToken) {
    const { data, error } = await auth.auth.getUser(accessToken);
    if (!error && data.user) {
      return { user: toSessionUser(data.user), accessToken };
    }
  }

  const refreshToken = readCookie(req, REFRESH_COOKIE);
  if (!refreshToken) return null;
  const { data, error } = await auth.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session || !data.user) return null;
  const tokens: SessionTokens = {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in ?? 3600,
  };
  return {
    user: toSessionUser(data.user),
    accessToken: tokens.accessToken,
    refreshed: tokens,
  };
}

/** Applies refreshed cookies (if any) to an outgoing response. */
export function withSession<T extends NextResponse>(res: T, session: UserSession | null): T {
  if (session?.refreshed) setSessionCookies(res, session.refreshed);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

// ── Google (OAuth through Supabase, PKCE on the server) ─────────────────────

interface ProviderCache { google: boolean; expires: number }
let providerCache: ProviderCache | null = null;

/**
 * Whether Google sign-in is switched on in the Supabase project. Asked from
 * Supabase's public settings endpoint and cached, so the button is never
 * shown when it would lead to an error. Any failure counts as "off".
 */
export async function isGoogleEnabled(now: number = Date.now()): Promise<boolean> {
  if (!isAuthConfigured()) return false;
  if (providerCache && providerCache.expires > now) return providerCache.google;
  let google = false;
  let ttl = 30_000; // retry soon after a failure
  try {
    const res = await fetch(`${process.env.SUPABASE_URL!.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: anonKey() },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (res.ok) {
      const body = (await res.json()) as { external?: { google?: unknown } };
      google = body.external?.google === true;
      ttl = 5 * 60_000;
    }
  } catch {
    /* treated as off */
  }
  providerCache = { google, expires: now + ttl };
  return google;
}

/** Test hook: forget the cached provider settings. */
export function resetProviderCache(): void {
  providerCache = null;
}

export type CodeExchange =
  | { ok: true; tokens: SessionTokens }
  | { ok: false; status: number; code: string | null; message: string | null };

/** Exchanges the one-time OAuth code (plus our PKCE verifier) for a session. */
export async function exchangeOAuthCode(code: string, verifier: string): Promise<CodeExchange> {
  try {
    const res = await fetch(`${process.env.SUPABASE_URL!.replace(/\/$/, "")}/auth/v1/token?grant_type=pkce`, {
      method: "POST",
      headers: { apikey: anonKey(), authorization: `Bearer ${anonKey()}`, "content-type": "application/json" },
      body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || typeof body.access_token !== "string" || typeof body.refresh_token !== "string") {
      return {
        ok: false,
        status: res.status,
        code: typeof body.error_code === "string" ? body.error_code : typeof body.error === "string" ? body.error : null,
        message: typeof body.msg === "string" ? body.msg : typeof body.error_description === "string" ? body.error_description : null,
      };
    }
    return {
      ok: true,
      tokens: { accessToken: body.access_token, refreshToken: body.refresh_token, expiresIn: typeof body.expires_in === "number" ? body.expires_in : 3600 },
    };
  } catch {
    return { ok: false, status: 0, code: "temporarily_unavailable", message: null };
  }
}

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
      return { user: { id: data.user.id, email: data.user.email ?? null }, accessToken };
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
    user: { id: data.user.id, email: data.user.email ?? null },
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

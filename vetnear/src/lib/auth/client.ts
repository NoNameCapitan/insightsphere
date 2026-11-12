"use client";

import { useEffect, useState } from "react";

export interface ClientSession {
  /** False when accounts are not set up on this deployment (local-only mode). */
  configured: boolean;
  user: { id: string; email: string | null } | null;
}

let current: ClientSession | null = null;
let inflight: Promise<ClientSession> | null = null;
const listeners = new Set<(session: ClientSession) => void>();

/** Loads the session once per page load; `force` re-checks after sign-in/out. */
export function loadSession(force = false): Promise<ClientSession> {
  if (current && !force) return Promise.resolve(current);
  if (inflight && !force) return inflight;
  inflight = fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" })
    .then((res) => (res.ok ? (res.json() as Promise<ClientSession>) : { configured: false, user: null }))
    .catch(() => ({ configured: false, user: null }) as ClientSession)
    .then((session) => {
      current = { configured: Boolean(session.configured), user: session.user ?? null };
      inflight = null;
      listeners.forEach((listener) => listener(current!));
      return current;
    });
  return inflight;
}

/** null while loading. */
export function useSession(): ClientSession | null {
  const [session, setSession] = useState<ClientSession | null>(current);
  useEffect(() => {
    listeners.add(setSession);
    void loadSession().then(setSession);
    return () => {
      listeners.delete(setSession);
    };
  }, []);
  return session;
}

const JSON_HEADERS = { "content-type": "application/json" };

export async function requestMagicLink(email: string, next: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/auth/magic-link", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ email, next }) });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error ?? "unknown" };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function signOutRequest(): Promise<void> {
  await fetch("/api/auth/sign-out", { method: "POST", headers: JSON_HEADERS, body: "{}" }).catch(() => {});
  await loadSession(true);
}

export async function deleteAccountRequest(): Promise<boolean> {
  const res = await fetch("/api/account", { method: "DELETE", headers: JSON_HEADERS }).catch(() => null);
  if (!res?.ok) return false;
  await loadSession(true);
  return true;
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadSession } from "@/lib/auth/client";
import { AUTH_ERROR_TEXT, DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/shared";

/**
 * Landing page of the default Supabase sign-in e-mail. The tokens arrive in
 * the URL fragment (never sent to a server by the browser); they are removed
 * from the address bar at once and exchanged for httpOnly cookies.
 */
export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    window.history.replaceState(null, "", window.location.pathname);

    const accessToken = fragment.get("access_token");
    const refreshToken = fragment.get("refresh_token");
    const failed = fragment.get("error_code") || fragment.get("error") || query.get("error_code") || query.get("error");

    const finish = async () => {
      if (accessToken && refreshToken) {
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accessToken, refreshToken }),
        }).catch(() => null);
        if (res?.ok) {
          const data = (await res.json()) as { next?: string };
          await loadSession(true);
          window.location.replace(safeNextPath(data.next));
          return;
        }
        setError(AUTH_ERROR_TEXT.expired);
        return;
      }
      if (failed) {
        setError(AUTH_ERROR_TEXT.expired);
        return;
      }
      // Opened without tokens: continue if a session already exists.
      const session = await loadSession(true);
      if (session.user) window.location.replace(DEFAULT_AFTER_LOGIN);
      else setError(AUTH_ERROR_TEXT.expired);
    };
    void finish();
  }, []);

  return (
    <div className="container-px mx-auto max-w-md py-14 text-center">
      {error ? (
        <div className="rounded-3xl border border-brand-100 bg-surface p-6 shadow-card" role="alert">
          <h1 className="font-display text-xl font-bold text-ink">Не вдалося увійти</h1>
          <p className="mt-2 text-sm leading-6 text-ink/65">{error}</p>
          <Link href="/auth" className="btn btn-brand mt-5 w-full">Надіслати нове посилання</Link>
        </div>
      ) : (
        <div aria-busy="true" role="status">
          <div className="skeleton mx-auto h-16 w-16 rounded-full" />
          <p className="mt-4 text-sm text-ink/60">Входимо в акаунт…</p>
        </div>
      )}
    </div>
  );
}

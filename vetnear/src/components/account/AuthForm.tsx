"use client";

import Link from "next/link";
import { useState } from "react";
import { GoogleButton } from "@/components/account/GoogleButton";
import { TileIcon } from "@/components/icons/ServiceIcons";
import { requestMagicLink, useSession } from "@/lib/auth/client";
import { AUTH_ERROR_TEXT, normalizeEmail, type AuthErrorCode } from "@/lib/auth/shared";

const asCode = (value: string | undefined): AuthErrorCode | null =>
  value && value in AUTH_ERROR_TEXT ? (value as AuthErrorCode) : value ? "unknown" : null;

/**
 * One calm screen for sign-up and sign-in. Google is the main action; the
 * e-mail link stays as a quiet second path (and the only one when Google is
 * not enabled for the project).
 */
export function AuthForm({ next, initialError }: { next: string; initialError?: string }) {
  const session = useSession();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthErrorCode | null>(asCode(initialError));
  // After a Google problem the e-mail path is opened straight away.
  const [emailOpen, setEmailOpen] = useState(initialError === "provider" || initialError === "linking" || initialError === "invalid");
  const google = Boolean(session?.google);
  const showEmail = emailOpen || (session !== null && !google);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = normalizeEmail(email);
    if (!clean) { setError("invalid"); return; }
    setBusy(true);
    setError(null);
    const result = await requestMagicLink(clean, next);
    setBusy(false);
    if (result.ok) setSentTo(clean);
    else setError(asCode(result.error));
  };

  if (session && !session.configured) {
    return (
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Акаунти ще не ввімкнено</h1>
        <p className="mt-2 text-sm leading-6 text-ink/60">{AUTH_ERROR_TEXT.config}</p>
        <Link href="/nearby" className="btn btn-brand mt-6 w-full">Знайти клініку</Link>
      </div>
    );
  }

  if (session?.user) {
    return (
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Ви вже увійшли</h1>
        <p className="mt-2 break-all text-sm text-ink/60">{session.user.email}</p>
        <Link href={next} className="btn btn-brand mt-6 w-full">Продовжити</Link>
        <Link href="/account" className="btn btn-ghost mt-2.5 w-full">Акаунт</Link>
      </div>
    );
  }

  if (sentTo) {
    return (
      <div className="text-center" role="status">
        <span className="icon3d mx-auto h-16 w-16"><TileIcon name="verified" /></span>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">Перевірте пошту</h1>
        <p className="mt-2 text-sm leading-6 text-ink/65">
          Ми надіслали посилання для входу на <strong className="break-words text-ink">{sentTo}</strong>.
          Відкрийте лист і натисніть кнопку — ви повернетесь сюди вже в акаунті.
        </p>
        <p className="mt-3 text-xs leading-5 text-ink/45">Лист не прийшов за хвилину? Перевірте «Спам» або надішліть ще раз.</p>
        <button type="button" onClick={() => setSentTo(null)} className="mt-4 text-sm font-semibold text-brand hover:underline">
          Вказати іншу адресу
        </button>
      </div>
    );
  }

  return (
    <div>
      <span className="icon3d mx-auto h-16 w-16"><TileIcon name="pet" /></span>
      <h1 className="mt-4 text-center font-display text-2xl font-bold text-ink">Вхід до VetNear</h1>
      <p className="mt-2 text-center text-sm leading-6 text-ink/60">
        Щоб зберігати картки тварин і бачити їх на будь-якому пристрої. Пошук клінік працює без акаунта.
      </p>
      {error && (
        <p role="alert" className="mt-4 rounded-2xl border border-emergency/15 bg-emergency-50 px-4 py-3 text-sm text-emergency-700">
          {AUTH_ERROR_TEXT[error]}
        </p>
      )}

      {/* Fixed-height slot: the layout does not jump while the session loads. */}
      {session === null ? (
        <div className="skeleton mt-5 h-[52px] rounded-2xl" aria-hidden />
      ) : google ? (
        <GoogleButton next={next} className="mt-5 w-full" />
      ) : null}

      {google && !showEmail && (
        <button type="button" onClick={() => setEmailOpen(true)} className="mx-auto mt-4 block text-sm font-semibold text-ink/60 underline-offset-4 hover:text-brand hover:underline">
          або увійти через email
        </button>
      )}

      {showEmail && (
        <form onSubmit={(event) => { void submit(event); }} noValidate className={google ? "mt-5 border-t border-brand-100 pt-5" : "mt-5"}>
          {google && <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-ink/40">або через email</p>}
          <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium text-ink/70">Електронна пошта</label>
          <input
            id="auth-email"
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-2xl border border-brand-100 bg-white px-3.5 py-3 text-ink outline-none placeholder:text-ink/30 focus:border-brand focus:ring-2 focus:ring-brand/10"
          />
          <button type="submit" disabled={busy} className={`btn mt-3 w-full ${google ? "btn-ghost" : "btn-brand"}`}>
            {busy ? "Надсилаємо…" : "Надіслати посилання для входу"}
          </button>
          <p className="mt-2 text-center text-xs leading-5 text-ink/45">Без пароля: надішлемо одноразове посилання.</p>
        </form>
      )}

      <p className="mt-5 text-center text-xs leading-5 text-ink/45">
        Продовжуючи, ви погоджуєтесь з <Link href="/terms" className="underline hover:text-brand">умовами</Link> та{" "}
        <Link href="/privacy" className="underline hover:text-brand">політикою конфіденційності</Link>.
      </p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteAccountRequest, signOutRequest, useSession } from "@/lib/auth/client";
import { stopPetSync } from "@/lib/pets/sync";

export function AccountPanel() {
  const session = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState<"out" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!session) return <div className="skeleton h-48" aria-busy="true" />;

  if (!session.configured || !session.user) {
    return (
      <div className="rounded-3xl border border-brand-100 bg-surface p-6 text-center shadow-card">
        <h1 className="font-display text-2xl font-bold text-ink">Акаунт</h1>
        <p className="mt-2 text-sm leading-6 text-ink/60">
          {session.configured ? "Ви не увійшли. Пошук клінік працює й без акаунта." : "Акаунти ще не ввімкнено на цьому сайті."}
        </p>
        {session.configured && <Link href="/auth?next=/account" className="btn btn-brand mt-5 w-full">Увійти</Link>}
      </div>
    );
  }

  const signOut = async () => {
    setBusy("out");
    await signOutRequest();
    stopPetSync(true);
    router.push("/");
  };

  const remove = async () => {
    if (!window.confirm("Видалити акаунт і всі картки тварин назавжди? Це не можна скасувати.")) return;
    setBusy("delete");
    setError(null);
    const ok = await deleteAccountRequest();
    if (!ok) {
      setBusy(null);
      setError("Не вдалося видалити акаунт. Спробуйте ще раз або напишіть нам.");
      return;
    }
    stopPetSync(true);
    router.push("/");
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-brand-100 bg-surface p-6 shadow-card">
        <h1 className="font-display text-2xl font-bold text-ink">Акаунт</h1>
        <dl className="mt-4 text-sm">
          <dt className="text-xs font-medium text-ink/45">Електронна пошта</dt>
          <dd className="mt-0.5 break-all font-semibold text-ink">{session.user.email ?? "—"}</dd>
        </dl>
        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          <Link href="/my-pets" className="btn btn-brand">Мої тварини</Link>
          <button type="button" onClick={() => { void signOut(); }} disabled={busy !== null} className="btn btn-ghost">
            {busy === "out" ? "Виходимо…" : "Вийти"}
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-ink/45">
          Після виходу картки тварин зникнуть з цього пристрою, але залишаться в акаунті.
        </p>
      </section>

      <section className="rounded-3xl border border-brand-100 bg-surface p-6">
        <h2 className="font-display text-lg font-bold text-ink">Дані та приватність</h2>
        <p className="mt-2 text-sm leading-6 text-ink/60">
          В акаунті зберігаються ваша пошта й картки тварин. Файли, прикріплені до записів, лишаються лише на пристрої, де їх додано.{" "}
          <Link href="/privacy" className="text-brand underline">Політика конфіденційності</Link> ·{" "}
          <Link href="/terms" className="text-brand underline">Умови</Link>
        </p>
        {error && <p role="alert" className="mt-3 rounded-2xl border border-emergency/15 bg-emergency-50 px-4 py-3 text-sm text-emergency-700">{error}</p>}
        <button type="button" onClick={() => { void remove(); }} disabled={busy !== null} className="mt-4 text-sm font-semibold text-emergency-700 hover:underline">
          {busy === "delete" ? "Видаляємо…" : "Видалити акаунт і всі дані"}
        </button>
      </section>
    </div>
  );
}

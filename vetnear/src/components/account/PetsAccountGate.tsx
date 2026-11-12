"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { TileIcon } from "@/components/icons/ServiceIcons";
import { useSession } from "@/lib/auth/client";
import { resolveGate } from "@/lib/auth/shared";
import {
  countLocalGuestPets,
  discardGuestPets,
  flushPetSync,
  getGuestPets,
  importGuestPets,
  onPetSyncStatus,
  startPetSync,
} from "@/lib/pets/sync";

/**
 * Wraps the "my pets" area.
 *  - accounts not configured → the old device-only mode, unchanged;
 *  - signed out → a calm invitation to sign in (search stays open to guests);
 *  - signed in → cards come from the account; device-only cards can be moved in.
 */
export function PetsAccountGate({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const pathname = usePathname() ?? "/my-pets";
  const gate = resolveGate(session);
  const userId = session?.user?.id ?? null;
  const [ready, setReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState(0);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (gate !== "signed-in" || !userId) return;
    let cancelled = false;
    const unsubscribe = onPetSyncStatus(setSyncError);
    void startPetSync(userId).finally(() => {
      if (cancelled) return;
      setGuestCount(getGuestPets().length);
      setReady(true);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [gate, userId]);

  useEffect(() => {
    if (gate === "signed-out") setGuestCount(countLocalGuestPets());
  }, [gate]);

  if (gate === "local") return <>{children}</>;

  if (gate === "loading" || (gate === "signed-in" && !ready)) {
    return (
      <div className="container-px mx-auto max-w-3xl space-y-4 py-8" aria-busy="true" aria-label="Завантажуємо ваші картки">
        <div className="skeleton h-24" />
        <div className="skeleton h-40" />
      </div>
    );
  }

  if (gate === "signed-out") {
    return (
      <div className="container-px mx-auto max-w-md py-10 text-center">
        <span className="icon3d mx-auto h-20 w-20"><TileIcon name="pet" /></span>
        <h1 className="mt-5 font-display text-2xl font-bold text-ink">Картки ваших тварин</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink/60">
          Увійдіть, щоб зберігати медичні картки в акаунті й бачити їх на будь-якому пристрої.
          Пошук клінік працює й без входу.
        </p>
        <Link href={`/auth?next=${encodeURIComponent(pathname)}`} className="btn btn-brand mt-6 w-full">
          Увійти або створити акаунт
        </Link>
        <Link href="/nearby" className="btn btn-ghost mt-2.5 w-full">Знайти клініку без входу</Link>
        {guestCount > 0 && (
          <p className="mt-4 rounded-2xl border border-brand-100 bg-surface px-4 py-3 text-left text-sm leading-6 text-ink/65">
            На цьому пристрої вже збережено карток: {guestCount}. Після входу ви зможете перенести їх
            в акаунт — нічого не зникне.
          </p>
        )}
        <p className="mt-4 text-xs text-ink/45">Без пароля: ми надішлемо посилання для входу на вашу пошту.</p>
      </div>
    );
  }

  const moveIn = async () => {
    setImporting(true);
    const error = await importGuestPets();
    setImporting(false);
    setGuestCount(0);
    if (error) setSyncError(error);
  };

  return (
    <>
      {(guestCount > 0 || syncError) && (
        <div className="container-px mx-auto max-w-3xl space-y-2.5 pt-5">
          {guestCount > 0 && (
            <div className="rounded-2xl border border-peach-200 bg-peach-50 px-4 py-3 text-sm text-ink/75">
              <p className="font-semibold text-ink">На цьому пристрої є локальні картки: {guestCount}</p>
              <p className="mt-0.5">Перенести їх у ваш акаунт, щоб вони були доступні всюди?</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button type="button" onClick={() => { void moveIn(); }} disabled={importing} className="btn btn-brand px-4 py-2 text-sm">
                  {importing ? "Переносимо…" : "Перенести в акаунт"}
                </button>
                <button type="button" onClick={() => setGuestCount(0)} className="btn btn-ghost px-4 py-2 text-sm">Не зараз</button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Видалити локальні картки з цього пристрою? Це не можна скасувати.")) {
                      discardGuestPets();
                      setGuestCount(0);
                    }
                  }}
                  className="px-2 py-2 text-sm font-medium text-ink/50 hover:text-emergency-700"
                >
                  Видалити їх
                </button>
              </div>
            </div>
          )}
          {syncError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-ink/80">
              <span>{syncError}</span>
              <button type="button" onClick={() => { void flushPetSync().catch(() => {}); }} className="font-semibold text-brand hover:underline">
                Повторити
              </button>
            </div>
          )}
        </div>
      )}
      {children}
    </>
  );
}

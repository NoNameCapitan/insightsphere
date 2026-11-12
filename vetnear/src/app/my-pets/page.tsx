"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PetProfileCard } from "@/components/PetProfileCard";
import { useSession } from "@/lib/auth/client";
import { PETS_CHANGED_EVENT } from "@/lib/pets/sync";
import { exportPetsBackup, getActivePetId, getPets, importPetsBackup } from "@/lib/pets/store";
import type { PetProfile } from "@/lib/types";
import { PetProfileIcon } from "@/components/icons/ServiceIcons";
import { GeneratedVisual } from "@/components/GeneratedVisual";

export default function MyPetsPage() {
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);
  const session = useSession();
  const account = session?.user ? (session.user.email ?? "акаунт") : null;

  const reload = () => {
    setPets(getPets());
    setActiveId(getActivePetId());
  };
  useEffect(() => {
    reload();
    window.addEventListener(PETS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(PETS_CHANGED_EVENT, reload);
  }, []);

  const saveBackup = () => {
    const url = URL.createObjectURL(new Blob([exportPetsBackup()], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `vetnear-medcards-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Копію збережено у файл. Зберігайте його там, де не загубите.");
  };

  const restoreBackup = async (file?: File) => {
    if (!file) return;
    try {
      const count = importPetsBackup(await file.text());
      reload();
      setNotice(`Відновлено медкарток: ${count}.`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Не вдалося прочитати файл.");
    }
  };

  return (
    <div className="container-px mx-auto max-w-3xl py-8">
      <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex items-start justify-between gap-4 sm:block">
          <div>
          <h1 className="font-display text-3xl font-bold text-ink">Мої тварини</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink/55">Приватні медичні картки, вакцинації, обробки, вага, документи й нагадування.</p>
          </div>
          <Link href="/my-pets/new" className="btn btn-brand shrink-0 px-4 py-2.5 text-sm sm:mt-4">Додати</Link>
        </div>
        <GeneratedVisual src="/visuals/d-my-pets.webp" className="mx-auto h-36 w-full max-w-[240px] sm:h-60 sm:max-w-[340px]" motion="tilt" glow shine shadow sizes="340px" />
      </div>

      {account ? (
        <p className="mt-5 flex items-start gap-3 rounded-2xl border border-brand-100 bg-white px-4 py-3 text-sm text-ink/60">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
          <span>
            Картки зберігаються у вашому акаунті ({account}) і доступні на будь-якому пристрої.{" "}
            <Link href="/account" className="font-semibold text-brand hover:underline">Акаунт</Link>
          </span>
        </p>
      ) : (
      <div className="mt-5 rounded-2xl border border-brand-100 bg-white px-4 py-3 text-sm text-ink/60">
        <p className="flex items-start gap-3">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
          Медкартки зберігаються лише на цьому пристрої. Якщо очистити дані браузера, вони зникнуть — збережіть копію.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 pl-5 text-sm">
          {pets.length > 0 && (
            <button type="button" onClick={saveBackup} className="font-semibold text-brand hover:underline">Зберегти копію</button>
          )}
          <label className="cursor-pointer font-semibold text-brand hover:underline">
            Відновити з копії
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => { void restoreBackup(event.target.files?.[0]); event.target.value = ""; }} />
          </label>
        </div>
        {notice && <p role="status" className="mt-2 pl-5 text-xs text-ink/55">{notice}</p>}
      </div>
      )}

      {pets.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-brand-200 bg-white p-8 text-center sm:p-12">
          <span className="icon3d mx-auto h-20 w-20"><PetProfileIcon className="h-14 w-14" /></span>
          <h2 className="mt-3 font-display text-xl font-bold text-ink">Додайте першу тварину</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink/55">Почніть з імені й виду. Вакцинації, документи та історію можна додати пізніше.</p>
          <Link href="/my-pets/new" className="btn btn-brand mt-5">Додати тварину</Link>
        </div>
      ) : (
        <>
          <ul className="mt-5 space-y-3">
            {pets.map((p) => (
              <li key={p.id}>
                <PetProfileCard pet={p} active={p.id === activeId} />
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-center"><Link href="/nearby" className="text-sm font-semibold text-brand hover:underline">Знайти допомогу поруч</Link></div>
        </>
      )}
    </div>
  );
}

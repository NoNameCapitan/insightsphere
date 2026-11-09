"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PetProfileCard } from "@/components/PetProfileCard";
import { getActivePetId, getPets } from "@/lib/pets/store";
import type { PetProfile } from "@/lib/types";
import { PetProfileIcon } from "@/components/icons/ServiceIcons";
import { GeneratedVisual } from "@/components/GeneratedVisual";

export default function MyPetsPage() {
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setPets(getPets());
    setActiveId(getActivePetId());
  }, []);

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
        <GeneratedVisual src="/visuals/d-my-pets.webp" className="mx-auto h-52 w-full max-w-[340px] sm:h-60" motion="tilt" glow shine shadow sizes="340px" />
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-brand-100 bg-white px-4 py-3 text-sm text-ink/60">
        <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
        Медичні дані зберігаються на цьому пристрої. Ви самі вирішуєте, що експортувати або кому показувати.
      </div>

      {pets.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-brand-200 bg-white p-8 text-center sm:p-12">
          <PetProfileIcon className="mx-auto h-20 w-20" />
          <h2 className="mt-3 font-display text-xl font-bold text-ink">Створіть першу медкартку</h2>
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

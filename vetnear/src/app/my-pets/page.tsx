"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PetProfileCard } from "@/components/PetProfileCard";
import { getActivePetId, getPets } from "@/lib/pets/store";
import type { PetProfile } from "@/lib/types";

export default function MyPetsPage() {
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setPets(getPets());
    setActiveId(getActivePetId());
  }, []);

  return (
    <div className="container-px mx-auto max-w-3xl py-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold text-ink">Мої улюбленці</h1>
        <Link href="/my-pets/new" className="btn btn-brand py-2 text-sm">+ Додати</Link>
      </div>
      <p className="mt-1 text-ink/60">
        Додайте улюбленця один раз — і пошук буде підбирати релевантні заклади.
        Дані профілю зберігаються лише у вашому браузері.
      </p>

      {pets.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-brand-100 p-10 text-center">
          <p className="text-4xl">🐾</p>
          <p className="mt-2 text-ink/60">Ще немає жодного профілю.</p>
          <Link href="/my-pets/new" className="btn btn-brand mt-4">Створити профіль</Link>
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
          <div className="mt-5">
            <Link href="/nearby" className="btn btn-ghost w-full">
              Послуги для активного улюбленця →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ANIMAL_LABELS } from "@/lib/labels";
import {
  getActivePetId,
  getPets,
  setActivePetId,
} from "@/lib/pets/store";
import type { PetProfile } from "@/lib/types";

/** Compact active-pet picker used on discovery surfaces. */
export function ActivePetSelector({
  onChange,
}: {
  onChange?: (pet: PetProfile | null) => void;
}) {
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [activeId, setActive] = useState<string | null>(null);

  useEffect(() => {
    setPets(getPets());
    setActive(getActivePetId());
  }, []);

  if (pets.length === 0) {
    return (
      <Link
        href="/my-pets/new"
        className="flex items-center gap-2 rounded-2xl border border-dashed border-brand-100 bg-brand-50/40 px-3 py-2 text-sm text-brand"
      >
        <span aria-hidden>🐾</span> Додати улюбленця для кращих рекомендацій
      </Link>
    );
  }

  const select = (id: string) => {
    setActive(id);
    setActivePetId(id);
    onChange?.(pets.find((p) => p.id === id) ?? null);
  };

  return (
    <div className="flex items-center gap-2">
      <span aria-hidden className="text-lg">🐾</span>
      <label className="sr-only" htmlFor="active-pet">Активний улюбленець</label>
      <select
        id="active-pet"
        className="flex-1 rounded-2xl border border-brand-100 bg-surface px-3 py-2 text-sm text-ink"
        value={activeId ?? ""}
        onChange={(e) => select(e.target.value)}
      >
        {pets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {ANIMAL_LABELS[p.animalType]}
          </option>
        ))}
      </select>
      <Link href="/my-pets" className="text-sm text-brand hover:underline">
        Мої тварини
      </Link>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import type { AnimalType, PlaceCategory } from "@/lib/types";

// Pet-first entry point: pick who needs help, then jump straight into the
// existing /nearby search with the matching query params. Deliberately tiny
// state — one selected pet type; need chips are plain links.

const PETS: { key: AnimalType | null; label: string }[] = [
  { key: "dog", label: "Собака" },
  { key: "cat", label: "Кіт" },
  { key: null, label: "Інший улюбленець" },
];

const NEEDS: { category: PlaceCategory; label: string }[] = [
  { category: "veterinary_clinic", label: "Ветклініка" },
  { category: "vet_pharmacy", label: "Ветаптека" },
  { category: "grooming", label: "Грумінг" },
  { category: "pet_store", label: "Зоомагазин" },
];

export function PetFirstSelector({
  emergencyHref,
  className = "",
}: {
  emergencyHref: string;
  className?: string;
}) {
  const [pet, setPet] = useState<AnimalType | null>(null);

  const needHref = (category: PlaceCategory) =>
    `/nearby?category=${category}${pet ? `&animal=${pet}` : ""}`;

  return (
    <div className={`card p-4 sm:p-5 ${className}`}>
      <p className="font-display text-base font-bold text-ink">Кому шукаємо допомогу?</p>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Тип улюбленця">
        {PETS.map((p) => (
          <button
            key={p.label}
            type="button"
            aria-pressed={pet === p.key}
            onClick={() => setPet(p.key)}
            className={pet === p.key ? "chip-on" : "chip-off"}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-4 border-t border-brand-100/70 pt-3.5">
        <p className="text-xs font-semibold text-ink/50">Що потрібно зараз</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {NEEDS.map((n) => (
            <Link key={n.category} href={needHref(n.category)} className="chip-off">
              {n.label} <span aria-hidden className="text-brand">→</span>
            </Link>
          ))}
          <Link
            href={emergencyHref}
            className="chip border-emergency/30 bg-emergency-50 font-semibold text-emergency-700 hover:border-emergency/50 hover:bg-emergency-100"
          >
            Терміново
          </Link>
        </div>
      </div>
    </div>
  );
}

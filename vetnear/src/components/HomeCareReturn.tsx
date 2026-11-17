"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getActivePetId, getPets } from "@/lib/pets/store";
import { isPetBackupRecord } from "@/lib/pets/validation";
import { careDateLabel, nextPetCareEvent } from "@/lib/pets/care";
import { PLACES } from "@/lib/data/places";
import type { PetProfile } from "@/lib/types";
import styles from "@/components/PetCare.module.css";

/** Personal content is read only after hydration and remains on this device. */
export function HomeCareReturn() {
  const [pet, setPet] = useState<PetProfile | null>(null);
  useEffect(() => {
    const refresh = () => {
      const stored = getPets();
      const pets = Array.isArray(stored) ? stored.filter(isPetBackupRecord) : [];
      setPet(pets.find((item) => item.id === getActivePetId()) ?? pets[0] ?? null);
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("storage", refresh); };
  }, []);
  if (!pet) return null;
  const next = nextPetCareEvent(pet);
  const clinic = PLACES.find((item) => item.id === pet.favoriteClinicId);
  return <section className={styles.return} aria-label={`Турбота про ${pet.name}`}>
    <div><h2>{pet.name} — турбота триває</h2><p className="mt-1">{next ? `${next.title} · ${careDateLabel(next.date)}` : "Збережіть наступну подію або контакт свого ветеринара."}</p><p className="mt-1 text-xs">Ваша картка в цьому браузері</p></div>
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
      <Link href={`/my-pets/${pet.id}`}>Відкрити медкартку <span aria-hidden className="ml-2">→</span></Link>
      {clinic ? <Link href={`/place/${clinic.slug}`}>Мій ветеринар</Link> : <Link href={`/my-pets/${pet.id}/records/new?type=reminder`}>Запланувати подію</Link>}
    </div>
  </section>;
}

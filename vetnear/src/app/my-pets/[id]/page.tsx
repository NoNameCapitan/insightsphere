"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PetProfileForm } from "@/components/PetProfileForm";
import { ShareRow } from "@/components/ShareRow";
import { ANIMAL_LABELS } from "@/lib/labels";
import { SITE } from "@/lib/seo";
import { petShareText } from "@/lib/share";
import { getPet } from "@/lib/pets/store";
import type { PetProfile } from "@/lib/types";

export default function PetDetailPage() {
  const params = useParams<{ id: string }>();
  const [pet, setPet] = useState<PetProfile | null | undefined>(undefined);

  useEffect(() => {
    setPet(getPet(params.id));
  }, [params.id]);

  if (pet === undefined) {
    return <div className="container-px mx-auto max-w-xl py-10 text-center text-ink/50">Завантаження…</div>;
  }
  if (pet === null) {
    return (
      <div className="container-px mx-auto max-w-xl py-10 text-center">
        <p className="text-ink/60">Профіль не знайдено.</p>
        <Link href="/my-pets" className="btn btn-brand mt-4">До моїх тварин</Link>
      </div>
    );
  }

  return (
    <div className="container-px mx-auto max-w-xl py-6">
      <Link href="/my-pets" className="text-sm text-brand hover:underline">← Мої тварини</Link>
      <h1 className="mt-2 font-display text-2xl font-extrabold text-ink">{pet.name}</h1>
      <div className="mt-3">
        <Link href="/nearby" className="btn btn-ghost w-full">Знайти послуги поруч →</Link>
      </div>

      <div className="mt-4 card p-4">
        <p className="font-medium text-ink">Поділитися карткою улюбленця</p>
        <p className="mt-1 text-sm text-ink/60">Згенеруйте посилання для Telegram, Viber або Facebook.</p>
        <div className="mt-3">
          <ShareRow text={petShareText(pet.name, ANIMAL_LABELS[pet.animalType])} url={`${SITE.url}/my-pets`} />
        </div>
      </div>
      <div className="mt-5">
        <PetProfileForm existing={pet} />
      </div>
    </div>
  );
}

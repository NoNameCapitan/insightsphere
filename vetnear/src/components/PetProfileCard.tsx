import Link from "next/link";
import { ANIMAL_LABELS } from "@/lib/labels";
import { PetPortrait } from "@/components/PetPortrait";
import { nextPetCareEvent } from "@/lib/pets/care";
import type { PetProfile } from "@/lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long" }).format(new Date(`${value}T12:00:00`));
}

export function PetProfileCard({ pet, active }: { pet: PetProfile; active?: boolean }) {
  const event = nextPetCareEvent(pet);
  const age = pet.ageYears != null ? `${pet.ageYears} р${pet.ageMonths ? ` ${pet.ageMonths} міс` : ""}` : null;

  return (
    <article className={`pet-record-card overflow-hidden rounded-3xl border bg-white p-4 sm:p-5 ${active ? "border-brand-300" : "border-brand-100"}`}>
      <div className="flex items-start gap-3.5">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[20px] border border-brand-100 bg-brand-50">
          <PetPortrait name={pet.name} photoUrl={pet.photoUrl} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="truncate font-display text-lg font-bold text-ink">{pet.name}</h2>
              <p className="mt-0.5 truncate text-sm text-ink/65">{ANIMAL_LABELS[pet.animalType]}{pet.breed ? ` · ${pet.breed}` : ""}{age ? ` · ${age}` : ""}</p>
            </div>
            {active && <span className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700">Активна</span>}
          </div>

        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-canvas px-3 py-2.5">

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ink/65">Наступна подія</p>
          <p className="truncate text-sm font-semibold text-ink">{event ? `${event.title} · ${formatDate(event.date)}` : "Запланованих подій немає"}</p>
        </div>
      </div>

      <Link href={`/my-pets/${pet.id}`} className="btn btn-ghost mt-3 w-full py-2.5 text-sm">Відкрити медкартку</Link>
    </article>
  );
}

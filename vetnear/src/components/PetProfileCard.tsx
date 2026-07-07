import Link from "next/link";
import { ANIMAL_LABELS } from "@/lib/labels";
import type { PetProfile } from "@/lib/types";

export function PetProfileCard({
  pet,
  active,
}: {
  pet: PetProfile;
  active?: boolean;
}) {
  const age =
    pet.ageYears != null
      ? `${pet.ageYears} р${pet.ageMonths ? ` ${pet.ageMonths} міс` : ""}`
      : null;
  return (
    <Link
      href={`/my-pets/${pet.id}`}
      className={`card flex items-center gap-3 p-4 ${
        active ? "ring-2 ring-brand" : ""
      }`}
    >
      <div
        aria-hidden
        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-2xl"
      >
        {pet.animalType === "cat" ? "🐱" : pet.animalType === "dog" ? "🐶" : "🐾"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display font-bold text-ink">
          {pet.name}
          {active && <span className="ml-2 text-xs text-brand">активний</span>}
        </p>
        <p className="truncate text-sm text-ink/60">
          {ANIMAL_LABELS[pet.animalType]}
          {pet.breed ? ` · ${pet.breed}` : ""}
          {age ? ` · ${age}` : ""}
        </p>
      </div>
      <span aria-hidden className="text-brand">→</span>
    </Link>
  );
}

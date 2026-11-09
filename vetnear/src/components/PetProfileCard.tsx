import Link from "next/link";
import Image from "next/image";
import { ANIMAL_LABELS } from "@/lib/labels";
import { PetProfileIcon } from "@/components/icons/ServiceIcons";
import { ReminderIcon } from "@/components/icons/MedicalIcons";
import type { PetProfile } from "@/lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long" }).format(new Date(`${value}T12:00:00`));
}

function nextEvent(pet: PetProfile) {
  const today = new Date().toISOString().slice(0, 10);
  const events = [
    ...(pet.vaccinations ?? []).flatMap((item) => item.nextDate ? [{ date: item.nextDate, label: `Вакцинація · ${item.name}` }] : []),
    ...(pet.treatments ?? []).flatMap((item) => item.nextDate ? [{ date: item.nextDate, label: item.kind === "deworming" ? "Протиглисна обробка" : "Захист від бліх і кліщів" }] : []),
    ...(pet.reminders ?? []).filter((item) => !item.completed).map((item) => ({ date: item.date, label: item.title })),
  ].filter((item) => item.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  return events[0] ?? null;
}

function completeness(pet: PetProfile) {
  const values = [pet.photoUrl, pet.breed, pet.birthDate || pet.ageYears != null, pet.weightKg, pet.microchipNumber, (pet.vaccinations?.length ?? 0) > 0];
  return Math.round((values.filter(Boolean).length / values.length) * 100);
}

export function PetProfileCard({ pet, active }: { pet: PetProfile; active?: boolean }) {
  const event = nextEvent(pet);
  const age = pet.ageYears != null ? `${pet.ageYears} р${pet.ageMonths ? ` ${pet.ageMonths} міс` : ""}` : null;
  const progress = completeness(pet);

  return (
    <article className={`pet-record-card overflow-hidden rounded-3xl border bg-white p-4 sm:p-5 ${active ? "border-brand-300" : "border-brand-100"}`}>
      <div className="flex items-start gap-3.5">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[20px] border border-brand-100 bg-brand-50">
          {pet.photoUrl ? <Image unoptimized src={pet.photoUrl} alt="" width={64} height={64} className="h-full w-full object-cover" /> : <PetProfileIcon className="h-full w-full p-1.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="truncate font-display text-lg font-bold text-ink">{pet.name}</h2>
              <p className="mt-0.5 truncate text-sm text-ink/55">{ANIMAL_LABELS[pet.animalType]}{pet.breed ? ` · ${pet.breed}` : ""}{age ? ` · ${age}` : ""}</p>
            </div>
            {active && <span className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700">Активна</span>}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-50"><span className="block h-full rounded-full bg-brand" style={{ width: `${progress}%` }} /></div>
            <span className="text-[11px] tabular-nums text-ink/45">Картка {progress}%</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-canvas px-3 py-2.5">
        <ReminderIcon className="h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-ink/45">Наступна подія</p>
          <p className="truncate text-sm font-semibold text-ink">{event ? `${event.label} · ${formatDate(event.date)}` : "Додайте вакцинацію або нагадування"}</p>
        </div>
      </div>

      <Link href={`/my-pets/${pet.id}`} className="btn btn-ghost mt-3 w-full py-2.5 text-sm">Відкрити медкартку</Link>
    </article>
  );
}

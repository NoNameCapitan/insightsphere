import type { PetProfile } from "@/lib/types";
import { isCalendarDate } from "@/lib/pets/validation";

export type PetCareEvent = { id: string; date: string; title: string; reminderId?: string };

/** Care dates are entered by the owner; no medical interval is inferred. */
export function getPetCareEvents(pet: PetProfile): PetCareEvent[] {
  return [
    ...(pet.vaccinations ?? []).flatMap((item) => item.nextDate ? [{ id: `vaccination-${item.id}`, date: item.nextDate, title: `Вакцинація · ${item.name}` }] : []),
    ...(pet.treatments ?? []).flatMap((item) => item.nextDate ? [{ id: `treatment-${item.id}`, date: item.nextDate, title: item.kind === "deworming" ? "Протиглисна обробка" : "Захист від бліх і кліщів" }] : []),
    ...(pet.reminders ?? []).filter((item) => !item.completed).map((item) => ({ id: `reminder-${item.id}`, reminderId: item.id, date: item.date, title: item.title })),
  ].filter((item) => isCalendarDate(item.date)).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function careToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function nextPetCareEvent(pet: PetProfile, today = careToday()): PetCareEvent | null {
  return getPetCareEvents(pet).find((item) => item.date >= today) ?? null;
}

export function careDateLabel(date: string): string {
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00Z`));
}

/** A preferred place is an explicit filter, never an invented user coordinate. */
export function petClinicSearchHref(pet: PetProfile): string {
  const query = new URLSearchParams({ category: "veterinary_clinic", animal: pet.animalType });
  if (pet.preferredLocality?.trim()) query.set("locality", pet.preferredLocality.trim());
  else if (pet.preferredDistrict) query.set("district", pet.preferredDistrict);
  return `/nearby?${query}`;
}

"use client";
// Pet profile store (Module 1). localStorage-backed CRUD + active pet selection.
import { track } from "@/lib/analytics";
import { makeId, nowIso, readJSON, writeJSON } from "@/lib/storage";
import type {
  PetDocument,
  PetProfile,
  PetReminder,
  PetTreatment,
  PetVaccination,
  PetVisit,
  PetWeightEntry,
} from "@/lib/types";

const KEY = "vetnear:pets";
const ACTIVE_KEY = "vetnear:active-pet";

export function getPets(): PetProfile[] {
  return readJSON<PetProfile[]>(KEY, []);
}

export function getPet(id: string): PetProfile | null {
  return getPets().find((p) => p.id === id) ?? null;
}

export function createPet(
  input: Omit<PetProfile, "id" | "createdAt" | "updatedAt">,
): PetProfile {
  const pet: PetProfile = {
    ...input,
    id: makeId("pet"),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const next = [pet, ...getPets()];
  writeJSON(KEY, next);
  setActivePetId(pet.id);
  track("pet_profile_created", { animalType: pet.animalType });
  return pet;
}

export function updatePet(id: string, patch: Partial<PetProfile>): PetProfile | null {
  const pets = getPets();
  const idx = pets.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  pets[idx] = { ...pets[idx], ...patch, id, updatedAt: nowIso() };
  writeJSON(KEY, pets);
  return pets[idx];
}

export function deletePet(id: string): void {
  writeJSON(KEY, getPets().filter((p) => p.id !== id));
  if (getActivePetId() === id) {
    const remaining = getPets();
    setActivePetId(remaining[0]?.id ?? null);
  }
}

export function getActivePetId(): string | null {
  return readJSON<string | null>(ACTIVE_KEY, null);
}

export function setActivePetId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) {
    writeJSON(ACTIVE_KEY, id);
    track("pet_profile_selected", { petId: id });
  } else localStorage.removeItem(ACTIVE_KEY);
}

export function getActivePet(): PetProfile | null {
  const id = getActivePetId();
  return id ? getPet(id) : null;
}

export function addVaccination(petId: string, input: Omit<PetVaccination, "id" | "createdAt">) {
  const pet = getPet(petId);
  if (!pet) return null;
  const entry: PetVaccination = { ...input, id: makeId("vaccination"), createdAt: nowIso() };
  return updatePet(petId, { vaccinations: [entry, ...(pet.vaccinations ?? [])] });
}

export function addTreatment(petId: string, input: Omit<PetTreatment, "id" | "createdAt">) {
  const pet = getPet(petId);
  if (!pet) return null;
  const entry: PetTreatment = { ...input, id: makeId("treatment"), createdAt: nowIso() };
  return updatePet(petId, { treatments: [entry, ...(pet.treatments ?? [])] });
}

export function addVisit(petId: string, input: Omit<PetVisit, "id" | "createdAt">) {
  const pet = getPet(petId);
  if (!pet) return null;
  const entry: PetVisit = { ...input, id: makeId("visit"), createdAt: nowIso() };
  return updatePet(petId, { visits: [entry, ...(pet.visits ?? [])] });
}

export function addWeight(petId: string, input: Omit<PetWeightEntry, "id" | "createdAt">) {
  const pet = getPet(petId);
  if (!pet) return null;
  const entry: PetWeightEntry = { ...input, id: makeId("weight"), createdAt: nowIso() };
  const weightHistory = [entry, ...(pet.weightHistory ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  return updatePet(petId, { weightKg: entry.weightKg, weightHistory });
}

export function addDocument(petId: string, input: Omit<PetDocument, "id" | "createdAt">) {
  const pet = getPet(petId);
  if (!pet) return null;
  const entry: PetDocument = { ...input, id: makeId("document"), createdAt: nowIso() };
  return updatePet(petId, { documents: [entry, ...(pet.documents ?? [])] });
}

export function addReminder(petId: string, input: Omit<PetReminder, "id" | "createdAt">) {
  const pet = getPet(petId);
  if (!pet) return null;
  const entry: PetReminder = { ...input, id: makeId("reminder"), createdAt: nowIso() };
  return updatePet(petId, { reminders: [entry, ...(pet.reminders ?? [])] });
}

export function toggleReminder(petId: string, reminderId: string) {
  const pet = getPet(petId);
  if (!pet) return null;
  return updatePet(petId, {
    reminders: (pet.reminders ?? []).map((item) =>
      item.id === reminderId ? { ...item, completed: !item.completed } : item,
    ),
  });
}

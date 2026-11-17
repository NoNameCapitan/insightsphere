"use client";
// Pet profile store (Module 1). localStorage-backed CRUD + active pet selection.
import { track } from "@/lib/analytics";
import { makeId, nowIso, readJSON, writeJSON } from "@/lib/storage";
import { isPetBackupRecord } from "@/lib/pets/validation";
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

/** Keep display reads safe without treating unreadable medical data as an empty store. */
function readPetCollection(): { pets: PetProfile[]; readable: boolean } {
  if (typeof window === "undefined") return { pets: [], readable: true };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return { pets: [], readable: true };
    const value: unknown = JSON.parse(raw);
    // Guard the fields list/profile readers use directly. Do not discard damaged
    // members or apply the stricter backup validator to legacy optional fields.
    if (Array.isArray(value) && value.every((pet) => pet !== null && typeof pet === "object" && !Array.isArray(pet) &&
      typeof pet.id === "string" && typeof pet.name === "string" && typeof pet.animalType === "string")) {
      return { pets: value as PetProfile[], readable: true };
    }
  } catch { /* Display may continue; mutations must not replace unreadable data. */ }
  return { pets: [], readable: false };
}

function petsForWrite(): PetProfile[] {
  const collection = readPetCollection();
  if (!collection.readable) {
    throw new Error("Не вдалося прочитати наявні медкартки. Щоб не втратити дані, зміну зупинено. Не очищуйте дані браузера.");
  }
  return collection.pets;
}

function persistPets(pets: PetProfile[]): void {
  if (!writeJSON(KEY, pets)) {
    throw new Error("Не вдалося зберегти медкартку. Пам’ять браузера заповнена або зберігання вимкнене. Збережіть резервну копію наявних карток і спробуйте без вкладення або з меншим файлом.");
  }
}

export function getPets(): PetProfile[] {
  return readPetCollection().pets;
}

/** Lets the list distinguish an unreadable collection from a first-time empty state. */
export function getPetCollectionReadIssue(): string | null {
  return readPetCollection().readable ? null : "Не вдалося прочитати наявні медкартки. Дані не змінено. Перевірте доступ до сховища браузера й спробуйте ще раз. Не очищуйте дані браузера.";
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
  const next = [pet, ...petsForWrite()];
  persistPets(next);
  setActivePetId(pet.id);
  track("pet_profile_created", { animalType: pet.animalType });
  return pet;
}

export function updatePet(id: string, patch: Partial<PetProfile>): PetProfile | null {
  const pets = petsForWrite();
  const idx = pets.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  pets[idx] = { ...pets[idx], ...patch, id, updatedAt: nowIso() };
  persistPets(pets);
  return pets[idx];
}

export function deletePet(id: string): void {
  persistPets(petsForWrite().filter((p) => p.id !== id));
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
  } else {
    try { localStorage.removeItem(ACTIVE_KEY); } catch { /* Selection is optional; medical writes are checked separately. */ }
  }
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
  return updatePet(petId, { weightKg: weightHistory[0].weightKg, weightHistory });
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

// ── Backup (v1.23) ────────────────────────────────────────────────────────────
// Records live only in this browser, so the owner needs a way to keep a copy
// and to move it to another device.

const BACKUP_FORMAT = "vetnear-pets-backup";

export function exportPetsBackup(): string {
  return JSON.stringify({ format: BACKUP_FORMAT, version: 1, exportedAt: nowIso(), pets: getPets() }, null, 2);
}

/** Merges a backup into the stored pets (same id → replaced). Returns the count. */
export function importPetsBackup(raw: string): number {
  if (raw.length > 20_000_000) throw new Error("Файл завеликий. Оберіть резервну копію VetNear до 20 МБ.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Файл пошкоджений або це не копія VetNear.");
  }
  const data = parsed as { format?: string; version?: unknown; pets?: unknown };
  if (data?.format !== BACKUP_FORMAT || !Array.isArray(data.pets)) {
    throw new Error("Це не файл резервної копії VetNear.");
  }
  if (data.version !== 1) throw new Error("Ця версія резервної копії не підтримується. Наявні картки не змінено.");
  if (!data.pets.every(isPetBackupRecord)) {
    throw new Error("Копія містить пошкоджені картки або записи. Наявні картки не змінено.");
  }
  const incoming = data.pets as PetProfile[];
  if (incoming.length === 0) throw new Error("У файлі немає медкарток.");
  const ids = new Set(incoming.map((pet) => pet.id));
  if (ids.size !== incoming.length) throw new Error("У копії є повторні ідентифікатори карток. Наявні картки не змінено.");
  const current = petsForWrite();
  const existingById = new Map(current.map((pet) => [pet.id, pet]));
  if (incoming.some((pet) => {
    const existing = existingById.get(pet.id);
    return existing && Date.parse(existing.updatedAt) > Date.parse(pet.updatedAt);
  })) {
    throw new Error("Ця копія містить старіші версії наявних карток. Відновлення зупинено, щоб не втратити нові записи.");
  }
  persistPets([...incoming, ...current.filter((pet) => !ids.has(pet.id))]);
  if (!getActivePetId()) setActivePetId(incoming[0].id);
  return incoming.length;
}

// Shape rules for pet cards stored in the account (pure, shared by the API
// routes, the browser sync and the tests). The server never trusts the client:
// every card is rebuilt field by field from an allow-list.
import type {
  AnimalType,
  PetDocument,
  PetProfile,
  PetReminder,
  PetTreatment,
  PetVaccination,
  PetVisit,
  PetWeightEntry,
  Sex,
} from "@/lib/types";

export const MAX_PETS_PER_ACCOUNT = 20;
export const MAX_PET_BODY_BYTES = 300 * 1024;
const MAX_RECORDS = 200;
const MAX_PHOTO_CHARS = 120_000; // ≈ 90 KB image; the form downsizes photos first

const ANIMALS: AnimalType[] = ["cat", "dog", "bird", "rodent", "reptile", "exotic", "other"];
const SEXES: Sex[] = ["male", "female", "unknown"];
const PET_ID = /^[A-Za-z0-9_-]{6,64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidPetId(id: unknown): id is string {
  return typeof id === "string" && PET_ID.test(id);
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
function text(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
}
function date(v: unknown): string | undefined {
  return typeof v === "string" && ISO_DATE.test(v) ? v : undefined;
}
function num(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}
function iso(v: unknown): string {
  return typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : new Date().toISOString();
}
function list<T>(v: unknown, map: (item: Record<string, unknown>) => T | null): T[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: T[] = [];
  for (const item of v.slice(0, MAX_RECORDS)) {
    const mapped = map(obj(item));
    if (mapped) out.push(mapped);
  }
  return out;
}
const recordId = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : null);

/** A small inline avatar is allowed; anything else that looks like a file is dropped. */
function photo(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)) return undefined;
  return v.length <= MAX_PHOTO_CHARS ? v : undefined;
}

export type SanitizedPet = { ok: true; pet: PetProfile } | { ok: false; error: string };

/**
 * Rebuilds a pet card from untrusted input. Embedded files (document and
 * record attachments) are never accepted — they stay on the owner's device.
 */
export function sanitizePet(raw: unknown, id: string): SanitizedPet {
  const input = obj(raw);
  if (!isValidPetId(id)) return { ok: false, error: "invalid id" };
  const name = text(input.name, 60);
  if (!name) return { ok: false, error: "name is required" };
  const animalType = ANIMALS.includes(input.animalType as AnimalType) ? (input.animalType as AnimalType) : null;
  if (!animalType) return { ok: false, error: "invalid species" };

  const vaccinations = list<PetVaccination>(input.vaccinations, (v) => {
    const rid = recordId(v.id); const d = date(v.date); const n = text(v.name, 120);
    return rid && d && n
      ? { id: rid, date: d, name: n, nextDate: date(v.nextDate), clinicName: text(v.clinicName, 120), batchNumber: text(v.batchNumber, 60), createdAt: iso(v.createdAt) }
      : null;
  });
  const treatments = list<PetTreatment>(input.treatments, (v) => {
    const rid = recordId(v.id); const d = date(v.date); const n = text(v.name, 120);
    const kind = v.kind === "deworming" || v.kind === "flea_tick" ? v.kind : null;
    return rid && d && n && kind
      ? { id: rid, kind, date: d, name: n, nextDate: date(v.nextDate), weightKg: num(v.weightKg, 0.01, 999), createdAt: iso(v.createdAt) }
      : null;
  });
  const visits = list<PetVisit>(input.visits, (v) => {
    const rid = recordId(v.id); const d = date(v.date); const reason = text(v.reason, 200);
    return rid && d && reason
      ? { id: rid, date: d, reason, clinicName: text(v.clinicName, 120), outcome: text(v.outcome, 1000), placeId: text(v.placeId, 120), createdAt: iso(v.createdAt) }
      : null;
  });
  const weightHistory = list<PetWeightEntry>(input.weightHistory, (v) => {
    const rid = recordId(v.id); const d = date(v.date); const w = num(v.weightKg, 0.01, 999);
    return rid && d && w ? { id: rid, date: d, weightKg: w, createdAt: iso(v.createdAt) } : null;
  });
  const documents = list<PetDocument>(input.documents, (v) => {
    const rid = recordId(v.id); const d = date(v.date); const title = text(v.title, 160);
    return rid && d && title ? { id: rid, date: d, title, fileName: text(v.fileName, 160), createdAt: iso(v.createdAt) } : null;
  });
  const reminders = list<PetReminder>(input.reminders, (v) => {
    const rid = recordId(v.id); const d = date(v.date); const title = text(v.title, 200);
    return rid && d && title ? { id: rid, date: d, title, completed: v.completed === true ? true : undefined, createdAt: iso(v.createdAt) } : null;
  });

  const pet: PetProfile = {
    id,
    name,
    animalType,
    breed: text(input.breed, 80),
    ageYears: num(input.ageYears, 0, 60),
    ageMonths: num(input.ageMonths, 0, 11),
    sex: SEXES.includes(input.sex as Sex) ? (input.sex as Sex) : undefined,
    weightKg: num(input.weightKg, 0.01, 999),
    photoUrl: photo(input.photoUrl),
    birthDate: date(input.birthDate),
    microchipNumber: text(input.microchipNumber, 40),
    allergies: text(input.allergies, 500),
    importantNotes: text(input.importantNotes, 2000),
    favoriteClinicId: text(input.favoriteClinicId, 120),
    preferredDistrict: text(input.preferredDistrict, 40) as PetProfile["preferredDistrict"],
    emergencyNote: text(input.emergencyNote, 300),
    vaccinations,
    treatments,
    visits,
    weightHistory,
    documents,
    reminders,
    createdAt: iso(input.createdAt),
    updatedAt: iso(input.updatedAt),
  };
  return { ok: true, pet };
}

/** Database row shape of `pets` (see supabase/migrations/005_auth_pets.sql). */
export interface PetRow {
  owner_id?: string;
  id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string | null;
  birth_date: string | null;
  weight_kg: number | string | null;
  notes: string | null;
  record: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

/** Core fields go to typed columns; the rest of the card goes to `record`. */
export function petToRow(pet: PetProfile): Omit<PetRow, "owner_id" | "created_at" | "updated_at"> {
  const { id, name, animalType, breed, sex, birthDate, weightKg, importantNotes, ownerId: _owner, createdAt, updatedAt: _updated, ...rest } = pet;
  void _owner; void _updated;
  return {
    id,
    name,
    species: animalType,
    breed: breed ?? null,
    sex: sex ?? null,
    birth_date: birthDate ?? null,
    weight_kg: weightKg ?? null,
    notes: importantNotes ?? null,
    record: { ...JSON.parse(JSON.stringify(rest)), createdAt },
  };
}

export function rowToPet(row: PetRow): PetProfile {
  const record = obj(row.record);
  const merged = sanitizePet(
    {
      ...record,
      name: row.name,
      animalType: row.species,
      breed: row.breed ?? undefined,
      sex: row.sex ?? undefined,
      birthDate: row.birth_date ?? undefined,
      weightKg: row.weight_kg ?? undefined,
      importantNotes: row.notes ?? undefined,
      createdAt: record.createdAt ?? row.created_at,
      updatedAt: row.updated_at,
    },
    row.id,
  );
  const pet: PetProfile = merged.ok
    ? merged.pet
    : { id: row.id, name: row.name || "—", animalType: "other", createdAt: row.created_at ?? "", updatedAt: row.updated_at ?? "" };
  if (row.owner_id) pet.ownerId = row.owner_id;
  return pet;
}

// ── Device-only attachments ──────────────────────────────────────────────────
// Files attached to records stay in this browser. These helpers remove them
// before upload and put them back after a download.

type WithFile = { id: string; dataUrl?: string; documentDataUrl?: string };
const FILE_LISTS = ["vaccinations", "treatments", "visits", "documents"] as const;

export function stripFiles(pet: PetProfile): PetProfile {
  const copy: PetProfile = { ...pet };
  for (const key of FILE_LISTS) {
    const items = pet[key] as WithFile[] | undefined;
    if (items) (copy[key] as unknown) = items.map(({ dataUrl: _d, documentDataUrl: _dd, ...rest }) => { void _d; void _dd; return rest; });
  }
  if (copy.photoUrl && !photo(copy.photoUrl)) delete copy.photoUrl;
  return copy;
}

export function restoreFiles(fromCloud: PetProfile, local: PetProfile | undefined): PetProfile {
  if (!local) return fromCloud;
  const merged: PetProfile = { ...fromCloud };
  for (const key of FILE_LISTS) {
    const cloudItems = fromCloud[key] as WithFile[] | undefined;
    const localItems = local[key] as WithFile[] | undefined;
    if (!cloudItems || !localItems) continue;
    const files = new Map(localItems.map((item) => [item.id, item]));
    (merged[key] as unknown) = cloudItems.map((item) => {
      const kept = files.get(item.id);
      return kept ? { ...item, ...(kept.dataUrl ? { dataUrl: kept.dataUrl } : {}), ...(kept.documentDataUrl ? { documentDataUrl: kept.documentDataUrl } : {}) } : item;
    });
  }
  return merged;
}

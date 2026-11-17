import { ALL_ANIMALS } from "@/lib/labels";
import type { PetProfile } from "@/lib/types";

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value.length <= 10_000;
const isNonemptyText = (value: unknown): value is string => isText(value) && value.trim().length > 0;
const isPositive = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0;
const isTimestamp = (value: unknown) => isNonemptyText(value) && Number.isFinite(Date.parse(value));

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const isImage = (value: unknown) => typeof value === "string" && value.length <= 3_000_000 &&
  (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(value) || /^https?:\/\//.test(value));
const isDocument = (value: unknown) => typeof value === "string" && value.length <= 3_000_000 &&
  /^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/=\r\n]+$/.test(value);

function optional(value: unknown, check: (value: unknown) => boolean): boolean {
  return value === undefined || check(value);
}

function records(value: unknown, check: (item: Record<string, unknown>) => boolean): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every((item) => {
    if (!isObject(item) || !isNonemptyText(item.id) || ids.has(item.id) ||
      !isCalendarDate(item.date) || !isTimestamp(item.createdAt) || !check(item)) return false;
    ids.add(item.id);
    return true;
  });
}

/** Validate a whole backup before replacing any existing medical data. */
export function isPetBackupRecord(value: unknown): value is PetProfile {
  if (!isObject(value) || !isNonemptyText(value.id) || !isNonemptyText(value.name) ||
    typeof value.animalType !== "string" || !(ALL_ANIMALS as string[]).includes(value.animalType) ||
    !isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt)) return false;

  const textFields = ["breed", "ownerId", "microchipNumber", "allergies", "importantNotes", "favoriteClinicId", "preferredDistrict", "preferredLocality", "emergencyNote"];
  if (!textFields.every((key) => optional(value[key], isText))) return false;
  if (!optional(value.sex, (v) => ["male", "female", "unknown"].includes(String(v))) ||
    !optional(value.birthDate, isCalendarDate) || !optional(value.weightKg, isPositive) ||
    !optional(value.ageYears, (v) => typeof v === "number" && Number.isInteger(v) && v >= 0) ||
    !optional(value.ageMonths, (v) => typeof v === "number" && Number.isInteger(v) && v >= 0) ||
    !optional(value.photoUrl, isImage)) return false;

  const medical = (item: Record<string, unknown>) => isNonemptyText(item.name) &&
    optional(item.nextDate, isCalendarDate) && optional(item.documentDataUrl, isDocument);
  return records(value.vaccinations, (item) => medical(item) && optional(item.clinicName, isText) && optional(item.batchNumber, isText)) &&
    records(value.treatments, (item) => medical(item) && ["deworming", "flea_tick"].includes(String(item.kind)) && optional(item.weightKg, isPositive)) &&
    records(value.visits, (item) => isNonemptyText(item.reason) && optional(item.clinicName, isText) && optional(item.outcome, isText) && optional(item.placeId, isText) && optional(item.documentDataUrl, isDocument)) &&
    records(value.weightHistory, (item) => isPositive(item.weightKg)) &&
    records(value.documents, (item) => isNonemptyText(item.title) && optional(item.fileName, isText) && optional(item.dataUrl, isDocument)) &&
    records(value.reminders, (item) => isNonemptyText(item.title) && optional(item.completed, (v) => typeof v === "boolean"));
}

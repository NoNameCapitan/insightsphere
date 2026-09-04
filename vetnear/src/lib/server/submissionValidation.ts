// Pure server-side validation & sanitization for public API payloads.
// No I/O — fully unit-testable. The HONESTY RULES live here:
//  - partners can NEVER self-declare emergency (forced false),
//  - status/provenance are set by the server, not the client,
//  - all URLs pass the safe-URL gate, strings are length-capped.
import { isSafeUrl, isValidEmail, isValidPhone } from "@/lib/security/url";
import type { PartnerSubmission, ReportIssue } from "@/lib/types";

// Must cover every category the /add-place form offers (see CATEGORY_LABELS),
// so client options and server validation stay aligned. emergency_vet is
// listed for completeness but explicitly rejected below (never self-declared).
const CATEGORIES = [
  "veterinary_clinic", "emergency_vet", "vet_pharmacy", "pet_store", "grooming",
  "pet_boarding", "pet_friendly_place", "shelter", "animal_volunteer_help",
  "dog_walking", "dog_training", "other_pet_service",
] as const;
const DISTRICTS = [
  "pozniaky", "osokorky", "obolon", "podil", "troieshchyna",
  "holosiiv", "solomianka", "pechersk", "nyvky", "sviatoshyn",
] as const;
const REPORT_REASONS = [
  "wrong_phone", "wrong_address", "wrong_hours", "closed_permanently", "duplicate", "other",
] as const;

const MAX = { name: 120, description: 2000, address: 200, notes: 2000, message: 1000, generic: 300 };

export interface ValidationResult<T> {
  ok: boolean;
  errors: string[];
  value?: T;
}

const str = (v: unknown, cap: number): string =>
  typeof v === "string" ? v.trim().slice(0, cap) : "";

/** Validate + sanitize a public partner-submission payload.
 *  Returns a server-shaped PartnerSubmission (without id/timestamps). */
export function sanitizeSubmissionInput(
  body: unknown,
): ValidationResult<Omit<PartnerSubmission, "id" | "createdAt" | "updatedAt">> {
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;

  const name = str(b.name, MAX.name);
  const address = str(b.address, MAX.address);
  const phone = str(b.phone, 32);
  const category = str(b.category, 50);
  const district = str(b.district, 50);

  if (!name) errors.push("name is required");
  if (!address) errors.push("address is required");
  if (!phone || !isValidPhone(phone)) errors.push("valid phone is required");
  if (!(CATEGORIES as readonly string[]).includes(category)) errors.push("invalid category");
  if (!(DISTRICTS as readonly string[]).includes(district)) errors.push("invalid district");

  // HONESTY: no self-declared emergency category from the public form.
  if (category === "emergency_vet") errors.push("emergency_vet cannot be self-declared");

  // The client form requires both confirmations; direct API submissions must
  // not be able to skip them.
  if (b.representativeConfirmed !== true)
    errors.push("Потрібно підтвердити, що ви представляєте цей бізнес.");
  if (b.consentModeration !== true)
    errors.push("Потрібна згода на модерацію заявки.");

  const email = str(b.email, MAX.generic);
  if (email && !isValidEmail(email)) errors.push("invalid email");
  const website = str(b.website, MAX.generic);
  if (website && !isSafeUrl(website)) errors.push("unsafe website url");
  const mapLink = str(b.mapLink, MAX.generic);
  if (mapLink && !isSafeUrl(mapLink)) errors.push("unsafe map link");

  const latitude = typeof b.latitude === "number" && Number.isFinite(b.latitude) ? b.latitude : undefined;
  const longitude = typeof b.longitude === "number" && Number.isFinite(b.longitude) ? b.longitude : undefined;
  const hasCoords = latitude !== undefined && longitude !== undefined;

  if (errors.length) return { ok: false, errors };

  const asStrArr = (v: unknown, capItems = 20): string[] =>
    Array.isArray(v) ? v.slice(0, capItems).map((x) => str(x, 80)).filter(Boolean) : [];

  const value: Omit<PartnerSubmission, "id" | "createdAt" | "updatedAt"> = {
    name,
    category: category as PartnerSubmission["category"],
    description: str(b.description, MAX.description),
    address,
    district: district as PartnerSubmission["district"],
    ...(hasCoords ? { latitude, longitude } : {}),
    phone,
    ...(email ? { email } : {}),
    ...(website ? { website } : {}),
    ...(mapLink ? { mapLink } : {}),
    services: asStrArr(b.services),
    animalTypes: asStrArr(b.animalTypes) as PartnerSubmission["animalTypes"],
    tags: asStrArr(b.tags, 10),
    notes: str(b.notes, MAX.notes) || undefined,
    contactPerson: str(b.contactPerson, MAX.generic) || undefined,
    representativeConfirmed: b.representativeConfirmed === true,
    consentModeration: b.consentModeration === true,
    // ── Server-enforced honesty (ignore whatever the client sent) ──
    emergencyAvailable: false, // NEVER from a public form; phone confirmation only
    appointmentRequired: b.appointmentRequired === true,
    deliveryAvailable: b.deliveryAvailable === true,
    pickupAvailable: b.pickupAvailable === true,
    phoneConfirmedAt: null,
    phoneConfirmedBy: null,
    status: "pending_review",
    dataSource: "partner_submitted",
    verificationStatus: hasCoords ? "needs_review" : "needs_geocoding",
  };
  return { ok: true, errors: [], value };
}

/** Validate a public "report incorrect info" payload. */
export function sanitizeReportInput(
  body: unknown,
): ValidationResult<Pick<ReportIssue, "placeId" | "reason" | "message">> {
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;
  const placeId = str(b.placeId, 120);
  const reason = str(b.reason, 40);
  const message = str(b.message, MAX.message);
  if (!placeId) errors.push("placeId is required");
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) errors.push("invalid reason");
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    value: { placeId, reason: reason as ReportIssue["reason"], ...(message ? { message } : {}) },
  };
}

/** Allowed moderation status transitions (admin API). */
export const MODERATION_STATUSES = [
  "approved", "rejected", "suspended", "changes_requested", "pending_review",
] as const;

export function isModerationStatus(s: unknown): s is (typeof MODERATION_STATUSES)[number] {
  return typeof s === "string" && (MODERATION_STATUSES as readonly string[]).includes(s);
}

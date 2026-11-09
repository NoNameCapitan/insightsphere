// Approved submission -> publishable Place (v1.9). Pure and deterministic, so
// the publishing decision is unit-testable without a database.
//
// Safety invariants enforced here (they are the product, not a formality):
//  1. emergencyAvailable / isOpen24_7 can NEVER be published from partner input
//     alone. Only a recorded phone confirmation unlocks them.
//  2. A place without valid coordinates is published as `needs_geocoding`, which
//     `isSearchablePublicPlace` already excludes from discovery and the map.
//  3. `verified` stays false until a human verifies; partner self-assertion is
//     provenance `partner_submitted`, not verification.
import { isWithinCityBounds } from "@/config/vertical";
import { VERTICAL } from "@/config/verticals/pet-care-kyiv";
import type {
  KyivDistrict,
  PartnerSubmission,
  Place,
  PlaceTier,
  WorkingHours,
} from "@/lib/types";

export interface PublishOptions {
  /** Moderator identity recorded on the published record. */
  actorId: string;
  now?: Date;
  tier?: PlaceTier;
}

export interface PublishRejection {
  ok: false;
  reason:
    | "not_approved"
    | "missing_name"
    | "missing_address"
    | "missing_phone"
    | "missing_district";
}

export type PublishResult = { ok: true; place: Place } | PublishRejection;

const SLUG_MAX = 60;

/** Transliterate Ukrainian text into a URL-safe slug. */
export function slugify(input: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh",
    з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n",
    о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
    ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia", ъ: "", ы: "y", э: "e",
    ё: "e",
  };
  const lower = input.toLowerCase();
  let out = "";
  for (const ch of lower) {
    if (map[ch] !== undefined) out += map[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else out += "-";
  }
  return out.replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, SLUG_MAX) || "place";
}

function hasCoords(s: PartnerSubmission): boolean {
  if (typeof s.latitude !== "number" || typeof s.longitude !== "number") return false;
  // Sanity box comes from the vertical config — a mistyped coordinate must not
  // land on the map, and another city brings its own bounds.
  return isWithinCityBounds(VERTICAL, s.latitude, s.longitude);
}

/** A phone confirmation is the ONLY thing that can unlock urgent claims. */
export function isPhoneConfirmed(s: PartnerSubmission): boolean {
  return Boolean(s.phoneConfirmedAt && s.phoneConfirmedBy);
}

export function submissionToPlace(
  submission: PartnerSubmission,
  opts: PublishOptions,
): PublishResult {
  if (submission.status !== "approved") return { ok: false, reason: "not_approved" };
  if (!submission.name?.trim()) return { ok: false, reason: "missing_name" };
  if (!submission.address?.trim()) return { ok: false, reason: "missing_address" };
  if (!submission.phone?.trim()) return { ok: false, reason: "missing_phone" };
  if (!submission.district) return { ok: false, reason: "missing_district" };

  const now = opts.now ?? new Date();
  const iso = now.toISOString();
  const coordsOk = hasCoords(submission);
  const phoneConfirmed = isPhoneConfirmed(submission);

  const place: Place = {
    id: submission.id,
    slug: `${slugify(submission.name)}-${submission.id.slice(-6)}`,
    name: submission.name.trim(),
    category: submission.category,
    description:
      submission.description?.trim() ||
      `${submission.name.trim()} — заклад для тварин у Києві. Дані надані представником закладу.`,
    address: submission.address.trim(),
    district: submission.district as KyivDistrict,
    latitude: coordsOk ? (submission.latitude as number) : 0,
    longitude: coordsOk ? (submission.longitude as number) : 0,
    phone: submission.phone.trim(),
    email: submission.email,
    website: submission.website,
    socialLinks: submission.socialLinks,
    workingHours: (submission.workingHours ?? []) as WorkingHours[],
    // Invariant 1: urgent claims require a recorded phone call.
    isOpen24_7: false,
    emergencyAvailable: phoneConfirmed ? Boolean(submission.emergencyAvailable) : false,
    services: submission.services ?? [],
    animalTypes: submission.animalTypes ?? [],
    tags: submission.tags ?? [],
    hasSurgery: false,
    hasUltrasound: false,
    hasXray: false,
    hasPharmacy: false,
    appointmentRequired: Boolean(submission.appointmentRequired),
    deliveryAvailable: Boolean(submission.deliveryAvailable),
    pickupAvailable: Boolean(submission.pickupAvailable),
    // Invariant 3: partner self-assertion is not verification.
    verified: phoneConfirmed,
    claimed: true,
    status: "approved",
    rating: 0,
    createdAt: submission.createdAt ?? iso,
    updatedAt: iso,
    dataSource: "partner_submitted",
    // Invariant 2: no coordinates => excluded from discovery until geocoded.
    verificationStatus: !coordsOk
      ? "needs_geocoding"
      : phoneConfirmed
        ? "verified"
        : "unverified",
    lastVerifiedAt: phoneConfirmed ? submission.phoneConfirmedAt ?? iso : null,
    verifiedBy: phoneConfirmed ? submission.phoneConfirmedBy ?? opts.actorId : null,
    sourceLabel: "Заявка представника закладу",
    dataWarning: phoneConfirmed
      ? undefined
      : "Дані надані закладом і ще не підтверджені дзвінком — уточніть перед візитом.",
    phoneConfirmedAt: submission.phoneConfirmedAt ?? null,
    phoneConfirmedBy: submission.phoneConfirmedBy ?? null,
    tier: opts.tier ?? "free",
    promotedUntil: null,
  };

  return { ok: true, place };
}

/** Runtime guard for rows read back out of `published_places.data`. */
export function isPlaceLike(value: unknown): value is Place {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.slug === "string" &&
    typeof p.name === "string" &&
    typeof p.category === "string" &&
    typeof p.address === "string" &&
    typeof p.phone === "string" &&
    typeof p.latitude === "number" &&
    typeof p.longitude === "number" &&
    Array.isArray(p.animalTypes) &&
    Array.isArray(p.services)
  );
}

/**
 * Merge the server-published layer on top of the bundled seed dataset.
 * Published rows win on id/slug collision; order is stable (seed first).
 */
export function mergePlaceLayers(seed: Place[], published: Place[]): Place[] {
  const byId = new Map<string, Place>();
  for (const p of seed) byId.set(p.id, p);
  for (const p of published) {
    // Drop any seed entry that shares this slug under a different id.
    for (const [id, existing] of byId) {
      if (existing.slug === p.slug && id !== p.id) byId.delete(id);
    }
    byId.set(p.id, p);
  }
  return [...byId.values()];
}

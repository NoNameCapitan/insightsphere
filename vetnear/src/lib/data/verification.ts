// Emergency & verification safety helpers (P0.3). Pure, server-safe.
import { isDemoPlace, verificationOf } from "@/lib/data/provenance";
import { hasRecentPhoneConfirmation } from "@/lib/data/phoneConfirmation";
import type { Place } from "@/lib/types";

export function isEmergencyPlace(p: Pick<Place, "category" | "emergencyAvailable" | "isOpen24_7">): boolean {
  return p.category === "emergency_vet" || p.emergencyAvailable === true || p.isOpen24_7 === true;
}

/**
 * An emergency listing is only "safe" to present as real emergency care when it
 * has a phone confirmation no older than 30 days and an approved, verified status.
 * Public-source verification alone is not evidence of emergency intake.
 * Demo/unverified emergency places may be shown only
 * behind a strong warning (and ideally hidden from emergency-first results).
 */
export function isEmergencySearchSafe(p: Place, now: Date = new Date()): boolean {
  if (!isEmergencyPlace(p)) return true;
  return p.status === "approved" && verificationOf(p) === "verified" &&
    !isDemoPlace(p) && hasRecentPhoneConfirmation(p, now) && Boolean(p.phone?.trim());
}

/** Alias matching the helper name used across the app. */
export const isEmergencySafePlace = isEmergencySearchSafe;

export const EMERGENCY_DATA_WARNING =
  "Прийом зараз не підтверджено. Зателефонуйте до клініки перед виїздом.";

export const EMERGENCY_DEMO_NOTE =
  "У цьому середовищі дані про невідкладну допомогу — демонстраційні/неперевірені.";

// Emergency demo visibility (final hardening).
// Default OFF: demo/unverified emergency listings are hidden from public
// emergency-first results. Enable only in dev/staging with
// NEXT_PUBLIC_SHOW_DEMO_EMERGENCY=true.
export const SHOW_DEMO_EMERGENCY =
  process.env.NEXT_PUBLIC_SHOW_DEMO_EMERGENCY === "true";

/**
 * Whether a place may appear in PUBLIC emergency-first results. Non-emergency
 * places are unaffected; phone-confirmed emergency places show; demo/unverified
 * emergency places show only when SHOW_DEMO_EMERGENCY is explicitly enabled.
 */
export function isPublicEmergencyVisible(p: Place, now: Date = new Date()): boolean {
  if (!isEmergencyPlace(p)) return true;
  if (isEmergencySearchSafe(p, now)) return true;
  return SHOW_DEMO_EMERGENCY;
}

export const EMERGENCY_EMPTY_STATE =
  "У добірці немає закладів зі свіжим телефонним підтвердженням невідкладної допомоги. Зателефонуйте до найближчої клініки, щоб уточнити прийом.";

/**
 * A place counts as a real, phone-confirmed emergency option only when
 * `emergencyAvailable` is set AND the phone confirmation evidence is valid.
 * A demo visibility flag never turns a demo record into a confirmed provider.
 * This says nothing about 24/7 hours or whether a doctor can accept a patient now.
 */
export function isPhoneConfirmedEmergency(p: Place, now: Date = new Date()): boolean {
  return (p.category === "veterinary_clinic" || p.category === "emergency_vet") &&
    p.emergencyAvailable === true && isEmergencySearchSafe(p, now);
}
export function hasPhoneConfirmedEmergency(places: Place[], now: Date = new Date()): boolean {
  return places.some((place) => isPhoneConfirmedEmergency(place, now));
}

// Safer emergency CTA used while there are 0 phone-confirmed emergency places:
// route to the nearest vet clinics instead of promising 24/7 availability.
export const SAFE_EMERGENCY_CTA_LABEL = "Термінова ситуація — показати найближчі ветклініки";
export const SAFE_EMERGENCY_CTA_HREF = "/nearby?category=veterinary_clinic&sort=distance&urgent=1";

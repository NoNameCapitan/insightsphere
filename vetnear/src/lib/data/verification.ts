// Emergency & verification safety helpers (P0.3). Pure, server-safe.
import { isVerifiedPlace } from "@/lib/data/provenance";
import type { Place } from "@/lib/types";

export function isEmergencyPlace(p: Pick<Place, "category" | "emergencyAvailable" | "isOpen24_7">): boolean {
  return p.category === "emergency_vet" || p.emergencyAvailable === true || p.isOpen24_7 === true;
}

/**
 * An emergency listing is only "safe" to present as real emergency care when it
 * has been manually verified. Demo/unverified emergency places may be shown only
 * behind a strong warning (and ideally hidden from emergency-first results).
 */
export function isEmergencySearchSafe(p: Place): boolean {
  if (!isEmergencyPlace(p)) return true;
  return isVerifiedPlace(p);
}

/** Alias matching the helper name used across the app. */
export const isEmergencySafePlace = isEmergencySearchSafe;

export const EMERGENCY_DATA_WARNING =
  "Дані про невідкладну допомогу мають бути перевірені вручну перед публічним запуском. Телефонуйте у клініку напряму та підтвердьте, що вони приймають зараз.";

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
 * places are unaffected; verified emergency places always show; demo/unverified
 * emergency places show only when SHOW_DEMO_EMERGENCY is explicitly enabled.
 */
export function isPublicEmergencyVisible(p: Place): boolean {
  if (!isEmergencyPlace(p)) return true;
  if (isEmergencySearchSafe(p)) return true;
  return SHOW_DEMO_EMERGENCY;
}

export const EMERGENCY_EMPTY_STATE =
  "Списки невідкладної допомоги потребують ручної перевірки перед публічним запуском. Телефонуйте у клініку напряму.";

/**
 * A place counts as a real, phone-confirmed emergency option only when
 * `emergencyAvailable` is set (we only set it after a phone call) AND it is
 * publicly visible. Until then the emergency feature must not promise 24/7 care.
 */
export function isPhoneConfirmedEmergency(p: Place): boolean {
  return Boolean(p.emergencyAvailable) && isEmergencySearchSafe(p) && isPublicEmergencyVisible(p);
}
export function hasPhoneConfirmedEmergency(places: Place[]): boolean {
  return places.some(isPhoneConfirmedEmergency);
}

// Safer emergency CTA used while there are 0 phone-confirmed emergency places:
// route to the nearest vet clinics instead of promising 24/7 availability.
export const SAFE_EMERGENCY_CTA_LABEL = "Термінова ситуація — показати найближчі ветклініки";
export const SAFE_EMERGENCY_CTA_HREF = "/nearby?category=veterinary_clinic&sort=distance";

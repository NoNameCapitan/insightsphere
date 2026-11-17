/** Shared evidence check for publishing and public trust claims. */
export function hasRecordedPhoneConfirmation(record: {
  phoneConfirmedAt?: string | null;
  phoneConfirmedBy?: string | null;
}): boolean {
  const at = record.phoneConfirmedAt;
  const by = record.phoneConfirmedBy;
  if (typeof at !== "string" || typeof by !== "string" || !by.trim()) return false;
  // Legacy records may contain a date; newer moderation records use ISO instants.
  // Reject arbitrary Date.parse inputs and impossible calendar dates.
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(at)) return false;
  if (!Number.isFinite(Date.parse(at))) return false;
  const day = at.slice(0, 10);
  const calendarDate = new Date(`${day}T00:00:00Z`);
  return Number.isFinite(calendarDate.getTime()) && calendarDate.toISOString().slice(0, 10) === day;
}

/** Editorial refresh window for contact / stated emergency capability evidence.
 * A recent call is not proof that a clinician can accept a patient right now.
 * Structural evidence remains available for audit even after this window expires.
 */
export const PHONE_CONFIRMATION_MAX_AGE_DAYS = 30;
export type PhoneConfirmationFreshness = "unrecorded" | "current" | "stale" | "future";

export function phoneConfirmationFreshness(record: {
  phoneConfirmedAt?: string | null;
  phoneConfirmedBy?: string | null;
}, now: Date = new Date()): PhoneConfirmationFreshness {
  if (!hasRecordedPhoneConfirmation(record) || !Number.isFinite(now.getTime())) return "unrecorded";
  const at = Date.parse(record.phoneConfirmedAt!);
  const age = now.getTime() - at;
  if (age < 0) return "future";
  return age <= PHONE_CONFIRMATION_MAX_AGE_DAYS * 86_400_000 ? "current" : "stale";
}

export function hasRecentPhoneConfirmation(record: {
  phoneConfirmedAt?: string | null;
  phoneConfirmedBy?: string | null;
}, now: Date = new Date()): boolean {
  return phoneConfirmationFreshness(record, now) === "current";
}

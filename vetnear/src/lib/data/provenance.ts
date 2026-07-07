// Data provenance helpers (P0 — data honesty). Pure, server-safe.
import type { DataSource, Place, VerificationStatus } from "@/lib/types";

export function dataSourceOf(p: { dataSource?: DataSource }): DataSource {
  return p.dataSource ?? "demo";
}

export function verificationOf(p: {
  verificationStatus?: VerificationStatus;
}): VerificationStatus {
  return p.verificationStatus ?? "demo";
}

/** A place is "demo" when its source or verification says so (missing => demo). */
export function isDemoPlace(p: Place): boolean {
  return dataSourceOf(p) === "demo" || verificationOf(p) === "demo";
}

/** Verified means a human confirmed it (verified status or manually-verified source). */
export function isVerifiedPlace(p: Place): boolean {
  return verificationOf(p) === "verified" || dataSourceOf(p) === "manual_verified";
}

export function hasCoordinates(p: Place): boolean {
  return (
    typeof p.latitude === "number" &&
    typeof p.longitude === "number" &&
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude)
  );
}

/** A place needs geocoding if flagged so, or it simply has no valid coordinates. */
export function needsGeocoding(p: Place): boolean {
  return verificationOf(p) === "needs_geocoding" || !hasCoordinates(p);
}

/**
 * Only places that are approved, not rejected/needs-geocoding, and have valid
 * coordinates may appear in public, distance-based discovery / on the map.
 */
export function isSearchablePublicPlace(p: Place): boolean {
  if (p.status !== "approved") return false;
  const v = verificationOf(p);
  if (v === "rejected" || v === "needs_geocoding") return false;
  return hasCoordinates(p);
}

export interface DataBadge {
  label: string;
  tone: "demo" | "unverified" | "verified" | "review";
}

/** UI badge describing how trustworthy this record is. */
export function getDataBadge(p: Place): DataBadge | null {
  const v = verificationOf(p);
  if (isDemoPlace(p)) return { label: "Демо-дані", tone: "demo" };
  if (v === "verified") return { label: verificationLabel(p), tone: "verified" };
  if (v === "needs_review") return { label: "На перевірці", tone: "review" };
  if (v === "unverified") return { label: "Не перевірено", tone: "unverified" };
  return null;
}

/**
 * Honest label for a verified place. Current places are verified against public
 * sources; a place that has been phone-confirmed (verifiedBy mentions a call)
 * gets the stronger "Підтверджено дзвінком".
 */
export function verificationLabel(p: Place): string {
  const by = (p.verifiedBy ?? "").toLowerCase();
  if (/дзвінк|подзвон|phone|call/.test(by)) return "Підтверджено дзвінком";
  return "Перевірено за публічними джерелами";
}

/** Inline warning text for a place, or null when the data is verified. */
export function getDataWarning(p: Place): string | null {
  if (p.dataWarning) return p.dataWarning;
  if (isDemoPlace(p))
    return "Демонстраційні дані — це не реальний заклад. Телефонуйте, щоб підтвердити.";
  if (!isVerifiedPlace(p))
    return "Дані не перевірені — телефонуйте, щоб підтвердити перед візитом.";
  return null;
}

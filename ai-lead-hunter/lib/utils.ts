// Small, dependency-free utilities used across the app.

import type { Lead, RawBusiness } from "./types";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// Haversine distance in kilometres.
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/["'`’.,()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePhone(s?: string): string {
  if (!s) return "";
  return s.replace(/[^\d]/g, "");
}

export function normalizeWebsite(s?: string): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

// Deduplicate raw businesses by place id, phone, website, or name+address.
export function dedupeBusinesses(items: RawBusiness[]): RawBusiness[] {
  const seen = new Set<string>();
  const out: RawBusiness[] = [];
  for (const b of items) {
    const keys = [
      b.sourcePlaceId && `pid:${b.sourcePlaceId}`,
      `na:${normalizeName(b.name)}|${normalizeName(b.address)}`,
    ].filter(Boolean) as string[];
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    out.push(b);
  }
  return out;
}

export function makeId(prefix = "lead"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now()
    .toString(36)
    .slice(-4)}`;
}

export function leadHasFlag(lead: Lead, type: string): boolean {
  return lead.signals.some((s) => s.type === type);
}

export function safeNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

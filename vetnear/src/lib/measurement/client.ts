"use client";
import { campaignCodes, isMeasurementId, sanitizeCampaign, type Campaign } from "./schema";
export const MEASUREMENT_OPTOUT_KEY = "vetnear:measurement-optout";
const SESSION_KEY = "vetnear:measurement-session";
const TTL = 30 * 60_000;
type Visit = { id: string; last: number; campaign: Campaign };
let memory: Visit | null = null;
export function measurementAllowed(): boolean {
  if (typeof window === "undefined" || process.env.NEXT_PUBLIC_MEASUREMENT_ENABLED !== "1") return false;
  if (navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return false;
  try { return localStorage.getItem(MEASUREMENT_OPTOUT_KEY) !== "1"; } catch { return false; }
}
/** A random tab session, never a device fingerprint; no medical or geographic data. */
export function measurementVisit(): Visit | null {
  if (!measurementAllowed() || !globalThis.crypto?.randomUUID) return null;
  const now = Date.now();
  let prior = memory;
  try { const saved = sessionStorage.getItem(SESSION_KEY); if (saved) prior = JSON.parse(saved); } catch { /* memory-only fallback */ }
  if (!prior || !isMeasurementId(prior.id) || !Number.isFinite(prior.last) || now - prior.last > TTL || prior.last > now) {
    const q = new URLSearchParams(window.location.search);
    prior = { id: crypto.randomUUID(), last: now, campaign: sanitizeCampaign({ source: q.get("utm_source"), medium: q.get("utm_medium"), campaign: q.get("utm_campaign") }, campaignCodes(process.env.NEXT_PUBLIC_MEASUREMENT_CAMPAIGN_CODES)) };
  }
  memory = { ...prior, last: now, campaign: sanitizeCampaign(prior.campaign, campaignCodes(process.env.NEXT_PUBLIC_MEASUREMENT_CAMPAIGN_CODES)) };
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(memory)); } catch { /* current-page session remains useful */ }
  return memory;
}
export function setMeasurementOptOut(value: boolean): boolean {
  try { localStorage.setItem(MEASUREMENT_OPTOUT_KEY, value ? "1" : "0"); if (value) { memory = null; sessionStorage.removeItem(SESSION_KEY); } return true; } catch { return false; }
}

// Lead events (v1.9) — the signal a partner actually pays for, and the number
// that makes this product valuable to a buyer. Pure module: validation, privacy
// hashing and aggregation live here so they can be tested without a database.
//
// Privacy stance: we never store an IP, a user agent or a user id. The session
// hash is salted AND day-bucketed, so the same visitor produces a different
// digest tomorrow. That is enough for "don't count the same tap five times"
// and deliberately not enough for cross-day tracking.
import { createHash, randomBytes } from "node:crypto";
import type { LeadEventInput, LeadEventType, LeadSummary } from "@/lib/types";

export const LEAD_EVENT_TYPES: LeadEventType[] = [
  "call",
  "route",
  "website",
  "social",
  "request",
  "detail_view",
];

/** Events a partner is billed/credited for as a real lead (not just a view). */
export const BILLABLE_LEAD_TYPES: LeadEventType[] = ["call", "route", "request"];

const PLACE_ID_RE = /^[a-z0-9][a-z0-9_-]{1,79}$/i;
const SOURCE_PATH_MAX = 120;

export function isLeadEventType(value: unknown): value is LeadEventType {
  return typeof value === "string" && (LEAD_EVENT_TYPES as string[]).includes(value);
}

export type LeadParseResult =
  | { ok: true; value: LeadEventInput }
  | { ok: false; error: string };

/** Strict, allowlist-based parsing of an untrusted request body. */
export function parseLeadEvent(body: unknown): LeadParseResult {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const b = body as Record<string, unknown>;

  const placeId = typeof b.placeId === "string" ? b.placeId.trim() : "";
  if (!PLACE_ID_RE.test(placeId)) return { ok: false, error: "invalid_place_id" };

  if (!isLeadEventType(b.eventType)) return { ok: false, error: "invalid_event_type" };

  let sourcePath: string | undefined;
  if (typeof b.sourcePath === "string" && b.sourcePath.startsWith("/")) {
    // Path only — never a full URL, never a query string with user data.
    sourcePath = b.sourcePath.split("?")[0].slice(0, SOURCE_PATH_MAX);
  }

  return { ok: true, value: { placeId, eventType: b.eventType, sourcePath } };
}

/** UTC day bucket (YYYY-MM-DD) — the rotation window for the session hash. */
export function dayBucket(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Salted, day-rotating session digest. `clientKey` is whatever the route has
 * (usually the proxy IP) — it is hashed immediately and never stored raw.
 */
export function sessionHash(
  clientKey: string,
  salt: string,
  now: Date = new Date(),
): string {
  return createHash("sha256")
    .update(`${dayBucket(now)}:${salt}:${clientKey}`)
    .digest("hex")
    .slice(0, 32);
}

export function leadEventId(now: Date = new Date()): string {
  return `lead_${now.getTime().toString(36)}_${randomBytes(6).toString("hex")}`;
}

interface RawLeadRow {
  place_id: string;
  event_type: string;
  created_at: string;
}

function emptyTotals(): Record<LeadEventType, number> {
  return {
    call: 0,
    route: 0,
    website: 0,
    social: 0,
    request: 0,
    detail_view: 0,
  };
}

/**
 * Aggregate raw rows into the partner-dashboard shape. `daily` is dense: every
 * day in the range gets an entry, so a chart has no gaps to misinterpret.
 */
export function aggregateLeadEvents(
  rows: RawLeadRow[],
  placeId: string,
  rangeDays: number,
  now: Date = new Date(),
): LeadSummary {
  const totals = emptyTotals();
  const perDay = new Map<string, number>();

  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    perDay.set(dayBucket(d), 0);
  }

  let total = 0;
  for (const row of rows) {
    if (row.place_id !== placeId) continue;
    if (!isLeadEventType(row.event_type)) continue;
    totals[row.event_type] += 1;
    total += 1;
    const day = row.created_at.slice(0, 10);
    if (perDay.has(day)) perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  return {
    placeId,
    totals,
    total,
    daily: [...perDay.entries()].map(([date, count]) => ({ date, count })),
    rangeDays,
  };
}

/** Billable leads only — what an invoice would be built from. */
export function countBillableLeads(summary: LeadSummary): number {
  return BILLABLE_LEAD_TYPES.reduce((sum, t) => sum + summary.totals[t], 0);
}

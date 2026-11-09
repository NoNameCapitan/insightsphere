"use client";
// Client-side lead reporting (v1.9).
//
// Fires alongside the existing `track()` analytics call. The difference matters:
// `track()` is a local/demo debug stream, this one is the server-side record a
// partner is shown and billed on.
//
// Uses `navigator.sendBeacon` so the event survives the navigation that a
// tel:/maps: link triggers — a plain fetch is frequently cancelled there.
import type { LeadEventType } from "@/lib/types";

const ENDPOINT = "/api/events/lead";

/** Local de-dupe so one impatient double-tap is not two leads. */
const recent = new Map<string, number>();
const DEDUPE_MS = 5_000;

export function reportLead(placeId: string, eventType: LeadEventType): void {
  if (typeof window === "undefined") return;
  if (!placeId) return;

  const key = `${placeId}:${eventType}`;
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < DEDUPE_MS) return;
  recent.set(key, now);

  const payload = JSON.stringify({
    placeId,
    eventType,
    sourcePath: window.location.pathname,
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
    // Fallback: keepalive fetch, still survives most unloads.
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      /* lead reporting is best-effort and must never break navigation */
    });
  } catch {
    /* ignore */
  }
}

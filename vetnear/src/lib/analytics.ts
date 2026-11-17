"use client";
import type { AnalyticsEvent, AnalyticsEventName } from "@/lib/types";
import { isMeasurementName, measurementRoute, sanitizeProps, type MeasurementName } from "@/lib/measurement/schema";
import { measurementVisit } from "@/lib/measurement/client";
const KEY = "vetnear:analytics";
const recent = new Map<string, number>();
/** Debug history stays local. Only the allowlisted first-party funnel may be transmitted. */
export function track(name: AnalyticsEventName | MeasurementName, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const safeProps = sanitizeProps(props);
  const event = { name, props: safeProps, ts: Date.now() };
  // Opt-in developer history only: no default persistence of private app activity.
  if (process.env.NODE_ENV === "development") {
    try { const prev = getEventHistory(); localStorage.setItem(KEY, JSON.stringify([event, ...prev].slice(0, 200))); } catch { /* best effort */ }
  }
  if (!isMeasurementName(name) || window.location.pathname.startsWith("/admin") || window.location.pathname.startsWith("/partner/")) return;
  try {
  const visit = measurementVisit(); if (!visit || !globalThis.crypto?.randomUUID) return;
  const route = measurementRoute(window.location.pathname);
  const key = JSON.stringify([name, safeProps, route]);
  if (event.ts - (recent.get(key) ?? 0) < 1500) return;
  if (recent.size > 100) recent.clear(); recent.set(key, event.ts);
  const body = JSON.stringify({ id: crypto.randomUUID(), sessionId: visit.id, name, route, props: safeProps, campaign: visit.campaign });
    if (navigator.sendBeacon?.("/api/events/analytics", new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/events/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* measurement must never block a product action */ }
}
export function getEventHistory(): AnalyticsEvent[] {
  if (typeof window === "undefined") return [];
  try { const value: unknown = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(value) ? value.slice(0, 200).filter(e => e && typeof e.name === "string" && typeof e.ts === "number").map(e => ({ ...e, props: sanitizeProps(e.props) })) : []; } catch { return []; }
}
export function clearEventHistory(): void { try { if (typeof window !== "undefined") localStorage.removeItem(KEY); } catch { /* storage unavailable */ } }

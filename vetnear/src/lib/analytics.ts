"use client";
// Lightweight analytics abstraction (Module 10).
// MVP: console + optional localStorage history. Swap `provider` later.
import type { AnalyticsEvent, AnalyticsEventName } from "@/lib/types";

const KEY = "vetnear:analytics";
const MAX = 200;

interface AnalyticsProvider {
  capture(event: AnalyticsEvent): void;
}

const consoleProvider: AnalyticsProvider = {
  capture(e) {
    if (typeof console !== "undefined") {
      console.debug("[analytics]", e.name, e.props ?? {});
    }
  },
};

// Future: replace with a real adapter (PostHog, GA4, custom).
const provider: AnalyticsProvider = consoleProvider;

export function track(
  name: AnalyticsEventName,
  props?: Record<string, unknown>,
): void {
  const event: AnalyticsEvent = { name, props, ts: Date.now() };
  provider.capture(event);
  if (typeof window === "undefined") return;
  try {
    const prev: AnalyticsEvent[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    prev.unshift(event);
    localStorage.setItem(KEY, JSON.stringify(prev.slice(0, MAX)));
  } catch {
    /* storage best-effort */
  }
}

export function getEventHistory(): AnalyticsEvent[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function clearEventHistory(): void {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
}

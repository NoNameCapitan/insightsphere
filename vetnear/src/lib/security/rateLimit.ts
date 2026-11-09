// Rate-limit readiness (P2.15). MOCK ONLY — not real protection.
// Real production rate limiting MUST be enforced server-side at the
// API/route-handler/provider level (per-IP/session token bucket, etc.).
export type RateLimitAction =
  | "add_place"
  | "report_issue"
  | "lost_found"
  | "service_request"
  | "pet_scan";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// In-memory window (per browser tab). Trivially bypassable — do not rely on it.
const WINDOW_MS = 60_000;
const LIMITS: Record<RateLimitAction, number> = {
  add_place: 5,
  report_issue: 10,
  lost_found: 10,
  service_request: 10,
  pet_scan: 20,
};
const buckets = new Map<string, { count: number; resetAt: number }>();

/** Mock client-side check. Returns allowed=true generously; for UX hints only. */
export function checkRateLimitMock(key: string, action: RateLimitAction): RateLimitResult {
  const now = Date.now();
  const id = `${action}:${key}`;
  const limit = LIMITS[action];
  let b = buckets.get(id);
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(id, b);
  }
  b.count += 1;
  return { allowed: b.count <= limit, remaining: Math.max(0, limit - b.count), resetAt: b.resetAt };
}

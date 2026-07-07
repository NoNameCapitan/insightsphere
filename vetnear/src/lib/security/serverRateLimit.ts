// Server-side rate limiting for API route handlers (real protection,
// unlike the client-side `checkRateLimitMock` which is UX-only).
//
// Fixed-window in-memory limiter, keyed by client identity (usually IP).
// Good enough for a single Node instance (`next start`, one container).
// LIMITATION: memory is per-process — on serverless/multi-instance deploys
// (Vercel, multiple replicas) switch the store to Redis/Upstash while keeping
// this same interface. Do NOT ship the assistant route without a limiter:
// it spends real Anthropic API money.

export interface ServerRateLimitOptions {
  /** Max requests per window. */
  limit: number;
  /** Window length in ms. */
  windowMs: number;
}

export interface ServerRateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Epoch ms when the window resets. */
  resetAt: number;
  /** Seconds until reset (for the Retry-After header). */
  retryAfterSec: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const MAX_BUCKETS = 10_000; // hard cap so the map can't grow unbounded

export function createServerRateLimiter(opts: ServerRateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  function sweep(now: number) {
    // Cheap cleanup: drop expired buckets when the map gets large.
    if (buckets.size < MAX_BUCKETS) return;
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
    // Still full of live buckets (attack) → drop oldest-resetting entries.
    if (buckets.size >= MAX_BUCKETS) {
      const oldest = [...buckets.entries()]
        .sort((a, b) => a[1].resetAt - b[1].resetAt)
        .slice(0, Math.ceil(MAX_BUCKETS / 10));
      for (const [k] of oldest) buckets.delete(k);
    }
  }

  return function check(key: string, now: number = Date.now()): ServerRateLimitResult {
    sweep(now);
    let b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, b);
    }
    b.count += 1;
    const allowed = b.count <= opts.limit;
    return {
      allowed,
      remaining: Math.max(0, opts.limit - b.count),
      resetAt: b.resetAt,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    };
  };
}

/**
 * Best-effort client key from proxy headers. Behind a trusted proxy
 * (Vercel/Nginx) `x-forwarded-for`'s first hop is the client IP.
 * Falls back to a shared bucket key when no header is present (still
 * protects total spend, just less granular).
 */
export function clientKeyFromRequest(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "anonymous";
}

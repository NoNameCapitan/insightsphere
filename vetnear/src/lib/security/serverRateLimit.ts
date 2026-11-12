// Server-side API rate limiting. With Upstash REST env vars counters are
// shared across Vercel instances; otherwise a bounded process-local fallback
// keeps previews and local development protected.

export interface ServerRateLimitOptions {
  namespace?: string;
  limit: number;
  windowMs: number;
}

export interface ServerRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
}

interface Bucket { count: number; resetAt: number }
interface RedisConfig { url: string; token: string }

const MAX_BUCKETS = 10_000;
const REDIS_TIMEOUT_MS = 2_500;
let warnedAboutRedis = false;

function redisConfig(): RedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token || !/^https:\/\//i.test(url)) return null;
  return { url, token };
}

function safePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9:._-]/g, "_").slice(0, 120);
}

async function redisCommand<T>(config: RedisConfig, command: Array<string | number>): Promise<T> {
  const response = await fetch(config.url, {
    method: "POST",
    signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
    headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Upstash returned ${response.status}`);
  const payload = (await response.json()) as { result?: T; error?: string };
  if (payload.error || payload.result === undefined) {
    throw new Error(payload.error || "Upstash returned no result");
  }
  return payload.result;
}

const INCREMENT_SCRIPT = [
  "local current = redis.call('INCR', KEYS[1])",
  "if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('PTTL', KEYS[1])",
  "return {current, ttl}",
].join("\n");

function warnAndFallback(error: unknown): void {
  if (warnedAboutRedis) return;
  warnedAboutRedis = true;
  console.error("[rate-limit] distributed store unavailable; using process-local fallback", error);
}

function createMemoryCounter() {
  const buckets = new Map<string, Bucket>();
  function sweep(now: number) {
    if (buckets.size < MAX_BUCKETS) return;
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
    if (buckets.size >= MAX_BUCKETS) {
      const oldest = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt)
        .slice(0, Math.ceil(MAX_BUCKETS / 10));
      for (const [key] of oldest) buckets.delete(key);
    }
  }
  return (key: string, windowMs: number, now: number): Bucket => {
    sweep(now);
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    return bucket;
  };
}

export function createServerRateLimiter(opts: ServerRateLimitOptions) {
  const incrementMemory = createMemoryCounter();
  const namespace = safePart(opts.namespace || "default");
  return async function check(key: string, now: number = Date.now()): Promise<ServerRateLimitResult> {
    const normalizedKey = safePart(key) || "anonymous";
    const config = redisConfig();
    let count: number;
    let resetAt: number;
    if (config) {
      try {
        const result = await redisCommand<[number, number]>(config, [
          "EVAL", INCREMENT_SCRIPT, 1, `vetnear:rl:${namespace}:${normalizedKey}`, opts.windowMs,
        ]);
        count = Number(result[0]);
        const ttl = Math.max(1, Number(result[1]));
        if (!Number.isFinite(count) || !Number.isFinite(ttl)) throw new Error("Invalid Upstash counter response");
        resetAt = now + ttl;
      } catch (error) {
        warnAndFallback(error);
        const bucket = incrementMemory(normalizedKey, opts.windowMs, now);
        count = bucket.count;
        resetAt = bucket.resetAt;
      }
    } else {
      const bucket = incrementMemory(normalizedKey, opts.windowMs, now);
      count = bucket.count;
      resetAt = bucket.resetAt;
    }
    return {
      allowed: count <= opts.limit,
      remaining: Math.max(0, opts.limit - count),
      resetAt,
      retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    };
  };
}

export interface FailureTracker {
  isBlocked(key: string, now?: number): Promise<boolean>;
  recordFailure(key: string, now?: number): Promise<void>;
  clear(key: string): Promise<void>;
}

export function createServerFailureTracker(opts: ServerRateLimitOptions): FailureTracker {
  const namespace = safePart(opts.namespace || "failures");
  const failures = new Map<string, Bucket>();
  const redisKey = (key: string) => `vetnear:fail:${namespace}:${safePart(key) || "anonymous"}`;
  return {
    async isBlocked(key, now = Date.now()) {
      const config = redisConfig();
      if (config) {
        try {
          const value = await redisCommand<string | null>(config, ["GET", redisKey(key)]);
          return Number(value ?? 0) >= opts.limit;
        } catch (error) { warnAndFallback(error); }
      }
      const current = failures.get(key);
      if (!current) return false;
      if (current.resetAt <= now) { failures.delete(key); return false; }
      return current.count >= opts.limit;
    },
    async recordFailure(key, now = Date.now()) {
      const config = redisConfig();
      if (config) {
        try {
          await redisCommand<[number, number]>(config, [
            "EVAL", INCREMENT_SCRIPT, 1, redisKey(key), opts.windowMs,
          ]);
          return;
        } catch (error) { warnAndFallback(error); }
      }
      if (failures.size > 5_000) failures.clear();
      const current = failures.get(key);
      if (!current || current.resetAt <= now) failures.set(key, { count: 1, resetAt: now + opts.windowMs });
      else current.count += 1;
    },
    async clear(key) {
      failures.delete(key);
      const config = redisConfig();
      if (!config) return;
      try { await redisCommand<number>(config, ["DEL", redisKey(key)]); }
      catch (error) { warnAndFallback(error); }
    },
  };
}

export function clientKeyFromRequest(req: Request): string {
  const candidates = [
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0],
    req.headers.get("x-real-ip"),
    req.headers.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const raw of candidates) {
    const value = raw?.trim().toLowerCase();
    if (value && /^[0-9a-f:.]{3,45}$/.test(value)) return value;
  }
  return "anonymous";
}

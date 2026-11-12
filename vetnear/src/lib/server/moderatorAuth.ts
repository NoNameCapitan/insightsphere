// Moderator authentication (v1.9). Replaces the single shared ADMIN_TOKEN with
// per-moderator, revocable, attributable tokens.
//
// Why not Supabase Auth right now: the moderation panel is a server-rendered
// internal tool with a handful of operators. Hashed per-actor tokens give the
// three properties the shared secret was missing — revocation, attribution and
// role separation — without dragging a session/cookie layer into every route.
// Supabase Auth remains the next step for partner-facing accounts.
import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import {
  clientKeyFromRequest,
  createServerFailureTracker,
} from "@/lib/security/serverRateLimit";

export type ModeratorRole = "moderator" | "admin";

export interface ModeratorIdentity {
  actorId: string;
  role: ModeratorRole;
  label: string;
}

/** Tokens are only ever compared and stored as digests. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// -- Brute-force protection (v1.26) --
// After MAX_FAILURES bad tokens from one client within the window, every
// attempt from that client is refused until the window expires.
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 10 * 60_000;
const failureTracker = createServerFailureTracker({
  namespace: "moderator-auth",
  limit: MAX_FAILURES,
  windowMs: FAILURE_WINDOW_MS,
});

function readToken(req: Request): string {
  const header = req.headers.get("x-admin-token");
  if (header) return header;
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return "";
}

/**
 * Resolve the caller's moderator identity, or null.
 *
 * Only revocable, attributable database tokens are accepted. The legacy
 * shared ADMIN_TOKEN path was removed in v1.30.
 */
export async function authenticateModerator(
  req: Request,
  db: SupabaseClient | null = getSupabaseAdmin(),
): Promise<ModeratorIdentity | null> {
  const token = readToken(req);
  if (!token || token.length > 512) return null;
  const clientKey = clientKeyFromRequest(req);
  if (await failureTracker.isBlocked(clientKey)) return null;

  if (db) {
    const digest = hashToken(token);
    const { data, error } = await db
      .from("moderator_tokens")
      .select("id,label,role,revoked_at")
      .eq("token_hash", digest)
      .is("revoked_at", null)
      .limit(1);

    if (!error && data?.length) {
      const row = data[0] as { id: string; label: string; role: ModeratorRole };
      // Best-effort last-seen; never blocks the request.
      void db
        .from("moderator_tokens")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", row.id);
      await failureTracker.clear(clientKey);
      return {
        actorId: row.id,
        role: row.role === "admin" ? "admin" : "moderator",
        label: row.label,
      };
    }
  }

  await failureTracker.recordFailure(clientKey);
  return null;
}

/** Guard for routes that only an admin may call (tier changes, token issuing). */
export function requireRole(
  identity: ModeratorIdentity | null,
  role: ModeratorRole,
): boolean {
  if (!identity) return false;
  if (role === "moderator") return true;
  return identity.role === "admin";
}

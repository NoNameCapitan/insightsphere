// Moderator authentication (v1.9). Replaces the single shared ADMIN_TOKEN with
// per-moderator, revocable, attributable tokens.
//
// Why not Supabase Auth right now: the moderation panel is a server-rendered
// internal tool with a handful of operators. Hashed per-actor tokens give the
// three properties the shared secret was missing — revocation, attribution and
// role separation — without dragging a session/cookie layer into every route.
// Supabase Auth remains the next step for partner-facing accounts.
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export type ModeratorRole = "moderator" | "admin";

export interface ModeratorIdentity {
  actorId: string;
  role: ModeratorRole;
  label: string;
  /** True when the legacy env ADMIN_TOKEN was used (bootstrap path). */
  legacy: boolean;
}

/** Tokens are only ever compared and stored as digests. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function constantTimeEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

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
 * Order: database token first (revocable, attributable), then the legacy env
 * ADMIN_TOKEN as a bootstrap so an existing deployment keeps working while
 * real tokens are issued.
 */
export async function authenticateModerator(
  req: Request,
  db: SupabaseClient | null = getSupabaseAdmin(),
): Promise<ModeratorIdentity | null> {
  const token = readToken(req);
  if (!token) return null;

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
      return {
        actorId: row.id,
        role: row.role === "admin" ? "admin" : "moderator",
        label: row.label,
        legacy: false,
      };
    }
  }

  const legacy = process.env.ADMIN_TOKEN;
  if (legacy && constantTimeEquals(token, legacy)) {
    return {
      actorId: "legacy_admin_token",
      role: "admin",
      label: "ADMIN_TOKEN (bootstrap)",
      legacy: true,
    };
  }

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

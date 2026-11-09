#!/usr/bin/env node
// Issue / list / revoke moderator tokens (v1.9).
//
// Replaces the shared ADMIN_TOKEN with per-person, revocable credentials.
// The plaintext token is printed EXACTLY ONCE — only its SHA-256 digest is
// stored, so a database leak does not hand out moderation access.
//
//   node scripts/moderator-token.mjs issue "Ірина (модератор)" moderator
//   node scripts/moderator-token.mjs list
//   node scripts/moderator-token.mjs revoke <id>
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const hash = (token) => createHash("sha256").update(token).digest("hex");
const [, , command, ...args] = process.argv;

async function issue(label, role = "moderator") {
  if (!label) {
    console.error('Usage: issue "Label" [moderator|admin]');
    process.exit(1);
  }
  if (!["moderator", "admin"].includes(role)) {
    console.error("Role must be 'moderator' or 'admin'.");
    process.exit(1);
  }
  // 32 random bytes, url-safe. Long enough that brute force is not a concern.
  const token = randomBytes(32).toString("base64url");
  const id = `mod_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;

  const { error } = await db.from("moderator_tokens").insert({
    id,
    label,
    token_hash: hash(token),
    role,
  });
  if (error) {
    console.error("Failed to issue token:", error.message);
    process.exit(1);
  }

  console.log(`\n  id:    ${id}`);
  console.log(`  label: ${label}`);
  console.log(`  role:  ${role}`);
  console.log(`\n  TOKEN (shown once, store it in a password manager):\n\n  ${token}\n`);
}

async function list() {
  const { data, error } = await db
    .from("moderator_tokens")
    .select("id,label,role,created_at,last_used_at,revoked_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to list tokens:", error.message);
    process.exit(1);
  }
  if (!data?.length) {
    console.log("No moderator tokens issued yet.");
    return;
  }
  for (const row of data) {
    const state = row.revoked_at ? `revoked ${row.revoked_at}` : "active";
    const seen = row.last_used_at ?? "never used";
    console.log(`${row.id}  [${row.role}]  ${row.label}  — ${state}, last seen: ${seen}`);
  }
}

async function revoke(id) {
  if (!id) {
    console.error("Usage: revoke <id>");
    process.exit(1);
  }
  const { error } = await db
    .from("moderator_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("Failed to revoke:", error.message);
    process.exit(1);
  }
  // Revocation is a timestamp, not a delete: the audit trail must survive.
  console.log(`Revoked ${id}. Past moderation events remain attributed to it.`);
}

switch (command) {
  case "issue":
    await issue(args[0], args[1]);
    break;
  case "list":
    await list();
    break;
  case "revoke":
    await revoke(args[0]);
    break;
  default:
    console.log("Commands: issue \"Label\" [role] | list | revoke <id>");
    process.exit(1);
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clientKeyFromRequest } from "@/lib/security/serverRateLimit";
import { sanitizeReportInput, sanitizeSubmissionInput } from "@/lib/server/submissionValidation";

const req = (headers: Record<string, string>) => new Request("http://localhost/api/x", { headers });
const valid = {
  name: "Vet", address: "Kyiv, Street 1", phone: "+380441234567", category: "veterinary_clinic",
  district: "pecherskyi", representativeConfirmed: true, consentModeration: true,
};

describe("v1.26 hardening", () => {
  it("prefers the platform-set IP header over a spoofable x-forwarded-for", () => {
    expect(clientKeyFromRequest(req({ "x-forwarded-for": "9.9.9.9", "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientKeyFromRequest(req({ "x-forwarded-for": "9.9.9.9", "x-vercel-forwarded-for": "1.1.1.1" }))).toBe("1.1.1.1");
  });
  it("ignores garbage client keys (no unbounded bucket names)", () => {
    expect(clientKeyFromRequest(req({ "x-forwarded-for": "x".repeat(500) }))).toBe("anonymous");
  });
  it("only accepts http(s) website links without credentials", () => {
    expect(sanitizeSubmissionInput({ ...valid, website: "https://ok.example" }).ok).toBe(true);
    expect(sanitizeSubmissionInput({ ...valid, website: "tel:+380441234567" }).ok).toBe(false);
    expect(sanitizeSubmissionInput({ ...valid, website: "https://user:pw@evil.example" }).ok).toBe(false);
  });
  it("drops unknown animal types and out-of-range coordinates", () => {
    const r = sanitizeSubmissionInput({ ...valid, animalTypes: ["cat", "<script>"], latitude: 500, longitude: 30.5 });
    expect(r.value?.animalTypes).toEqual(["cat"]);
    expect(r.value?.latitude).toBeUndefined();
  });
  it("rejects malformed report placeId", () => {
    expect(sanitizeReportInput({ placeId: "../../etc", reason: "other" }).ok).toBe(false);
  });

  it("uses an immutable UTC day expression for lead de-duplication", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/002_publishing_leads_moderators.sql"), "utf8");
    expect(migration).toContain("created_at at time zone 'UTC'");
    expect(migration).not.toContain("(created_at::date)");
  });

  it("makes the moderation audit trail update- and delete-proof", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/003_security_hardening.sql"), "utf8");
    expect(migration).toContain("before update or delete on moderation_events");
  });

  it("uses cryptographic randomness for moderation event identifiers", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/admin/submissions/route.ts"), "utf8");
    expect(route).toContain("randomBytes(6)");
    expect(route).not.toContain("Math.random()");
  });

  it("ships a rollback-only database post-check and a secret-safe runner", () => {
    const sql = readFileSync(join(process.cwd(), "scripts/vetnear-003-postcheck.sql"), "utf8");
    const runner = readFileSync(join(process.cwd(), "scripts/run-db-postcheck.mjs"), "utf8");
    expect(sql).toContain("SET LOCAL ROLE service_role");
    expect(sql.match(/ROLLBACK;/g)).toHaveLength(2);
    expect(sql).toMatch(/before update or delete/i);
    expect(runner).toContain("PGDATABASE: databaseUrl");
    expect(runner).not.toContain('console.log(databaseUrl)');
  });

  it("ships an idempotent weekly lead-retention schedule", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/004_lead_retention_schedule.sql"), "utf8");
    expect(migration).toContain("create extension if not exists pg_cron");
    expect(migration).toContain("cron.unschedule(existing_job)");
    expect(migration).toContain("select public.purge_old_lead_events()");
  });

  it("requires distributed limits and rejects legacy admin auth at the release gate", () => {
    const gate = readFileSync(join(process.cwd(), "scripts/release-gate.mjs"), "utf8");
    const auth = readFileSync(join(process.cwd(), "src/lib/server/moderatorAuth.ts"), "utf8");
    expect(gate).toContain('requireValue("UPSTASH_REDIS_REST_URL")');
    expect(gate).toContain('requireValue("UPSTASH_REDIS_REST_TOKEN")');
    expect(gate).toContain('value("ADMIN_TOKEN")');
    expect(gate).toContain("must be removed");
    expect(auth).not.toContain("process.env.ADMIN_TOKEN");
  });
});

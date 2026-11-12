// Runs every migration against a real Postgres engine (PGlite, in memory) and
// checks the guarantees the app relies on: owner-only pet cards under RLS,
// server-only billing tables, idempotent prepaid activation and expiry.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const DIR = join(process.cwd(), "supabase/migrations");
const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

let db: PGlite;
const rows = async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => (await db.query<T>(sql, params)).rows;
const attempt = async (sql: string, params?: unknown[]) => {
  try {
    return { rows: await rows(sql, params), error: "" };
  } catch (cause) {
    return { rows: [], error: cause instanceof Error ? cause.message : String(cause) };
  }
};
/** Runs `fn` as a Supabase role with the given user id in the JWT. */
async function as<T>(role: "anon" | "authenticated" | "service_role", userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId ?? ""}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
const activate = (args: unknown[]) =>
  as("service_role", null, async () => (await rows<{ r: Record<string, unknown> }>(`select billing_activate_plan($1,$2,$3,$4,$5,$6,$7,$8,$9) r`, args))[0].r);

async function applyMigrations() {
  for (const file of readdirSync(DIR).sort()) {
    // pg_cron itself is not available in the test engine; a stand-in schema is.
    await db.exec(readFileSync(join(DIR, file), "utf8").replace(/create extension if not exists pg_cron;/g, ""));
  }
}

describe("migrations on a real database", () => {
  beforeAll(async () => {
    db = new PGlite();
    // The parts of a Supabase project the migrations expect to exist.
    await db.exec(`
      create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to anon, authenticated, service_role;
      create schema cron;
      create table cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
      create function cron.schedule(n text, s text, c text) returns bigint language sql as $$ insert into cron.job(jobname, schedule, command) values (n, s, c) returning jobid $$;
      create function cron.unschedule(j bigint) returns boolean language sql as $$ delete from cron.job where jobid = j returning true $$;
    `);
    await applyMigrations();
    await applyMigrations(); // every migration must be safe to run twice
    await db.exec(`grant all on all tables in schema public to service_role; grant execute on all functions in schema public to service_role;`);
    await rows(`insert into auth.users values ($1,'alice@example.com'),($2,'bob@example.com')`, [ALICE, BOB]);
    await rows(`insert into published_places (id, slug, data) values ('place-1','place-1','{}'), ('place-2','place-2','{}'), ('place-3','place-3','{}')`);
  }, 60_000);

  it("pet cards are visible and writable only by their owner", async () => {
    await as("authenticated", ALICE, () => rows(`insert into pets (id, name, species) values ('pet-aaaaaa','Барні','dog')`));
    expect((await rows(`select owner_id from pets`))[0].owner_id).toBe(ALICE);
    expect(await as("authenticated", ALICE, () => rows(`select id from pets`))).toHaveLength(1);
    expect(await as("authenticated", BOB, () => rows(`select id from pets`))).toHaveLength(0);
    expect(await as("authenticated", BOB, () => rows(`update pets set name='x' where id='pet-aaaaaa' returning id`))).toHaveLength(0);
    expect(await as("authenticated", BOB, () => rows(`delete from pets where id='pet-aaaaaa' returning id`))).toHaveLength(0);
    expect((await as("authenticated", BOB, () => attempt(`insert into pets (owner_id, id, name, species) values ($1,'pet-bbbbbb','x','cat')`, [ALICE]))).error).toMatch(/row-level security/);
    expect((await as("authenticated", ALICE, () => attempt(`update pets set owner_id=$1 where id='pet-aaaaaa'`, [BOB]))).error).toMatch(/row-level security/);
  });

  it("guests have no access to pet cards at all", async () => {
    expect((await as("anon", null, () => attempt(`select * from pets`))).error).toMatch(/permission denied/);
    expect((await as("anon", null, () => attempt(`insert into pets (owner_id,id,name,species) values ($1,'pet-cccccc','x','cat')`, [ALICE]))).error).toMatch(/permission denied/);
  });

  it("enforces the per-account limit and cascades on account deletion", async () => {
    for (let i = 0; i < 20; i++) await as("authenticated", BOB, () => rows(`insert into pets (id,name,species) values ($1,'p','cat')`, [`pet-limit-${i}`]));
    expect((await as("authenticated", BOB, () => attempt(`insert into pets (id,name,species) values ('pet-over-20','p','cat')`))).error).toMatch(/pet limit reached/);
    await rows(`delete from auth.users where id=$1`, [BOB]);
    expect((await rows<{ c: number }>(`select count(*)::int c from pets where owner_id=$1`, [BOB]))[0].c).toBe(0);
  });

  it("keeps billing and moderation tables server-only", async () => {
    for (const table of ["billing_payments", "place_tier_events", "partner_interest", "published_places", "moderator_tokens", "partner_submissions"]) {
      expect((await as("authenticated", ALICE, () => attempt(`select * from ${table}`))).error, table).toMatch(/permission denied/);
      expect((await as("anon", null, () => attempt(`select * from ${table}`))).error, table).toMatch(/permission denied/);
    }
    expect((await as("authenticated", ALICE, () => attempt(`select billing_expire_plans()`))).error).toMatch(/permission denied/);
    expect((await as("authenticated", ALICE, () => attempt(`select billing_activate_plan('place-1','verified_1m','verified',1,0,'manual',null,null,null)`))).error).toMatch(/permission denied/);
  });

  it("activates a prepaid plan atomically and only once per payment", async () => {
    const first = await activate(["place-1", "verified_1m", "verified", 1, 449, "manual", "INV-1", "mod-1", "рахунок 1"]);
    expect(first).toMatchObject({ ok: true, duplicate: false, tier: "verified" });
    const place = (await rows<Record<string, string>>(`select * from published_places where id='place-1'`))[0];
    expect(place).toMatchObject({ tier: "verified", subscription_status: "active", billing_provider: "manual", billing_plan_code: "verified_1m", promoted_until: null });
    const days = (new Date(place.prepaid_until).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(27);
    expect(days).toBeLessThan(32);

    expect(await activate(["place-1", "verified_1m", "verified", 1, 449, "manual", "INV-1", "mod-1", null])).toMatchObject({ ok: true, duplicate: true });
    expect((await rows<{ c: number }>(`select count(*)::int c from billing_payments`))[0].c).toBe(1);
    expect((await rows<{ c: number }>(`select count(*)::int c from place_tier_events where place_id='place-1'`))[0].c).toBe(1);

    const renewal = await activate(["place-1", "verified_3m", "verified", 3, 1347, "manual", "INV-2", "mod-1", null]);
    expect(new Date(String(renewal.periodStart)).getTime()).toBe(new Date(place.prepaid_until).getTime());
  });

  it("gives promoted an end date and refuses what it must refuse", async () => {
    expect(await activate(["place-2", "promoted_1m", "promoted", 1, 900, "manual", null, "mod-1", null])).toMatchObject({ ok: true });
    const place = (await rows<Record<string, string>>(`select * from published_places where id='place-2'`))[0];
    expect(place.tier).toBe("promoted");
    expect(new Date(place.promoted_until).getTime()).toBe(new Date(place.prepaid_until).getTime());

    expect(await activate(["ghost", "verified_1m", "verified", 1, 449, "manual", null, "m", null])).toEqual({ ok: false, error: "place_not_found" });
    expect(await activate(["place-3", "x", "free", 1, 0, "manual", null, "m", null])).toEqual({ ok: false, error: "invalid_tier" });
    const tooLong = await as("service_role", null, async () => (await rows<{ r: unknown }>(`select billing_activate_plan('place-3','promoted_x','promoted',12,1,'manual',null,'m',null,30) r`))[0].r);
    expect(tooLong).toEqual({ ok: false, error: "promotion_too_long" });
    expect((await rows<{ tier: string }>(`select tier from published_places where id='place-3'`))[0].tier).toBe("free");
    expect((await rows<{ c: number }>(`select count(*)::int c from billing_payments where place_id in ('ghost','place-3')`))[0].c).toBe(0);
  });

  it("keeps payments and tier history append-only, even for the service role", async () => {
    expect((await as("service_role", null, () => attempt(`update billing_payments set amount_uah = 1`))).error).toMatch(/append-only/);
    expect((await as("service_role", null, () => attempt(`delete from billing_payments`))).error).toMatch(/append-only/);
    expect((await as("service_role", null, () => attempt(`delete from place_tier_events`))).error).toMatch(/append-only/);
  });

  it("the expiry job returns lapsed plans to free and leaves the rest alone", async () => {
    await rows(`update published_places set prepaid_until = now() - interval '1 hour', promoted_until = now() - interval '1 hour' where id='place-2'`);
    await rows(`insert into published_places (id, slug, data, tier, promoted_until) values ('legacy-promo','legacy-promo','{}','promoted', now() - interval '2 days'), ('hand-verified','hand-verified','{}','verified', null)`);
    const run = () => as("service_role", null, async () => (await rows<{ r: { expired: number } }>(`select billing_expire_plans() r`))[0].r);
    expect(await run()).toEqual({ expired: 2 });
    const state = Object.fromEntries((await rows<Record<string, string>>(`select id, tier, prepaid_until, promoted_until, subscription_status from published_places`)).map((row) => [row.id, row]));
    expect(state["place-2"]).toMatchObject({ tier: "free", promoted_until: null, prepaid_until: null, subscription_status: "none" });
    expect(state["legacy-promo"].tier).toBe("free");
    expect(state["place-1"].tier).toBe("verified");
    expect(state["hand-verified"].tier).toBe("verified");
    expect((await rows<{ c: number }>(`select count(*)::int c from place_tier_events where reason='expired'`))[0].c).toBe(2);
    expect(await run()).toEqual({ expired: 0 });
    expect((await rows<{ c: number }>(`select count(*)::int c from cron.job where jobname='expire-prepaid-plans'`))[0].c).toBe(1);
  });
});

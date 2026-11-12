import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("accounts: database and configuration guarantees", () => {
  const sql = read("supabase/migrations/005_auth_pets.sql");

  it("locks pets to their owner with RLS on every operation", () => {
    expect(sql).toContain("alter table pets enable row level security");
    expect(sql).toContain("references auth.users (id) on delete cascade");
    for (const op of ["select", "insert", "update", "delete"]) {
      expect(sql, op).toMatch(new RegExp(`create policy pets_${op}_own on pets for ${op} to authenticated`));
    }
    // every policy is the owner check and nothing else
    const policies = sql.match(/create policy[\s\S]*?;/g) ?? [];
    expect(policies).toHaveLength(4);
    for (const policy of policies) expect(policy).toContain("owner_id = (select auth.uid())");
    expect(sql).toMatch(/for update to authenticated\s+using \(owner_id = \(select auth\.uid\(\)\)\)\s+with check \(owner_id = \(select auth\.uid\(\)\)\)/);
  });

  it("gives the anonymous role nothing and never opens a public write path", () => {
    expect(sql).toContain("revoke all on table pets from public, anon");
    expect(sql).toContain("grant select, insert, update, delete on table pets to authenticated");
    expect(sql).not.toMatch(/to anon/i);
    expect(sql).not.toMatch(/to public/i);
    expect(sql).not.toMatch(/using \(true\)/i);
  });

  it("bounds card size and the number of cards per account in the database", () => {
    expect(sql).toContain("pg_column_size(record) <= 262144");
    expect(sql).toContain("pets_enforce_limit");
    expect(sql).toContain(">= 20");
  });

  it("uses the service role for accounts only to delete the verified user", () => {
    const account = read("src/app/api/account/route.ts");
    expect(account.indexOf("getUserSession(req)")).toBeLessThan(account.indexOf("deleteUser(session.user.id)"));
    for (const file of ["src/app/api/pets/route.ts", "src/app/api/pets/[id]/route.ts"]) {
      const route = read(file);
      expect(route, file).not.toContain("getSupabaseAdmin");
      expect(route, file).toContain("getUserClient(session.accessToken)");
    }
  });

  it("keeps Supabase keys out of the browser bundle", () => {
    const env = read(".env.example");
    expect(env).toContain("SUPABASE_ANON_KEY=");
    expect(env).not.toMatch(/NEXT_PUBLIC_SUPABASE/);
    for (const file of ["src/lib/auth/client.ts", "src/lib/pets/sync.ts", "src/components/account/AuthForm.tsx"]) {
      expect(read(file), file).not.toMatch(/supabase/i);
    }
    expect(read("src/lib/server/userAuth.ts")).toContain('import "server-only"');
  });

  it("release gate requires the anon key and refuses a service-role key in its place", () => {
    const gate = read("scripts/release-gate.mjs");
    expect(gate).toContain('requireValue("SUPABASE_ANON_KEY")');
    expect(gate).toContain("not the service-role key");
    expect(gate).toContain('NEXT_PUBLIC_SHOW_DEMO_EMERGENCY') ;
  });

  it("marks the account area as private in headers and robots", () => {
    const config = read("next.config.mjs");
    for (const path of ["/auth/:path*", "/account/:path*", "/api/auth/:path*", "/api/pets/:path*"]) expect(config, path).toContain(path);
    const robots = read("src/app/robots.ts");
    expect(robots).toContain('"/auth"');
    expect(robots).toContain('"/account"');
  });
});

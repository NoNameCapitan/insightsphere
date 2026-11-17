import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const env: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  NEXT_PUBLIC_SITE_URL: "https://example.invalid", SUPABASE_URL: "https://example.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "test", LEAD_HASH_SALT: "test-salt-at-least-thirty-two-characters-long",
  UPSTASH_REDIS_REST_URL: "https://example.invalid", UPSTASH_REDIS_REST_TOKEN: "test",
  UKRAINE_ALARM_API_TOKEN: "test", NEXT_PUBLIC_BACKEND_ENABLED: "1", ANTHROPIC_API_KEY: "test",
};
describe("production emergency visibility gate", () => {
  it.each(["true", "1", "TRUE", "yes"])("rejects unsafe or ambiguous %s", (flag) => {
    const run = spawnSync(process.execPath, ["scripts/release-gate.mjs"], { env: { ...env, NEXT_PUBLIC_SHOW_DEMO_EMERGENCY: flag }, encoding: "utf8" });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("NEXT_PUBLIC_SHOW_DEMO_EMERGENCY");
  });
  it.each(["0", "false", ""])("accepts disabled %s", (flag) => {
    const run = spawnSync(process.execPath, ["scripts/release-gate.mjs"], { env: { ...env, NEXT_PUBLIC_SHOW_DEMO_EMERGENCY: flag }, encoding: "utf8" });
    expect(run.status).toBe(0);
  });
});

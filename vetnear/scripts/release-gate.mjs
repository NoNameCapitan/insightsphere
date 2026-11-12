import process from "node:process";

const errors = [];
const warnings = [];
const value = (name) => (process.env[name] || "").trim();

function requireValue(name) {
  if (!value(name)) errors.push(`${name} is required`);
}

requireValue("NEXT_PUBLIC_SITE_URL");
requireValue("SUPABASE_URL");
requireValue("SUPABASE_SERVICE_ROLE_KEY");
requireValue("LEAD_HASH_SALT");
requireValue("UPSTASH_REDIS_REST_URL");
requireValue("UPSTASH_REDIS_REST_TOKEN");
requireValue("UKRAINE_ALARM_API_TOKEN");

if (value("ADMIN_TOKEN")) errors.push("ADMIN_TOKEN must be removed; issue personal moderator tokens instead");
if (value("LEAD_HASH_SALT").length < 32) errors.push("LEAD_HASH_SALT must contain at least 32 characters");
if (value("NEXT_PUBLIC_SHOW_DEMO_EMERGENCY") === "1") errors.push("NEXT_PUBLIC_SHOW_DEMO_EMERGENCY must be 0 in production");

for (const name of ["NEXT_PUBLIC_SITE_URL", "SUPABASE_URL", "UPSTASH_REDIS_REST_URL"]) {
  const candidate = value(name);
  if (candidate && !candidate.startsWith("https://")) errors.push(`${name} must use HTTPS`);
}

if (value("NEXT_PUBLIC_BACKEND_ENABLED") !== "1") {
  errors.push("NEXT_PUBLIC_BACKEND_ENABLED must be 1 for production");
}
if (!value("ANTHROPIC_API_KEY")) warnings.push("ANTHROPIC_API_KEY is absent; the deterministic assistant fallback will be used");

for (const warning of warnings) console.warn(`WARN: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`FAIL: ${error}`);
  process.exit(1);
}
console.log("Release environment gate passed.");

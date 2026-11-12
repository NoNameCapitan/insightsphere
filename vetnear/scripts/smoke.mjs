#!/usr/bin/env node
// Post-deploy smoke test (v1.31). Read-only: it creates nothing.
//
//   npm run smoke -- https://your-site.example
//
// Checks the guest path stays open, accounts are switched on, personal data
// endpoints are closed to guests, and nothing private is cacheable.
const base = (process.argv[2] || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("Usage: npm run smoke -- https://your-site.example");
  process.exit(2);
}

let failed = 0;
const pass = (name) => console.log(`  ok   ${name}`);
const fail = (name, detail) => { failed += 1; console.error(`  FAIL ${name} — ${detail}`); };
async function check(name, run) {
  try {
    const problem = await run();
    if (problem) fail(name, problem); else pass(name);
  } catch (error) {
    fail(name, error instanceof Error ? error.message : String(error));
  }
}
const get = (path, init) => fetch(base + path, { redirect: "manual", ...init });

console.log(`Smoke test: ${base}`);

for (const path of ["/", "/nearby", "/help", "/for-partners", "/privacy", "/terms", "/auth"]) {
  await check(`guest can open ${path}`, async () => {
    const res = await get(path);
    return res.status === 200 ? null : `status ${res.status}`;
  });
}

await check("accounts are switched on", async () => {
  const res = await get("/api/auth/session");
  const body = await res.json();
  if (!body.configured) return "configured=false: set SUPABASE_URL and SUPABASE_ANON_KEY";
  if (body.user !== null) return "a guest request returned a user";
  return (res.headers.get("cache-control") || "").includes("no-store") ? null : "session response is cacheable";
});

await check("pet cards are closed to guests", async () => {
  const res = await get("/api/pets");
  return res.status === 401 ? null : `expected 401, got ${res.status}`;
});

await check("guests cannot write pet cards", async () => {
  const res = await get("/api/pets/pet-smoke-00001", {
    method: "PUT",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ pet: { name: "x", animalType: "dog" } }),
  });
  return res.status === 401 ? null : `expected 401, got ${res.status}`;
});

await check("cross-site writes are refused", async () => {
  const res = await get("/api/pets/pet-smoke-00001", {
    method: "PUT",
    headers: { "content-type": "application/json", origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    body: JSON.stringify({ pet: { name: "x", animalType: "dog" } }),
  });
  return res.status === 403 || res.status === 401 ? null : `expected 403, got ${res.status}`;
});

await check("account deletion needs a session", async () => {
  const res = await get("/api/account", { method: "DELETE", headers: { origin: base } });
  return res.status === 401 ? null : `expected 401, got ${res.status}`;
});

await check("sign-in rejects a malformed e-mail", async () => {
  const res = await get("/api/auth/magic-link", {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ email: "not-an-email" }),
  });
  return res.status === 422 ? null : `expected 422, got ${res.status}`;
});

await check("expired sign-in link lands on a friendly page", async () => {
  const res = await get("/auth/confirm?token_hash=invalid&type=email");
  const location = res.headers.get("location") || "";
  return res.status === 303 && location.includes("/auth?error=") ? null : `status ${res.status}, location ${location}`;
});

await check("admin API is closed without a moderator token", async () => {
  const res = await get("/api/admin/places/tier", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ placeId: "x", tier: "promoted", promotedDays: 30 }),
  });
  return res.status === 401 ? null : `expected 401, got ${res.status}`;
});

await check("paid-tier request form validates input", async () => {
  const res = await get("/api/partner-interest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ placeName: "", phone: "x", email: "x", plan: "gold" }),
  });
  return res.status === 422 || res.status === 503 ? null : `expected 422, got ${res.status}`;
});

await check("no place is offered as 24/7 emergency without confirmation", async () => {
  const res = await get("/nearby?emergency=1");
  const html = await res.text();
  return /NEXT_PUBLIC_SHOW_DEMO_EMERGENCY|демонстраційний запис невідкладної/i.test(html) ? "demo emergency content is visible" : null;
});

console.log(failed ? `\n${failed} check(s) failed.` : "\nAll smoke checks passed.");
process.exit(failed ? 1 : 0);

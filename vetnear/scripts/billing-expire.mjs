#!/usr/bin/env node
// Return lapsed prepaid plans to the free tier (v1.32).
//
//   npm run billing:expire
//
// The same function runs every night in the database (pg_cron, migration 007);
// this is the manual lever. Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await db.rpc("billing_expire_plans");
if (error) {
  console.error("Expiry failed:", error.message);
  process.exit(1);
}
console.log(`Expired plans: ${data?.expired ?? 0}`);

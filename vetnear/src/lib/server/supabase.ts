// Server-only Supabase client. NEVER import from client components.
// Uses the SERVICE ROLE key (bypasses RLS) — API routes are the only gateway
// to the tables; the browser never talks to Supabase directly.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

let cached: SupabaseClient | null = null;

/** Returns a service-role client, or null when the backend isn't configured
 *  (the app then keeps working in localStorage demo mode). */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cached) {
    cached = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

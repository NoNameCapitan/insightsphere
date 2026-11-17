import "server-only";
import { isValidEmail } from "@/lib/security/url";
import { isSupabaseConfigured } from "@/lib/server/supabase";

/** A public fallback is shown only after the project owner configures it. */
export function getPartnerIntakeConfig() {
  const email = (process.env.PARTNER_CONTACT_EMAIL || process.env.NEXT_PUBLIC_CONTACT_EMAIL)?.trim() ?? "";
  return {
    intakeEnabled: process.env.NEXT_PUBLIC_BACKEND_ENABLED === "1" && isSupabaseConfigured(),
    contactEmail: isValidEmail(email) && !/[?&#]/.test(email) ? email : null,
  };
}

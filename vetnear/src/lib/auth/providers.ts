// Display helpers for sign-in methods (safe for the browser bundle).

/** Human names for the sign-in methods Supabase reports for a user. */
export function describeProviders(providers: readonly string[]): string {
  const names = providers.map((p) => (p === "google" ? "Google" : p === "email" ? "посилання на пошту" : null)).filter(Boolean);
  return names.length ? [...new Set(names)].join(" і ") : "посилання на пошту";
}

// Pure helpers shared by the auth routes, pages and tests (no server imports).

export const DEFAULT_AFTER_LOGIN = "/my-pets";

/**
 * Only same-site paths may be used as a post-login destination — otherwise the
 * login link becomes an open redirect.
 */
export function safeNextPath(value: string | null | undefined, fallback: string = DEFAULT_AFTER_LOGIN): string {
  if (!value || typeof value !== "string") return fallback;
  if (value.length > 200) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  if (value.startsWith("/auth") || value.startsWith("/api")) return fallback;
  return value;
}

const EMAIL = /^[^\s@<>()"',;:\\]+@[^\s@<>()"',;:\\]+\.[a-z]{2,24}$/i;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 5 || email.length > 160 || !EMAIL.test(email)) return null;
  return email;
}

/**
 * Cookie-authenticated writes must come from our own pages. SameSite=Lax
 * already blocks cross-site POSTs with cookies; this is the second lock.
 */
export function isSameOriginRequest(req: Request): boolean {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin" || fetchSite === "none";
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export type AuthErrorCode = "expired" | "invalid" | "rate" | "config" | "unknown";

export const AUTH_ERROR_TEXT: Record<AuthErrorCode, string> = {
  expired: "Посилання застаріло або вже використане. Надішліть нове — це займе кілька секунд.",
  invalid: "Перевірте адресу електронної пошти.",
  rate: "Забагато спроб. Зачекайте кілька хвилин і спробуйте ще раз.",
  config: "Вхід тимчасово недоступний. Пошук закладів працює без акаунта.",
  unknown: "Не вдалося увійти. Спробуйте ще раз.",
};

/** What the "my pets" area should show for a given session state. */
export type GateState = "loading" | "local" | "signed-out" | "signed-in";

export function resolveGate(session: { configured: boolean; user: unknown } | null): GateState {
  if (!session) return "loading";
  if (!session.configured) return "local";
  return session.user ? "signed-in" : "signed-out";
}

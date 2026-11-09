// URL safety helpers (Module 12). Only http/https/tel/mailto are allowed for
// user/partner-supplied links; javascript: and data: are always rejected.
const SAFE_PROTOCOLS = new Set(["http:", "https:", "tel:", "mailto:"]);

export function isSafeUrl(raw: string | undefined | null): boolean {
  if (!raw) return false;
  const value = raw.trim();
  if (!value) return false;
  // Reject dangerous schemes early (case/whitespace-insensitive).
  if (/^\s*(javascript|data|vbscript|file)\s*:/i.test(value)) return false;
  try {
    // tel:/mailto: don't parse with a base; handle explicitly.
    if (/^(tel:|mailto:)/i.test(value)) return true;
    const url = new URL(value);
    return SAFE_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

/** Returns the URL if safe, otherwise undefined (so callers can omit links). */
export function safeUrl(raw: string | undefined | null): string | undefined {
  return isSafeUrl(raw) ? raw!.trim() : undefined;
}

/** Standard props for safe external links. */
export const EXTERNAL_LINK_PROPS = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

/** Loose Kyiv/UA phone check — digits, +, spaces, dashes, parens. */
export function isValidPhone(v: string): boolean {
  const digits = v.replace(/[^\d]/g, "");
  return digits.length >= 9 && digits.length <= 15;
}

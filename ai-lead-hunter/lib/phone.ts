// Pure phone helpers. Ukraine-focused but tolerant of international input.
// No side effects, no DOM — safe to unit-test.

export function digitsOnly(raw: string): string {
  return (raw || "").replace(/[^\d]/g, "");
}

/**
 * Normalize a raw phone string to E.164 ("+380...") or return null if it
 * cannot be made into a plausible number. Handles common UA formats:
 *   "0XX XXX XX XX"  -> +380XXXXXXXXX
 *   "380XXXXXXXXX"   -> +380XXXXXXXXX
 *   "+380 XX ..."    -> +380XXXXXXXXX
 *   "XX XXX XX XX"   -> +380XXXXXXXXX (9 national digits)
 * International numbers that already start with "+" (or "00") are kept.
 */
export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const hadPlus = trimmed.startsWith("+");
  let d = digitsOnly(trimmed);
  if (!d) return null;

  // "00" international access code -> drop it, treat as international.
  if (d.startsWith("00")) {
    d = d.slice(2);
  } else if (!hadPlus) {
    // National Ukrainian normalization (only when not explicitly international).
    if (d.startsWith("380") && d.length === 12) {
      // already country-coded
    } else if (d.startsWith("0") && d.length === 10) {
      d = "380" + d.slice(1);
    } else if (d.length === 9) {
      d = "380" + d;
    }
  }

  // E.164 allows up to 15 digits; require a sensible minimum.
  if (d.length < 10 || d.length > 15) return null;
  return "+" + d;
}

export function isValidPhone(raw?: string | null): boolean {
  return normalizePhone(raw) !== null;
}

/** "+380..." form for tel: links (and as a base for other links). */
export function phoneE164(raw?: string | null): string | null {
  return normalizePhone(raw);
}

/** Digits without "+" — for wa.me and Viber number params. */
export function phoneDigitsIntl(raw?: string | null): string | null {
  const n = normalizePhone(raw);
  return n ? n.slice(1) : null;
}

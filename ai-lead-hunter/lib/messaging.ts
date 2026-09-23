// Pure builders for contact deep-links + channel availability.
// All return safe URLs or null when the channel isn't usable. No DOM access.

import { isValidPhone, normalizePhone, phoneDigitsIntl } from "./phone";

export type ContactChannelId =
  | "call"
  | "whatsapp"
  | "viber"
  | "telegram"
  | "instagram"
  | "messenger"
  | "gmail"
  | "outlook"
  | "mailto"
  | "copy";

export function buildTelUrl(phone?: string | null): string | null {
  const n = normalizePhone(phone);
  return n ? `tel:${n}` : null;
}

export function buildWhatsAppUrl(
  phone: string | null | undefined,
  text: string,
): string | null {
  const d = phoneDigitsIntl(phone);
  if (!d) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export function buildViberUrl(
  phone: string | null | undefined,
  text: string,
): string | null {
  const d = phoneDigitsIntl(phone);
  if (!d) return null;
  // Viber expects the international number with a leading "+" (URL-encoded).
  return `viber://chat?number=%2B${d}&text=${encodeURIComponent(text)}`;
}

// Telegram: only a public t.me link the business published itself.
export function buildTelegramUrl(link?: string | null): string | null {
  const m = link?.match(/^https:\/\/(?:t|telegram)\.me\/([a-z0-9_]{4,32})$/i);
  return m ? `https://t.me/${m[1]}` : null;
}

// Opens an Instagram Direct thread with a public profile.
export function buildInstagramDmUrl(link?: string | null): string | null {
  const m = link?.match(/instagram\.com\/([a-z0-9._]{1,30})\/?$/i);
  return m ? `https://ig.me/m/${m[1]}` : null;
}

// Opens Facebook Messenger for a public page.
export function buildMessengerUrl(link?: string | null): string | null {
  const m = link?.match(/facebook\.com\/([\p{L}0-9.\-_]{2,80})\/?$/iu);
  return m ? `https://m.me/${encodeURIComponent(m[1])}` : null;
}

type MailParts = { to?: string; subject: string; body: string };

export function buildMailtoUrl({ to, subject, body }: MailParts): string {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  return `mailto:${to ?? ""}?${params.toString()}`;
}

export function buildGmailComposeUrl({ to, subject, body }: MailParts): string {
  const p = new URLSearchParams({ view: "cm", fs: "1" });
  if (to) p.set("to", to);
  if (subject) p.set("su", subject);
  if (body) p.set("body", body);
  return `https://mail.google.com/mail/?${p.toString()}`;
}

export function buildOutlookComposeUrl({
  to,
  subject,
  body,
}: MailParts): string {
  const p = new URLSearchParams();
  if (to) p.set("to", to);
  if (subject) p.set("subject", subject);
  if (body) p.set("body", body);
  return `https://outlook.office.com/mail/deeplink/compose?${p.toString()}`;
}

/**
 * Which channels are actually usable for a lead, given the data we have.
 * We never invent a Telegram/Instagram/Facebook handle: these channels are only
 * available when the business published the link on its own website.
 * Email channels open a *draft* (prepared subject/body), so they are always
 * available as an honest "open a draft" action, even without a known address.
 */
export function availableChannels(lead: {
  phone?: string | null;
  telegram?: string | null;
  instagram?: string | null;
  facebook?: string | null;
}): Record<ContactChannelId, boolean> {
  const hasPhone = isValidPhone(lead.phone);
  return {
    call: hasPhone,
    whatsapp: hasPhone,
    viber: hasPhone,
    telegram: !!buildTelegramUrl(lead.telegram),
    instagram: !!buildInstagramDmUrl(lead.instagram),
    messenger: !!buildMessengerUrl(lead.facebook),
    gmail: true,
    outlook: true,
    mailto: true,
    copy: true,
  };
}

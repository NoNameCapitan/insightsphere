// Pure extraction of public contact points from one HTML page:
// emails, Instagram, Facebook, Telegram, WhatsApp, Viber, TikTok, YouTube, LinkedIn.
// Only what the business itself publishes on its site is returned. No guessing.

import type { WebsiteContacts } from "./types";

const MAX_EMAILS = 3;
const EMAIL_RE = /[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}/gi;
const ASSET_EXT = /\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|woff2?)$/i;
const JUNK_EMAIL_DOMAINS = [
  "example.com",
  "example.org",
  "domain.com",
  "email.com",
  "sentry.io",
  "sentry-next.wixpress.com",
  "wixpress.com",
  "mysite.com",
  "yourdomain.com",
];

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&#64;|&commat;/gi, "@")
    .replace(/&#46;|&period;/gi, ".")
    .replace(/&quot;/gi, '"')
    .replace(/&#x2F;|&#47;/gi, "/");
}

function cleanEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase().replace(/^mailto:/, "").split("?")[0];
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/.test(e)) return null;
  if (ASSET_EXT.test(e)) return null;
  const domain = e.split("@")[1];
  if (JUNK_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`)))
    return null;
  return e;
}

function hrefs(html: string): string[] {
  const out: string[] = [];
  const re = /href\s*=\s*["']([^"'<>\s]{3,500})["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 2000) out.push(decodeEntities(m[1]));
  return out;
}

function toUrl(href: string): URL | null {
  try {
    return new URL(href.startsWith("//") ? `https:${href}` : href);
  } catch {
    return null;
  }
}

const IG_RESERVED = new Set(["p", "reel", "reels", "explore", "stories", "accounts", "tv", "sharer", "share"]);
const FB_RESERVED = new Set(["sharer", "sharer.php", "share", "plugins", "tr", "dialog", "login", "watch", "groups", "events", "profile.php", "photo", "photo.php", "hashtag"]);
const TG_RESERVED = new Set(["share", "joinchat", "addstickers", "iv", "s"]);

function firstSegment(u: URL): string {
  return decodeURIComponent(u.pathname.split("/").filter(Boolean)[0] ?? "");
}

export function extractContacts(html: string): WebsiteContacts {
  const decoded = decodeEntities(html);
  const emails = new Set<string>();
  const out: WebsiteContacts = { emails: [] };

  for (const href of hrefs(decoded)) {
    const lower = href.toLowerCase();
    if (lower.startsWith("mailto:")) {
      for (const part of href.slice(7).split(/[,;]/)) {
        const e = cleanEmail(part);
        if (e) emails.add(e);
      }
      continue;
    }
    if (lower.startsWith("viber://") && !out.viber) {
      out.viber = href;
      continue;
    }
    const u = toUrl(href);
    if (!u || !/^https?:$/.test(u.protocol)) continue;
    const host = u.hostname.replace(/^(www|m|mobile|uk-ua|ru-ru)\./, "");
    const seg = firstSegment(u);
    if (host === "instagram.com" && !out.instagram) {
      if (/^[a-z0-9._]{1,30}$/i.test(seg) && !IG_RESERVED.has(seg.toLowerCase()))
        out.instagram = `https://instagram.com/${seg}`;
    } else if ((host === "facebook.com" || host === "fb.com") && !out.facebook) {
      if (seg && !FB_RESERVED.has(seg.toLowerCase()) && /^[\p{L}0-9.\-_]{2,80}$/u.test(seg))
        out.facebook = `https://facebook.com/${seg}`;
    } else if ((host === "t.me" || host === "telegram.me") && !out.telegram) {
      if (/^[a-z0-9_]{4,32}$/i.test(seg) && !TG_RESERVED.has(seg.toLowerCase()))
        out.telegram = `https://t.me/${seg}`;
    } else if ((host === "wa.me" || host === "api.whatsapp.com") && !out.whatsapp) {
      const digits = (host === "wa.me" ? seg : u.searchParams.get("phone") ?? "").replace(/\D/g, "");
      if (digits.length >= 9 && digits.length <= 15) out.whatsapp = `https://wa.me/${digits}`;
    } else if (host === "invite.viber.com" && !out.viber) {
      out.viber = u.toString();
    } else if (host === "tiktok.com" && !out.tiktok) {
      if (/^@[a-z0-9._]{2,24}$/i.test(seg)) out.tiktok = `https://tiktok.com/${seg}`;
    } else if (host === "youtube.com" && !out.youtube) {
      if (/^(@|channel|c|user)/.test(seg)) out.youtube = `https://youtube.com${u.pathname}`;
    } else if (host === "linkedin.com" && !out.linkedin) {
      if (/^\/company\/[^/]+/.test(u.pathname))
        out.linkedin = `https://linkedin.com${u.pathname.split("/").slice(0, 3).join("/")}`;
    }
  }

  // Plain-text emails (visible in page text / JSON-LD), after mailto links.
  const text = decoded.replace(/<script(?![^>]*ld\+json)[\s\S]*?<\/script>/gi, " ");
  for (const m of text.matchAll(EMAIL_RE)) {
    if (emails.size >= MAX_EMAILS) break;
    const e = cleanEmail(m[0]);
    if (e) emails.add(e);
  }
  out.emails = [...emails].slice(0, MAX_EMAILS);
  return out;
}

export function hasAnyContact(c?: WebsiteContacts): boolean {
  if (!c) return false;
  return (
    c.emails.length > 0 ||
    !!(c.instagram || c.facebook || c.telegram || c.whatsapp || c.viber || c.tiktok || c.youtube || c.linkedin)
  );
}

export function instagramHandle(url?: string): string | null {
  const m = url?.match(/instagram\.com\/([a-z0-9._]{1,30})/i);
  return m ? m[1] : null;
}

// Lightweight, SAFE website analyzer.
// - SSRF-hardened: every URL (and every redirect hop) is validated against
//   private/loopback/link-local/metadata ranges via lib/ssrf before fetching.
// - One request per hop, hard timeout, capped body read, max 3 redirects.
// - No deep crawling, no following internal links.
// - Never throws: on any problem returns reachable:false with a clear note.

import type { WebsiteAnalysis } from "./types";
import { validateUrlSafety } from "./ssrf";
import { fetchWebsitePage } from "./safeFetch";
import { extractContacts } from "./contactExtractor";

const TIMEOUT_MS = 6000;
const MAX_BYTES = 200_000; // read at most ~200KB of HTML
const MAX_REDIRECTS = 3;

export function emptyAnalysis(url?: string): WebsiteAnalysis {
  return {
    checked: false,
    url,
    reachable: false,
    https: false,
    hasTitle: false,
    hasViewport: false,
    hasContactKeyword: false,
    hasBookingKeyword: false,
    hasSocialLinks: false,
    hasFormKeyword: false,
  };
}

const BOOKING_WORDS = [
  "запис",
  "записатись",
  "записаться",
  "онлайн-запис",
  "бронюв",
  "бронир",
  "book now",
  "booking",
  "appointment",
  "schedule",
  "reserve",
  "calendly",
];

const CONTACT_WORDS = [
  "контакт",
  "contact",
  "tel:",
  "mailto:",
  "телефон",
  "phone",
  "зв'яжіться",
  "связаться",
];

const SOCIAL_HOSTS = [
  "instagram.com",
  "facebook.com",
  "fb.com",
  "t.me",
  "telegram",
  "tiktok.com",
  "youtube.com",
  "viber",
];

const FORM_WORDS = [
  "<form",
  'type="submit"',
  "type='submit'",
  "заявк",
  "залиш",
];

function includesAny(haystack: string, words: string[]): boolean {
  return words.some((w) => w && haystack.includes(w));
}

function blocked(url: string, note: string): WebsiteAnalysis {
  return {
    ...emptyAnalysis(url),
    checked: true,
    reachable: false,
    https: url.toLowerCase().startsWith("https://"),
    note,
  };
}

// Analyze a single website URL. Always resolves (never rejects).
export async function analyzeWebsite(
  rawUrl?: string,
): Promise<WebsiteAnalysis> {
  if (!rawUrl) return emptyAnalysis(rawUrl);

  // First, a synchronous syntax/IP-literal check for a clean early error.
  const syntax = validateUrlSafety(rawUrl);
  if (!syntax.ok) {
    return { ...emptyAnalysis(rawUrl), checked: true, note: syntax.reason };
  }

  let current = syntax.url.toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const safe = validateUrlSafety(current);
      if (!safe.ok) return blocked(current, safe.reason);
      const res = await fetchWebsitePage(current, controller.signal);

      // Manual redirect handling so we can re-check the next hop.
      if (res.status >= 300 && res.status < 400) {
        const location = res.location;
        if (!location) {
          return blocked(current, `HTTP ${res.status} без Location`);
        }
        let next: URL;
        try {
          next = new URL(location, safe.url);
        } catch {
          return blocked(current, "Некоректний redirect.");
        }
        if (hop === MAX_REDIRECTS) {
          return blocked(current, "Забагато перенаправлень.");
        }
        current = next.toString();
        continue;
      }

      if (res.status < 200 || res.status >= 300) {
        return {
          ...emptyAnalysis(safe.url.toString()),
          checked: true,
          https: safe.url.protocol === "https:",
          reachable: false,
          note: `HTTP ${res.status}`,
        };
      }

      if (!/text\/html|application\/xhtml\+xml/i.test(res.contentType)) {
        return {
          ...emptyAnalysis(current),
          checked: false,
          reachable: true,
          note: "Відповідь не HTML — потрібна ручна перевірка.",
        };
      }
      const html = res.html;
      const lower = html.toLowerCase();
      const finalUrl = safe.url.toString();
      return {
        checked: true,
        note: res.truncated
          ? "Перевірено перші 200 КБ сторінки."
          : "Перевірено HTML однієї сторінки; JavaScript не виконувався.",
        url: finalUrl,
        reachable: true,
        https: finalUrl.toLowerCase().startsWith("https://"),
        hasTitle: /<title[^>]*>\s*\S/i.test(html),
        hasViewport: /name=["']?viewport["']?/i.test(html),
        hasContactKeyword: includesAny(lower, CONTACT_WORDS),
        hasBookingKeyword: includesAny(lower, BOOKING_WORDS),
        hasSocialLinks: includesAny(lower, SOCIAL_HOSTS),
        hasFormKeyword: includesAny(lower, FORM_WORDS),
        contacts: extractContacts(html),
      };
    }
    return blocked(current, "Забагато перенаправлень.");
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ...emptyAnalysis(current),
      checked: true,
      https: current.toLowerCase().startsWith("https://"),
      reachable: false,
      note: aborted ? "Таймаут запиту." : "Сайт недоступний.",
    };
  } finally {
    clearTimeout(timer);
  }
}

// Analyze several sites concurrently with a hard cap on how many we touch.
export async function analyzeWebsites(
  urls: Array<string | undefined>,
  cap = 12,
): Promise<Array<WebsiteAnalysis>> {
  const selected = [...new Set(urls.filter((u): u is string => !!u))].slice(
    0,
    cap,
  );
  const results = await Promise.allSettled(
    selected.map((u) => analyzeWebsite(u)),
  );
  const byUrl = new Map(
    selected.map((url, i) => [
      url,
      results[i].status === "fulfilled"
        ? (results[i] as PromiseFulfilledResult<WebsiteAnalysis>).value
        : emptyAnalysis(url),
    ]),
  );
  return urls.map((url) =>
    url && byUrl.has(url) ? byUrl.get(url)! : emptyAnalysis(url),
  );
}

// CSV export for leads (used by results and campaigns).

import type { Lead } from "./types";
import { downloadText } from "./download";

const COLUMNS = [
  "name",
  "category",
  "address",
  "phone",
  "website",
  "email",
  "instagram",
  "facebook",
  "telegram",
  "whatsapp",
  "googleMapsUrl",
  "rating",
  "reviewCount",
  "leadScore",
  "scoreLabel",
  "recommendedOffer",
  "mainSignals",
  "outreachShortMessage",
  "status",
  "notes",
  "source",
  "sourcePlaceId",
  "attributions",
  "confidence",
  "doNotContact",
  "outcome",
  "followUpAt",
] as const;

function escapeCell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  const s =
    typeof value === "string" && /^[\s]*[=+@\-\t\r]/.test(raw)
      ? "'" + raw
      : raw;
  if (/[",\r\n;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function leadsToCsv(leads: Lead[]): string {
  const header = COLUMNS.join(",");
  const rows = leads.map((l) => {
    const c = l.websiteAnalysis?.contacts;
    const mainSignals = l.signals
      .filter((s) => s.severity !== "low")
      .map((s) => s.label)
      .join(" | ");
    const record: Record<(typeof COLUMNS)[number], unknown> = {
      name: l.name,
      category: l.category,
      address: l.address,
      phone: l.phone ?? "",
      website: l.website ?? "",
      email: c?.emails.join(" | ") ?? "",
      instagram: c?.instagram ?? "",
      facebook: c?.facebook ?? "",
      telegram: c?.telegram ?? "",
      whatsapp: c?.whatsapp ?? "",
      googleMapsUrl: l.googleMapsUrl ?? "",
      rating: l.rating ?? "",
      reviewCount: l.reviewCount ?? "",
      leadScore: l.score.total,
      scoreLabel: l.score.label,
      recommendedOffer: l.recommendedOffer,
      mainSignals,
      outreachShortMessage: l.outreach.shortMessage,
      status: l.status ?? "",
      notes: l.notes ?? "",
      source: l.source,
      sourcePlaceId: l.sourcePlaceId ?? "",
      attributions:
        l.attributions
          ?.map((a) => `${a.provider} ${a.providerUri ?? ""}`.trim())
          .join(" | ") ?? "",
      confidence: l.confidence.score,
      doNotContact: !!l.verification?.doNotContact,
      outcome: l.outcome ?? "",
      followUpAt: l.followUpAt ?? "",
    };
    return COLUMNS.map((c) => escapeCell(record[c])).join(",");
  });
  // Prepend BOM so Excel reads UTF-8 (Cyrillic) correctly.
  return "\uFEFF" + [header, ...rows].join("\n");
}

export function downloadCsv(leads: Lead[], filename = "leads.csv"): void {
  if (typeof window === "undefined") return;
  downloadText(leadsToCsv(leads), filename, "text/csv;charset=utf-8;");
}

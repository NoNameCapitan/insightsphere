// Lead Confidence = how reliable the available data is (NOT how good the lead).
// Deterministic 0..100 based on which fields are present/verified.
// Kept separate from Lead Score on purpose: a lead can be very attractive yet
// have low-confidence data, or be a weak fit with fully verified data.

import { hasAnyContact } from "./contactExtractor";
import type { LeadConfidence, RawBusiness } from "./types";

type Signal = { ok: boolean; points: number; label: string };

export function computeConfidence(
  b: RawBusiness,
  opts: { hasDistance?: boolean } = {},
): LeadConfidence {
  const wa = b.websiteAnalysis;
  const signals: Signal[] = [
    { ok: !!b.phone, points: 14, label: "є телефон" },
    { ok: !!b.website, points: 12, label: "є сайт" },
    {
      ok: !!(wa && wa.checked),
      points: 14,
      label: "сайт перевірено автоматично",
    },
    { ok: !!b.googleMapsUrl, points: 8, label: "є профіль Google Maps" },
    { ok: b.rating != null, points: 12, label: "є рейтинг" },
    { ok: (b.reviewCount ?? 0) > 0, points: 12, label: "є відгуки" },
    {
      ok: !!(b.openingHours && b.openingHours.length > 0),
      points: 8,
      label: "є години роботи",
    },
    { ok: !!b.businessStatus, points: 6, label: "є статус роботи" },
    {
      ok: hasAnyContact(wa?.contacts),
      points: 6,
      label: "є email або соцмережі на сайті",
    },
    { ok: !!opts.hasDistance, points: 8, label: "відома відстань" },
  ];

  const total = signals.reduce((sum, s) => (s.ok ? sum + s.points : sum), 0);
  const score = Math.max(0, Math.min(100, total));
  const present = signals.filter((s) => s.ok).map((s) => s.label);
  const missing = signals.filter((s) => !s.ok).map((s) => s.label);

  return {
    score,
    label: score >= 80 ? "high" : score >= 50 ? "medium" : "low",
    present,
    missing,
  };
}

export const CONFIDENCE_LABEL_UK: Record<LeadConfidence["label"], string> = {
  high: "Висока впевненість",
  medium: "Середня впевненість",
  low: "Низька впевненість",
};

import { BADGE_LABELS } from "@/lib/labels";
import type { TrustBadge } from "@/lib/types";

// Premium badge styling: icon + explicit color code per trust level
// (green = confirmed, gray = neutral, amber = caution, rose = emergency).
const TONE: Record<TrustBadge, string> = {
  verified: "border-brand-200 bg-brand-50 text-brand-700",
  claimed: "border-brand-200 bg-brand-50 text-brand-700",
  partner: "border-brand-200 bg-brand-50 text-brand-700",
  updated_recently: "border-brand-200 bg-brand-50 text-brand-700",
  open_now: "border-brand-200 bg-brand-50 text-brand-700",
  emergency: "border-emergency/20 bg-emergency-50 text-emergency-700",
  data_outdated: "border-amber/30 bg-amber/10 text-amber",
  free: "border-ink/10 bg-ink/5 text-ink/60",
};

const ICON: Record<TrustBadge, string> = {
  verified: "✓",
  claimed: "✓",
  partner: "★",
  updated_recently: "↻",
  open_now: "●",
  emergency: "＋",
  data_outdated: "⏳",
  free: "○",
};

export function TrustBadges({
  badges,
  className = "",
}: {
  badges: TrustBadge[];
  className?: string;
}) {
  if (!badges.length) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {badges.map((b) => (
        <span
          key={b}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE[b]}`}
        >
          <span aria-hidden>{ICON[b]}</span>
          {BADGE_LABELS[b]}
        </span>
      ))}
    </div>
  );
}

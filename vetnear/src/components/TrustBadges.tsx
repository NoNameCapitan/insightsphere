import { BADGE_LABELS } from "@/lib/labels";
import type { TrustBadge } from "@/lib/types";

const TONE: Record<TrustBadge, string> = {
  verified: "bg-brand-50 text-brand-700",
  claimed: "bg-brand-50 text-brand-700",
  partner: "bg-brand-50 text-brand-700",
  updated_recently: "bg-brand-50 text-brand-700",
  open_now: "bg-brand-50 text-brand-700",
  emergency: "bg-emergency-50 text-emergency-700",
  data_outdated: "bg-amber/10 text-amber",
  free: "bg-ink/5 text-ink/60",
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
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[b]}`}
        >
          {BADGE_LABELS[b]}
        </span>
      ))}
    </div>
  );
}

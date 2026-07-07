// Honest data-provenance badges + warnings (P0.2). Server-safe (pure).
import { getDataBadge, getDataWarning, isDemoPlace, isVerifiedPlace, verificationLabel } from "@/lib/data/provenance";
import { isEmergencyPlace, isEmergencySearchSafe } from "@/lib/data/verification";
import { EXTERNAL_LINK_PROPS, safeUrl } from "@/lib/security/url";
import type { Place } from "@/lib/types";

// Computed once at module load (not during render) to satisfy purity rules.
const STALE_BEFORE_MS = Date.now() - 180 * 24 * 60 * 60 * 1000;

const TONE: Record<string, string> = {
  demo: "bg-amber/15 text-amber",
  unverified: "bg-amber/10 text-ink/60",
  review: "bg-amber/10 text-amber",
  verified: "bg-brand-50 text-brand-700",
};

export function DataBadgeChip({ place, className = "" }: { place: Place; className?: string }) {
  const badge = getDataBadge(place);
  if (!badge) return null;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[badge.tone]} ${className}`}>
      {badge.label}
    </span>
  );
}

/** Inline warning shown on cards/profiles for demo/unverified data. */
export function DataWarningNote({ place, className = "" }: { place: Place; className?: string }) {
  const warning = getDataWarning(place);
  const emergencyUnsafe = isEmergencyPlace(place) && !isEmergencySearchSafe(place);
  if (!warning && !emergencyUnsafe) return null;
  return (
    <div className={`rounded-2xl border border-amber/30 bg-amber/5 px-3 py-2 text-xs text-ink/70 ${className}`}>
      {warning && <p>⚠️ {warning}</p>}
      {emergencyUnsafe && (
        <p className="mt-1 font-medium text-amber">
          Це демонстраційний запис невідкладної допомоги — НЕ покладайтесь на нього в екстреній ситуації.
        </p>
      )}
    </div>
  );
}

/**
 * Trust badges for a verified place: "Verified", "Last checked" (lastVerifiedAt),
 * and "Source" (sourceLabel, optionally linking sourceUrl). Pure / server-safe.
 * `compact` renders a single inline "Перевірено · <date>" line for cards.
 */
export function VerifiedMeta({
  place,
  className = "",
  compact = false,
}: {
  place: Place;
  className?: string;
  compact?: boolean;
}) {
  if (!isVerifiedPlace(place)) return null;
  const checked = place.lastVerifiedAt;
  const source = place.sourceLabel;
  const sourceHref = safeUrl(place.sourceUrl);
  const stale = checked ? new Date(checked).getTime() < STALE_BEFORE_MS : false;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] text-ink/50 ${className}`}>
        <span className="text-brand-700">✓ {verificationLabel(place)}</span>
        {checked && <span>· {checked}</span>}
      </span>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 text-[11px] ${className}`}>
      <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">✓ {verificationLabel(place)}</span>
      {checked && (
        <span className="rounded-full bg-ink/5 px-2 py-0.5 text-ink/60">Востаннє перевірено: {checked}</span>
      )}
      {source && (
        <span className="rounded-full bg-ink/5 px-2 py-0.5 text-ink/60">
          Джерело:{" "}
          {sourceHref ? (
            <a href={sourceHref} {...EXTERNAL_LINK_PROPS} className="text-brand hover:underline">
              {source}
            </a>
          ) : (
            source
          )}
        </span>
      )}
      {stale && (
        <span className="rounded-full bg-amber/15 px-2 py-0.5 text-amber">Дані можуть бути застарілими</span>
      )}
    </div>
  );
}

export { isDemoPlace };

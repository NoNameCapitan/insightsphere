// Server-safe place card for STATIC pages (SEO landings, district pages).
// No "use client", no hooks, no analytics — pure HTML so static generation is
// fast and cannot block. The interactive client PlaceCard is used only on the
// dynamic /nearby surface.
import Link from "next/link";
import { DataBadgeChip, VerifiedMeta } from "@/components/DataBadge";
import { TrustBadges } from "@/components/TrustBadges";
import { CATEGORY_EMOJI, CATEGORY_LABELS } from "@/lib/labels";
import { googleMapsRoute } from "@/lib/maps";
import { EXTERNAL_LINK_PROPS, safeUrl } from "@/lib/security/url";
import type { Place, TrustBadge } from "@/lib/types";

// Only stable (non-time-dependent) badges are safe to bake into static HTML.
function stableBadges(place: Place): TrustBadge[] {
  const b: TrustBadge[] = [];
  if (place.verified) b.push("verified");
  if (place.emergencyAvailable || place.isOpen24_7) b.push("emergency");
  if (!place.claimed) b.push("free");
  return b;
}

export function PlaceCardStatic({ place }: { place: Place }) {
  const website = safeUrl(place.website);
  const isEmergency = place.emergencyAvailable || place.isOpen24_7;

  return (
    <div className={`card p-4 ${isEmergency ? "ring-1 ring-emergency/40" : ""}`}>
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-2xl ${
            isEmergency ? "bg-emergency-50" : "bg-brand-50"
          }`}
        >
          {CATEGORY_EMOJI[place.category]}
        </div>

        <div className="min-w-0 flex-1">
          <Link
            href={`/place/${place.slug}`}
            className="font-display font-bold text-ink transition-colors hover:text-brand"
          >
            {place.name}
          </Link>
          <p className="text-sm text-ink/60">{CATEGORY_LABELS[place.category]}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <DataBadgeChip place={place} />
            <VerifiedMeta place={place} compact />
            <TrustBadges badges={stableBadges(place)} />
          </div>
          {place.services.length > 0 && (
            <p className="mt-2 line-clamp-1 text-xs text-ink/50">
              {place.services.join(" · ")}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <a href={`tel:${place.phone}`} className="btn btn-brand py-2 text-sm">
          Зателефонувати
        </a>
        <a
          href={googleMapsRoute(place)}
          {...EXTERNAL_LINK_PROPS}
          className="btn btn-ghost py-2 text-sm"
        >
          Маршрут
        </a>
        {website ? (
          <a href={website} {...EXTERNAL_LINK_PROPS} className="btn btn-ghost py-2 text-sm">
            Сайт
          </a>
        ) : (
          <Link href={`/place/${place.slug}`} className="btn btn-ghost py-2 text-sm">
            Деталі
          </Link>
        )}
      </div>
    </div>
  );
}

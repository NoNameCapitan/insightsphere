"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DataBadgeChip } from "@/components/DataBadge";
import { TrustBadges } from "@/components/TrustBadges";
import { ServiceIcon } from "@/components/icons/ServiceIcons";
import { track } from "@/lib/analytics";
import { formatDistance, getOpenNowStatus } from "@/lib/distance";
import { CATEGORY_LABELS, DISTRICT_LABELS } from "@/lib/labels";
import { googleMapsRoute } from "@/lib/maps";
import { EXTERNAL_LINK_PROPS, safeUrl } from "@/lib/security/url";
import { computeBadges } from "@/lib/trust";
import type { AnimalType, Coordinates, PlaceWithDistance } from "@/lib/types";

// Re-export for older imports.
export { googleMapsRoute };

/** Service chips shown before collapsing the rest into a "+N" counter. */
const VISIBLE_SERVICES = 3;

export function PlaceCard({
  place,
  origin,
  emergencyMode = false,
  petAnimal,
}: {
  place: PlaceWithDistance;
  origin?: Coordinates | null;
  emergencyMode?: boolean;
  petAnimal?: AnimalType;
}) {
  const suitsPet = petAnimal ? place.animalTypes.includes(petAnimal) : false;
  // Compute open-now after mount to avoid hydration mismatch.
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => setOpen(getOpenNowStatus(place)), [place]);

  const website = safeUrl(place.website);
  const isEmergency = place.emergencyAvailable || place.isOpen24_7;
  // Verification is communicated once, by the provenance badge (DataBadgeChip);
  // "open now" has its own live chip — so only the remaining signals stay here.
  const badges = computeBadges(place).filter((b) =>
    ["emergency", "data_outdated"].includes(b),
  );
  const meta = [
    CATEGORY_LABELS[place.category],
    place.district ? DISTRICT_LABELS[place.district] : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const extraServices = place.services.length - VISIBLE_SERVICES;

  return (
    <div
      className={`card p-4 ${
        emergencyMode && isEmergency ? "ring-1 ring-emergency/40" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${
            isEmergency
              ? "border-emergency/15 bg-emergency-50"
              : "border-brand-100 bg-brand-50"
          }`}
        >
          <ServiceIcon category={place.category} className="h-8 w-8" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/place/${place.slug}`}
              onClick={() => track("place_profile_opened", { placeId: place.id })}
              className="font-display text-base font-bold leading-snug text-ink transition-colors hover:text-brand"
            >
              {place.name}
            </Link>
            {place.distanceMeters != null && (
              <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                {formatDistance(place.distanceMeters)}
              </span>
            )}
          </div>

          <p className="mt-0.5 text-sm text-ink/55">{meta}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {open !== null && (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  open ? "bg-brand-50 text-brand-700" : "bg-ink/5 text-ink/50"
                }`}
              >
                {open ? "Відкрито" : "Зачинено"}
              </span>
            )}
            <DataBadgeChip place={place} />
            <TrustBadges badges={badges} />
            {suitsPet && (
              <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-medium text-white">
                Підходить для вашого улюбленця
              </span>
            )}
          </div>

          {place.services.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {place.services.slice(0, VISIBLE_SERVICES).map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-ink/[0.04] px-2 py-0.5 text-[11px] text-ink/60"
                >
                  {s}
                </span>
              ))}
              {extraServices > 0 && (
                <span className="rounded-full bg-ink/[0.04] px-2 py-0.5 text-[11px] text-ink/45">
                  +{extraServices}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 border-t border-brand-100/70 pt-2 text-[11px] text-ink/45">
        📞 Перед візитом зателефонуйте — графік і наявність можуть змінюватися.
      </p>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <a
          href={`tel:${place.phone}`}
          onClick={() => track("call_clicked", { placeId: place.id })}
          className="btn btn-brand rounded-full px-2 py-2 text-[13px] sm:text-sm"
        >
          Зателефонувати
        </a>
        <a
          href={googleMapsRoute(place, origin)}
          {...EXTERNAL_LINK_PROPS}
          onClick={() => track("route_clicked", { placeId: place.id })}
          className="btn btn-ghost rounded-full px-2 py-2 text-[13px] sm:text-sm"
        >
          Маршрут
        </a>
        {website ? (
          <a
            href={website}
            {...EXTERNAL_LINK_PROPS}
            onClick={() => track("website_clicked", { placeId: place.id })}
            className="btn btn-ghost rounded-full px-2 py-2 text-[13px] sm:text-sm"
          >
            Сайт
          </a>
        ) : (
          <Link
            href={`/place/${place.slug}`}
            className="btn btn-ghost rounded-full px-2 py-2 text-[13px] sm:text-sm"
          >
            Деталі
          </Link>
        )}
      </div>
    </div>
  );
}

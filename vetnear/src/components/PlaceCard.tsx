"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DataBadgeChip } from "@/components/DataBadge";
import { TrustBadges } from "@/components/TrustBadges";
import { PhoneIcon, RouteIcon, ServiceIcon } from "@/components/icons/ServiceIcons";
import { track } from "@/lib/analytics";
import { reportLead } from "@/lib/leads/report";
import { shouldLabelAsPromoted } from "@/lib/places/tier";
import { formatDistance, getOpenNowStatus } from "@/lib/distance";
import { CATEGORY_LABELS, DISTRICT_LABELS } from "@/lib/labels";
import { googleMapsRoute } from "@/lib/maps";
import { EXTERNAL_LINK_PROPS, safeUrl } from "@/lib/security/url";
import { computeBadges } from "@/lib/trust";
import { availabilityDuringAlert } from "@/lib/safety/placeAvailability";
import type { KyivAlertStatus } from "@/lib/safety/types";
import type { AnimalType, Coordinates, PlaceWithDistance } from "@/lib/types";
import { FavoritePlaceButton } from "@/components/FavoritePlaceButton";

// Re-export for older imports.
export { googleMapsRoute };

/** Service chips shown before collapsing the rest into a "+N" counter. */
const VISIBLE_SERVICES = 3;

export function PlaceCard({
  place,
  origin,
  emergencyMode = false,
  petAnimal,
  activePetId,
  alert,
}: {
  place: PlaceWithDistance;
  origin?: Coordinates | null;
  emergencyMode?: boolean;
  petAnimal?: AnimalType;
  activePetId?: string;
  alert?: KyivAlertStatus | null;
}) {
  const suitsPet = petAnimal ? place.animalTypes.includes(petAnimal) : false;
  // Paid placement is always disclosed, and never shown in emergency mode
  // (where the boost is switched off anyway — see lib/places/tier.ts).
  const promoted = shouldLabelAsPromoted(place, { emergency: emergencyMode });
  // Compute open-now after mount to avoid hydration mismatch.
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => setOpen(getOpenNowStatus(place)), [place]);

  const website = safeUrl(place.website);
  const isEmergency = place.emergencyAvailable || place.isOpen24_7;
  // Verification is communicated once, by the provenance badge (DataBadgeChip);
  // "open now" has its own live chip — so only the remaining signals stay here.
  const badges = computeBadges(place).filter((b) =>
    b === "data_outdated" || (b === "emergency" && place.emergencyAvailable),
  );
  const meta = [
    CATEGORY_LABELS[place.category],
    place.district ? DISTRICT_LABELS[place.district] : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const extraServices = place.services.length - VISIBLE_SERVICES;
  const alertAvailability = availabilityDuringAlert(place, alert ?? null);
  const routeBlocked = alertAvailability === "closed";

  return (
    <div
      className={`card place-card p-4 sm:p-5 ${
        emergencyMode && isEmergency ? "ring-1 ring-emergency/40" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className={`icon3d h-12 w-12 ${isEmergency ? "icon3d--warm" : ""}`}>
          <ServiceIcon category={place.category} className="h-9 w-9" />
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
            <div className="flex shrink-0 items-center gap-1.5">
              {place.distanceMeters != null && (
                <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-bold tabular-nums text-white">{formatDistance(place.distanceMeters)}</span>
              )}
              <FavoritePlaceButton placeId={place.id} compact />
            </div>
          </div>

          <p className="mt-0.5 text-sm text-ink/55">{meta}</p>
          {place.address && <p className="mt-0.5 truncate text-xs text-ink/45">{place.address}</p>}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {alertAvailability === "closed" && (
              <span className="rounded-full bg-emergency px-2 py-0.5 text-[11px] font-semibold text-white">
                Зачинено через червону загрозу
              </span>
            )}
            {alertAvailability === "call_first" && (
              <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-semibold text-amber">
                Під час тривоги — спочатку зателефонуйте
              </span>
            )}
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
            {promoted && (
              <span
                title="Заклад оплатив просування. Це не впливає на перевірку даних і не діє в термінових запитах."
                className="rounded-full border border-ink/10 bg-ink/[0.04] px-2 py-0.5 text-[11px] font-medium text-ink/55"
              >
                Промо
              </span>
            )}
            <TrustBadges badges={badges} />
            {suitsPet && (
              <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                Підходить вашому улюбленцю
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

          {(place.nightDoctorOnSite || place.autonomousPower || place.oxygenBoxCount) && (
            <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Можливості невідкладної допомоги">
              {place.nightDoctorOnSite && (
                <span className="rounded-full border border-brand-100 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                  Лікар вночі
                </span>
              )}
              {place.autonomousPower && (
                <span className="rounded-full border border-brand-100 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                  Автономне живлення
                </span>
              )}
              {Boolean(place.oxygenBoxCount) && (
                <span className="rounded-full border border-brand-100 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                  Кисневі бокси: {place.oxygenBoxCount}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <a
          href={`tel:${place.phone}`}
          onClick={() => {
            track("call_clicked", { placeId: place.id });
            reportLead(place.id, "call");
          }}
          className="btn btn-brand px-3 py-2.5 text-[13px] sm:text-sm"
        >
          <PhoneIcon className="h-6 w-6" />
          Зателефонувати
        </a>
        {routeBlocked ? (
          <span
            aria-disabled="true"
            title="Комунальна клініка не працює під час червоної повітряної загрози"
            className="btn cursor-not-allowed bg-ink/5 px-3 py-2.5 text-[13px] text-ink/40 sm:text-sm"
          >
            Маршрут недоступний
          </span>
        ) : (
          <a
            href={googleMapsRoute(place, origin)}
            {...EXTERNAL_LINK_PROPS}
            onClick={() => {
              track("route_clicked", { placeId: place.id });
              reportLead(place.id, "route");
            }}
            className="btn btn-ghost px-3 py-2.5 text-[13px] sm:text-sm"
          >
            <RouteIcon className="h-6 w-6" />
            Маршрут
          </a>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs">
        <Link href={`/place/${place.slug}`} className="font-semibold text-brand hover:underline">
          Деталі закладу
        </Link>
        {activePetId && (
          <Link href={`/my-pets/${activePetId}`} className="font-medium text-ink/55 hover:text-brand hover:underline">
            До медкартки
          </Link>
        )}
        {website && (
          <a
            href={website}
            {...EXTERNAL_LINK_PROPS}
            onClick={() => {
              track("website_clicked", { placeId: place.id });
              reportLead(place.id, "website");
            }}
            className="text-ink/50 hover:text-brand hover:underline"
          >
            Відкрити сайт
          </a>
        )}
      </div>
    </div>
  );
}

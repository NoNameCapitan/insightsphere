import Link from "next/link";
import { Disclaimer, JsonLd } from "@/components/JsonLd";
import { PlaceCardStatic } from "@/components/PlaceCardStatic";
import { t } from "@/lib/i18n";
import { itemListJsonLd, SITE } from "@/lib/seo";
import type { Place } from "@/lib/types";

/**
 * Reusable, statically-rendered landing layout for the SEO pages. It lists a
 * pre-filtered set of places (no geolocation needed) and routes users into the
 * live /nearby experience.
 */
export function Landing({
  h1,
  intro,
  places,
  path,
  ctaHref,
  ctaLabel,
  emergencyMode = false,
}: {
  h1: string;
  intro: string;
  places: Place[];
  path: string;
  ctaHref: string;
  ctaLabel: string;
  emergencyMode?: boolean;
}) {
  const pageUrl = `${SITE.url}${path}`;
  return (
    <div className="container-px mx-auto max-w-3xl py-6">
      <JsonLd data={itemListJsonLd(places, pageUrl)} />

      <h1
        className={`font-display text-2xl font-extrabold ${
          emergencyMode ? "text-emergency-700" : "text-ink"
        }`}
      >
        {h1}
      </h1>
      <p className="mt-2 text-ink/70">{intro}</p>

      <div className="mt-4">
        <Link
          href={ctaHref}
          className={`btn ${emergencyMode ? "btn-emergency" : "btn-brand"}`}
        >
          {ctaLabel}
        </Link>
      </div>

      <div className="mt-5">
        <Disclaimer text={t.disclaimer} />
      </div>

      {emergencyMode && places.length === 0 ? (
        <div className="mt-5 rounded-3xl border border-emergency/20 bg-emergency-50/50 p-8 text-center">
          <p aria-hidden className="text-3xl">🩺</p>
          <p className="mt-3 text-sm font-medium text-emergency-700">
            Підтверджені невідкладні заклади очікують ручної перевірки.
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink/65">
            Поки що VetNear може показати найближчі перевірені ветклініки.
            У критичній ситуації телефонуйте напряму до закладу.
          </p>
          <Link
            href="/nearby?category=veterinary_clinic&sort=distance"
            className="btn btn-emergency mt-4 text-sm"
          >
            Показати найближчі перевірені ветклініки
          </Link>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {places.map((p) => (
            <li key={p.id}>
              <PlaceCardStatic place={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

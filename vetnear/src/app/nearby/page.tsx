import type { Metadata } from "next";
import { Suspense } from "react";
import { NearbyClient } from "@/components/NearbyClient";
import { t } from "@/lib/i18n";

// Live geolocation + query params + Leaflet map — render on demand, not at build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: t.nearby.title,
  description: t.hero.subtitle,
  alternates: { canonical: "/nearby" },
  // The results depend on live geolocation + query params, so there is no
  // stable content to index here; canonical SEO value lives on the landing pages.
  robots: { index: false, follow: true },
};

/** Skeleton mirroring the results layout, so loading doesn't jump. */
function NearbyFallback() {
  return (
    <div className="container-px mx-auto max-w-3xl py-4" aria-busy="true">
      <p className="sr-only">{t.hero.locating}</p>
      <div className="h-10 animate-pulse rounded-2xl bg-brand-50" />
      <div className="mt-3 h-10 animate-pulse rounded-2xl bg-brand-50/70" />
      <ul className="mt-4 space-y-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li key={i} className="card p-4">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-brand-50" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded-full bg-brand-50" />
                <div className="h-3 w-1/3 animate-pulse rounded-full bg-brand-50/70" />
                <div className="h-3 w-1/2 animate-pulse rounded-full bg-brand-50/70" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="h-9 animate-pulse rounded-full bg-brand-50" />
              <div className="h-9 animate-pulse rounded-full bg-brand-50/70" />
              <div className="h-9 animate-pulse rounded-full bg-brand-50/70" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function NearbyPage() {
  // useSearchParams inside NearbyClient requires a Suspense boundary.
  return (
    <Suspense fallback={<NearbyFallback />}>
      <NearbyClient />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Landing } from "@/components/Landing";
import { PLACES } from "@/lib/data/places";
import { ALL_DISTRICTS, DISTRICT_LABELS, normalizeDistrict } from "@/lib/labels";
import type { KyivDistrict } from "@/lib/types";

// Rendered on demand (still full SSR HTML + JSON-LD). Keeps the build's
// "Collecting page data" phase free of per-district static params.
export const dynamic = "force-dynamic";

function isDistrict(v: string): v is KyivDistrict {
  return (ALL_DISTRICTS as string[]).includes(v);
}

export async function generateMetadata({ params }: { params: Promise<{ district: string }> }): Promise<Metadata> {
  const { district } = await params;
  if (!isDistrict(district)) return { title: "404" };
  const label = DISTRICT_LABELS[district];
  return {
    title: `Послуги для тварин — ${label}, Київ`,
    description: `Ветклініки, зоомагазини, аптеки, грумінг та інші послуги для тварин: ${label}, Київ.`,
    alternates: { canonical: `/city/kyiv/district/${district}` },
  };
}

export default async function DistrictPage({ params }: { params: Promise<{ district: string }> }) {
  const { district } = await params;
  if (!isDistrict(district)) {
    // Pre-v1.25 neighbourhood slugs move to the official district's page.
    const official = normalizeDistrict(district);
    if (official) permanentRedirect(`/city/kyiv/district/${official}`);
    notFound();
  }
  const label = DISTRICT_LABELS[district];
  const places = PLACES.filter((p) => p.district === district).slice(0, 30);
  return (
    <Landing
      h1={`Послуги для тварин — ${label}`}
      intro={`${label}, Київ: клініки, магазини, аптеки, грумінг та сервіси для тварин. Натисніть, щоб відсортувати найближчі.`}
      places={places}
      path={`/city/kyiv/district/${district}`}
      ctaHref={`/nearby?district=${district}`}
      ctaLabel="Дивитися поруч"
    />
  );
}

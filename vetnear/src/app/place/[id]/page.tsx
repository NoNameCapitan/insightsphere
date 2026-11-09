import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlaceActions } from "@/components/PlaceActions";
import { PlaceDetailMap } from "@/components/PlaceDetailMap";
import { Disclaimer, JsonLd } from "@/components/JsonLd";
import { TrustBadges } from "@/components/TrustBadges";
import { DataBadgeChip, DataWarningNote, VerifiedMeta } from "@/components/DataBadge";
import { ReportIncorrectButton } from "@/components/ReportIncorrectButton";
import { ServiceIcon } from "@/components/icons/ServiceIcons";
import { PlaceDetailUtilityActions } from "@/components/PlaceDetailUtilityActions";
import { GeneratedVisual } from "@/components/GeneratedVisual";
import { EMERGENCY_DATA_WARNING, isEmergencyPlace } from "@/lib/data/verification";
import { PLACES } from "@/lib/data/places";
import { isVerifiedPlace } from "@/lib/data/provenance";
import { CATEGORY_LABELS, ANIMAL_LABELS } from "@/lib/labels";
import { placeJsonLd, SITE } from "@/lib/seo";
import { computeBadges } from "@/lib/trust";
import type { PlaceWithDistance } from "@/lib/types";

const DAY_LABELS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function findPlace(id: string) {
  return PLACES.find((p) => p.slug === id || p.id === id) ?? null;
}

// Detail pages render the interactive client graph (PlaceActions, Leaflet map).
// They are rendered ON DEMAND rather than prerendered: this keeps `next build`
// fast/deterministic on constrained environments. Each request still returns
// full SSR HTML + JSON-LD, so the pages remain crawlable for SEO.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const place = findPlace(id);
  if (!place) return { title: "404" };
  const title = `${place.name} — ${CATEGORY_LABELS[place.category]}`;
  return {
    title,
    description: place.description,
    alternates: { canonical: `/place/${place.slug}` },
    openGraph: {
      title,
      description: place.description,
      url: `${SITE.url}/place/${place.slug}`,
      type: "website",
    },
  };
}

function HoursTable({ place }: { place: PlaceWithDistance }) {
  if (place.isOpen24_7) return <p className="text-ink/70">Цілодобово — 24/7</p>;
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <ul className="divide-y divide-brand-100/70 rounded-2xl border border-brand-100">
      {order.map((day) => {
        const wh = place.workingHours.find((w) => w.day === day);
        return (
          <li key={day} className="flex justify-between px-4 py-2 text-sm">
            <span className="font-medium text-ink/80">{DAY_LABELS[day]}</span>
            <span className="text-ink/60">
              {!wh || wh.closed ? "Зачинено" : `${wh.open}–${wh.close}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default async function PlaceDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const base = findPlace(id);
  if (!base) notFound();
  const place: PlaceWithDistance = { ...base, distanceMeters: null };
  const isEmergency = place.emergencyAvailable || place.isOpen24_7;
  const badges = computeBadges(place);

  return (
    <article className="container-px mx-auto max-w-3xl py-6 pb-24 sm:pb-6">
      <JsonLd data={placeJsonLd(place)} />

      <Link href="/nearby" className="text-sm text-brand hover:underline">
        ← Пошук поруч
      </Link>

      {/* 1. Header */}
      <header className="relative mt-3 grid items-start gap-4 overflow-hidden rounded-3xl border border-brand-100 bg-white p-4 shadow-card sm:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex items-start gap-3">
        <div
          aria-hidden
          className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl border ${
            isEmergency ? "border-emergency/15 bg-emergency-50" : "border-brand-100 bg-brand-50"
          }`}
        >
          <ServiceIcon category={place.category} className="h-9 w-9" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold text-ink">{place.name}</h1>
          <p className="text-ink/60">{CATEGORY_LABELS[place.category]}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {/* Verified places already show this label in VerifiedMeta below. */}
            {!isVerifiedPlace(place) && <DataBadgeChip place={place} />}
            <TrustBadges badges={badges} />
          </div>
          <VerifiedMeta place={place} className="mt-2" />
          <p className="mt-3 text-sm text-ink/60">
            Перед візитом зателефонуйте — графік, ціни та наявність можуть змінюватися.
          </p>
        </div></div>
        <GeneratedVisual src="/visuals/h-place-detail.webp" className="mx-auto h-56 w-full max-w-[380px] sm:h-60" motion="tilt" glow shine shadow sizes="(max-width: 640px) 90vw, 380px" />
      </header>

      <DataWarningNote place={place} className="mt-4" />
      {isEmergencyPlace(place) && (
        <div className="mt-3 rounded-2xl border border-emergency/30 bg-emergency-50 px-4 py-3 text-sm text-emergency-700">
          {EMERGENCY_DATA_WARNING}
        </div>
      )}

      {/* 2. Quick actions + 7/4/12 interactions */}
      <div className="mt-5">
        <PlaceActions place={place} />
      </div>
      <PlaceDetailUtilityActions placeId={place.id} />

      {/* 3. About */}
      <section className="mt-6">
        <h2 className="mb-2 font-display text-lg font-bold text-ink">Про заклад</h2>
        <p className="text-ink/80">{place.description}</p>
        <p className="mt-2 text-sm text-ink/70">
          <span className="font-semibold">Адреса: </span>{place.address}
        </p>
      </section>

      {/* 4. Services */}
      {place.services.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-display text-lg font-bold text-ink">Послуги</h2>
          <div className="flex flex-wrap gap-2">
            {place.services.map((s) => (
              <span key={s} className="rounded-full bg-ink/5 px-3 py-1 text-sm text-ink/70">{s}</span>
            ))}
          </div>
        </section>
      )}

      {/* 5. Animals served */}
      <section className="mt-6">
        <h2 className="mb-2 font-display text-lg font-bold text-ink">Які тварини</h2>
        <div className="flex flex-wrap gap-2">
          {place.animalTypes.map((a) => (
            <span key={a} className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700">
              {ANIMAL_LABELS[a]}
            </span>
          ))}
        </div>
      </section>

      {/* 7. Contacts */}
      <section className="mt-6">
        <h2 className="mb-2 font-display text-lg font-bold text-ink">Контакти</h2>
        <div className="space-y-1 text-sm text-ink/80">
          <p><span className="font-semibold">Телефон: </span>{place.phone}</p>
          {place.email && <p><span className="font-semibold">Email: </span>{place.email}</p>}
          {place.website && <p className="truncate"><span className="font-semibold">Сайт: </span>{place.website}</p>}
        </div>
      </section>

      {/* 8. Working hours */}
      <section className="mt-6">
        <h2 className="mb-2 font-display text-lg font-bold text-ink">Графік роботи</h2>
        <HoursTable place={place} />
      </section>

      {/* 9. Map */}
      <section className="mt-6">
        <PlaceDetailMap place={place} />
      </section>

      <div className="mt-6">
        <ReportIncorrectButton placeId={place.id} placeName={place.name} />
        <Disclaimer text="VetNear — інформаційний сервіс. Ми не ставимо діагнози та не призначаємо лікування. У невідкладних випадках звертайтесь до ветеринара." />
      </div>
    </article>
  );
}

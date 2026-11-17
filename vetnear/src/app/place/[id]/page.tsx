import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlaceActions, PlaceOpeningStatus } from "@/components/PlaceActions";
import { PlaceDetailMap } from "@/components/PlaceDetailMap";
import { Disclaimer, JsonLd } from "@/components/JsonLd";
import { TrustBadges } from "@/components/TrustBadges";
import { DataBadgeChip, DataWarningNote, VerifiedMeta } from "@/components/DataBadge";
import { ReportIncorrectButton } from "@/components/ReportIncorrectButton";
import { ServiceIcon } from "@/components/icons/ServiceIcons";
import { PlaceDetailUtilityActions } from "@/components/PlaceDetailUtilityActions";
import { SearchReturnLink } from "@/components/SearchReturnLink";
import { placeLocationLabel } from "@/lib/labels";
import styles from "./place.module.css";
import { isEmergencySearchSafe } from "@/lib/data/verification";
import { getPublicPlace } from "@/lib/server/placesFeed";
import { CATEGORY_LABELS, ANIMAL_LABELS } from "@/lib/labels";
import { placeJsonLd, SITE } from "@/lib/seo";
import { computeBadges } from "@/lib/trust";
import type { PlaceWithDistance } from "@/lib/types";

const DAY_LABELS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

// Detail pages render the interactive client graph (PlaceActions, Leaflet map).
// They are rendered ON DEMAND rather than prerendered: this keeps `next build`
// fast/deterministic on constrained environments. Each request still returns
// full SSR HTML + JSON-LD, so the pages remain crawlable for SEO.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const place = await getPublicPlace(id);
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
  if (place.isOpen24_7) {
    return <p className="text-ink/70">{isEmergencySearchSafe(place)
      ? "Цілодобовий графік підтверджено дзвінком. Перед виїздом уточніть можливість прийому."
      : "Джерело вказує цілодобовий графік; VetNear ще не підтвердив його дзвінком. Уточніть графік і можливість прийому телефоном."}</p>;
  }
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <ul className="divide-y divide-brand-100/70 rounded-2xl border border-brand-100">
      {order.map((day) => {
        const wh = place.workingHours.find((w) => w.day === day);
        return (
          <li key={day} className="flex justify-between px-4 py-2 text-sm">
            <span className="font-medium text-ink/80">{DAY_LABELS[day]}</span>
            <span className="text-ink/60">
              {!wh ? "Графік не уточнено" : wh.closed ? "Зачинено" : `${wh.open}–${wh.close}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default async function PlaceDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const base = await getPublicPlace(id);
  if (!base) notFound();
  const place: PlaceWithDistance = { ...base, distanceMeters: null };
  const badges = computeBadges(place).filter((badge) => badge === "data_outdated" || badge === "emergency" || badge === "claimed");

  return (
    <article className={`operating-screen container-px mx-auto max-w-3xl py-5 ${styles.page}`}>
      <JsonLd data={placeJsonLd(place)} />

      <SearchReturnLink />

      <header className={styles.header}>
        <div className={styles.titleRow}>
          <span aria-hidden className={styles.categoryIcon}><ServiceIcon category={place.category} className="h-7 w-7" /></span>
          <p>{CATEGORY_LABELS[place.category]} · {placeLocationLabel(place)}</p>
        </div>
        <h1 className={styles.title}>{place.name}</h1>
        <p className={styles.address}>{place.address}</p>
        <div className={styles.statusRow}>
          <PlaceOpeningStatus place={place} />
          <DataBadgeChip place={place} />
          <TrustBadges badges={badges} />
        </div>
      </header>

      <section className={styles.contact} aria-label="Контакти й запис">
        <PlaceActions place={place} />
      </section>
      <PlaceDetailUtilityActions placeId={place.id} />

      <details className={styles.provenance}>
        <summary>Як перевірено інформацію</summary>
        <VerifiedMeta place={place} className="mt-2" />
        {!place.lastVerifiedAt && <p className="mt-2 text-sm text-ink/70">Дата підтвердження не вказана. Перед візитом уточніть контакти й умови у закладі.</p>}
        {place.lastVerifiedAt && <p className="mt-2 text-sm text-ink/70">Перевірка даних: {place.lastVerifiedAt}. Це не гарантія прийому зараз.</p>}
        <DataWarningNote place={place} className="mt-3" />
      </details>

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
          {place.animalTypes.length === 0 && <p className="text-sm text-ink/70">Спеціалізацію за видом тварини ще не уточнено. Запитайте під час дзвінка.</p>}
          {place.animalTypes.map((a) => (
            <span key={a} className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700">
              {ANIMAL_LABELS[a]}
            </span>
          ))}
        </div>
      </section>

      <section className={styles.photoNote} aria-label="Фотографії закладу">
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h4l2-2h4l2 2h4v14H4Z"/><circle cx="12" cy="12" r="4"/></svg>
        <div><h2>Фото закладу ще не додано</h2><p>Вхід і приміщення можна уточнити на офіційному сайті.</p></div>
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

      <div className="mt-6 space-y-3">
        <Link href={`/partner-interest?claim=${encodeURIComponent(place.slug)}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline underline-offset-4">Це ваш заклад? Уточніть дані профілю</Link>
        <ReportIncorrectButton placeId={place.id} placeName={place.name} />
        <Disclaimer text="VetNear — інформаційний сервіс. Ми не ставимо діагнози та не призначаємо лікування. У невідкладних випадках звертайтесь до ветеринара." />
      </div>
    </article>
  );
}

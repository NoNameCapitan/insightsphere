"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatedCTAButton } from "@/components/AnimatedCTAButton";
import { EmergencyCtaIcon, ServiceIcon } from "@/components/icons/ServiceIcons";
import { ServiceCategoryCard } from "@/components/ServiceCategoryCard";
import { PLACES } from "@/lib/data/places";
import { isSearchablePublicPlace } from "@/lib/data/provenance";
import { hasPhoneConfirmedEmergency, SAFE_EMERGENCY_CTA_HREF } from "@/lib/data/verification";
import { CATEGORY_LABELS } from "@/lib/labels";
import { getPets } from "@/lib/pets/store";
import { t } from "@/lib/i18n";
import type { PlaceCategory } from "@/lib/types";

const QUICK: PlaceCategory[] = [
  "veterinary_clinic",
  "emergency_vet",
  "pet_store",
  "vet_pharmacy",
  "grooming",
  "shelter",
  "pet_boarding",
  "dog_training",
  "pet_friendly_place",
];

// Only show quick category buttons that actually have public results, so the
// homepage never advertises an empty category (emergency_vet, shelter,
// dog_training, pet_friendly_place currently have 0 places).
const PUBLIC_COUNT = PLACES.reduce<Partial<Record<PlaceCategory, number>>>((m, p) => {
  if (isSearchablePublicPlace(p)) m[p.category] = (m[p.category] ?? 0) + 1;
  return m;
}, {});
const QUICK_VISIBLE = QUICK.filter((c) => (PUBLIC_COUNT[c] ?? 0) > 0);

// Until an emergency place is phone-confirmed, the urgent button routes to the
// nearest vet clinics rather than promising 24/7 availability.
const EMERGENCY_HREF = hasPhoneConfirmedEmergency(PLACES)
  ? "/nearby?emergency=1"
  : SAFE_EMERGENCY_CTA_HREF;

/** One finite emergency animation cycle on touch devices (see globals.css). */
const EMERGENCY_TAP_MS = 2500;

export function HomeHero() {
  const router = useRouter();
  const [hasPets, setHasPets] = useState(false);
  const [emergencyTap, setEmergencyTap] = useState(false);
  const emergencyTapping = useRef(false);
  const emergencyTimer = useRef<number | undefined>(undefined);

  useEffect(() => setHasPets(getPets().length > 0), []);
  useEffect(() => () => window.clearTimeout(emergencyTimer.current), []);

  const handleEmergencyPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    if (emergencyTapping.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    emergencyTapping.current = true;
    setEmergencyTap(true);
    emergencyTimer.current = window.setTimeout(() => {
      emergencyTapping.current = false;
      setEmergencyTap(false);
    }, EMERGENCY_TAP_MS);
  };

  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 grid place-items-center">
        <div className="relative h-[120vw] max-h-[640px] w-[120vw] max-w-[640px]">
          {[0.25, 0.45, 0.7, 1].map((s, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand/15"
              style={{ width: `${s * 100}%`, height: `${s * 100}%` }}
            />
          ))}
          <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand" />
        </div>
      </div>

      <div className="container-px pb-10 pt-12 text-center">
        <p className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-surface/70 px-3 py-1 text-xs font-semibold text-brand-700 backdrop-blur">
          <span aria-hidden>📍</span> Київ · послуги для тварин поруч
        </p>
        <h1 className="mx-auto mt-5 max-w-xl text-4xl font-extrabold leading-[1.05] sm:text-5xl">
          VetNear — ветеринарна допомога поруч
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base text-ink/65">
          Знайдіть найближчу ветклініку, ветаптеку, зоомагазин, грумінг або
          перетримку в Києві. Без діагнозів і призначень.
        </p>

        {/* One clear primary action; everything below it is deliberately quieter. */}
        <div className="mx-auto mt-8 flex max-w-md flex-col">
          <AnimatedCTAButton href="/help" className="btn btn-brand py-4 text-lg" playOnMount>
            <span aria-hidden className="text-xl">🐾</span> Знайти допомогу поруч
          </AnimatedCTAButton>

          {/* Secondary quick links — one compact row of equal, low-weight cards. */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Link href="/nearby?category=veterinary_clinic&sort=distance" className="quick-link">
              <span aria-hidden>🩺</span> Ветклініки
            </Link>
            <Link href="/assistant" className="quick-link">
              <span aria-hidden>✨</span> ШІ-асистент
            </Link>
            <Link href="/my-pets/new" className="quick-link">
              <span aria-hidden>🐾</span> {hasPets ? "Улюбленці" : "Профіль"}
            </Link>
          </div>

          {/* Safety-critical CTA: set apart by its rose color and outline, not by
              size or shouting — it must not compete with the primary CTA above. */}
          <Link
            href={EMERGENCY_HREF}
            className={`btn mt-6 border border-emergency/25 bg-emergency-50 py-3 text-sm text-emergency-700 hover:border-emergency/45 hover:bg-emergency-100 emergency-cta${emergencyTap ? " emergency-cta--tap" : ""}`}
            onPointerDown={handleEmergencyPointerDown}
          >
            <span aria-hidden className="emergency-cta__pulse emergency-cta__pulse--one" />
            <span aria-hidden className="emergency-cta__pulse emergency-cta__pulse--two" />
            <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emergency">
              <EmergencyCtaIcon className="emergency-cta__icon" />
            </span>
            Термінова ситуація — найближчі ветклініки
          </Link>

          {/* Tertiary links share one quiet chip style instead of competing. */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/add-place"
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-surface/70 px-3 py-1.5 text-xs font-medium text-ink/55 transition hover:border-brand-300 hover:text-brand-700"
            >
              <span aria-hidden>🏥</span> Я представляю зообізнес — додати безкоштовно
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-surface/70 px-3 py-1.5 text-xs font-medium text-ink/55 transition hover:border-brand-300 hover:text-brand-700"
            >
              <span aria-hidden>🎬</span> Демо для журі
            </Link>
          </div>
        </div>

        {/* Static interface preview: shows what a found result looks like.
            Explicitly labeled as an example — no fake map or live data. */}
        <div
          aria-hidden
          className="pointer-events-none mx-auto mt-10 max-w-md select-none animate-rise text-left"
        >
          <div className="card p-4 shadow-pop">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/40">
                Так виглядає результат
              </p>
              <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-medium text-ink/50">
                приклад
              </span>
            </div>
            <div className="mt-3 flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-brand-100 bg-brand-50">
                <ServiceIcon category="veterinary_clinic" className="h-8 w-8" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display text-base font-bold leading-snug text-ink">
                    Найближча ветклініка
                  </p>
                  <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                    1.2 км
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                    ✓ Перевірено
                  </span>
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                    Відкрито
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <span className="btn btn-brand rounded-full py-2 text-sm">Зателефонувати</span>
              <span className="btn btn-ghost rounded-full py-2 text-sm">Маршрут</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container-px pt-2">
        <p className="mb-3 text-center text-sm font-semibold text-ink/50">
          Або оберіть категорію
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {QUICK_VISIBLE.map((c) => (
            <ServiceCategoryCard
              key={c}
              category={c}
              label={CATEGORY_LABELS[c]}
              onClick={() => router.push(`/nearby?category=${c}`)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

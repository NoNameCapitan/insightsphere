"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatedCTAButton } from "@/components/AnimatedCTAButton";
import { EmergencyCtaIcon } from "@/components/icons/ServiceIcons";
import { PetCareCockpit } from "@/components/PetCareCockpit";
import { PetFirstSelector } from "@/components/PetFirstSelector";
import { ServiceCategoryCard } from "@/components/ServiceCategoryCard";
import { PLACES } from "@/lib/data/places";
import { isSearchablePublicPlace } from "@/lib/data/provenance";
import { hasPhoneConfirmedEmergency, SAFE_EMERGENCY_CTA_HREF } from "@/lib/data/verification";
import type { PlaceCategory } from "@/lib/types";

/** Care-path cards: the pet's need first, the category second. */
const CARE_PATHS: { category: PlaceCategory; title: string; desc: string }[] = [
  { category: "veterinary_clinic", title: "Здоров’я", desc: "Ветклініки поруч" },
  { category: "vet_pharmacy", title: "Ліки", desc: "Ветаптеки поруч" },
  { category: "pet_store", title: "Їжа й товари", desc: "Зоомагазини поруч" },
  { category: "grooming", title: "Догляд", desc: "Грумінг і стрижка" },
  { category: "pet_boarding", title: "Перетримка", desc: "Коли треба залишити улюбленця" },
];

// Never advertise an empty category (e.g. shelters currently have 0 public
// places), and keep the honest pilot-base numbers for the hero trust line.
const PUBLIC = PLACES.filter(isSearchablePublicPlace);
const TOTAL = PUBLIC.length;
const VERIFIED = PUBLIC.filter((p) => p.verificationStatus === "verified").length;
const PUBLIC_COUNT = PUBLIC.reduce<Partial<Record<PlaceCategory, number>>>((m, p) => {
  m[p.category] = (m[p.category] ?? 0) + 1;
  return m;
}, {});
const CARE_VISIBLE = CARE_PATHS.filter((c) => (PUBLIC_COUNT[c.category] ?? 0) > 0);

/** Ukrainian plural form for "місце" (1 місце / 2 місця / 5 місць). */
function placesWord(n: number): string {
  const d = n % 10;
  const h = n % 100;
  if (d === 1 && h !== 11) return "місце";
  if (d >= 2 && d <= 4 && (h < 10 || h > 20)) return "місця";
  return "місць";
}

// Until an emergency place is phone-confirmed, the urgent button routes to the
// nearest vet clinics rather than promising 24/7 availability.
const EMERGENCY_HREF = hasPhoneConfirmedEmergency(PLACES)
  ? "/nearby?emergency=1"
  : SAFE_EMERGENCY_CTA_HREF;

/** One finite emergency animation cycle on touch devices (see globals.css). */
const EMERGENCY_TAP_MS = 2500;

function LocationPin({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 21s-6.5-5.4-6.5-10A6.5 6.5 0 0 1 12 4.5 6.5 6.5 0 0 1 18.5 11c0 4.6-6.5 10-6.5 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2.4" fill="currentColor" />
    </svg>
  );
}

/** Warm mint/peach "care aura" behind the hero (styles in globals.css). */
function HeroAura() {
  return (
    <div aria-hidden className="hero-aura pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <span className="hero-aura__glow hero-aura__glow--mint" />
      <span className="hero-aura__glow hero-aura__glow--peach" />
      <span className="hero-aura__glow hero-aura__glow--soft" />
    </div>
  );
}

export function HomeHero() {
  const [emergencyTap, setEmergencyTap] = useState(false);
  const emergencyTapping = useRef(false);
  const emergencyTimer = useRef<number | undefined>(undefined);

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
      <HeroAura />

      <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-10 sm:pt-14">
        {/* Above the fold: message left, pet-care cockpit right (stacked on mobile). */}
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="text-center lg:text-left">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-surface/70 px-3 py-1 text-xs font-semibold text-brand-700 backdrop-blur">
              <LocationPin className="h-3.5 w-3.5" /> Київ · pet-сервіси поруч
            </p>

            <h1 className="mx-auto mt-5 max-w-xl text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:mx-0">
              Улюбленець у пріоритеті.{" "}
              <span className="text-brand">Допомога — поруч.</span>
            </h1>

            <p className="mx-auto mt-4 max-w-md text-base text-ink/65 lg:mx-0">
              VetNear знаходить найближчі ветклініки, ветаптеки, зоомагазини, грумінг
              і pet-сервіси в Києві — без зайвої реєстрації та хаосу в пошуку.
            </p>

            <div className="mx-auto mt-8 flex max-w-md flex-col lg:mx-0">
              <AnimatedCTAButton href="/help" className="btn btn-brand py-4 text-lg" playOnMount>
                Знайти допомогу поруч
              </AnimatedCTAButton>

              {/* Safety-critical CTA: rose color and outline set it apart —
                  calm, not alarmist. Routing stays honest (no fake 24/7). */}
              <Link
                href={EMERGENCY_HREF}
                className={`btn mt-3 border border-emergency/25 bg-emergency-50 py-3 text-sm text-emergency-700 hover:border-emergency/45 hover:bg-emergency-100 emergency-cta${emergencyTap ? " emergency-cta--tap" : ""}`}
                onPointerDown={handleEmergencyPointerDown}
              >
                <span aria-hidden className="emergency-cta__pulse emergency-cta__pulse--one" />
                <span aria-hidden className="emergency-cta__pulse emergency-cta__pulse--two" />
                <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emergency">
                  <EmergencyCtaIcon className="emergency-cta__icon" />
                </span>
                Терміново — показати найближчі ветклініки
              </Link>

              {/* Honest trust microcopy, stated once. */}
              <p className="mt-4 text-xs text-ink/45">
                Без реєстрації · Пілотна база Києва: {TOTAL} {placesWord(TOTAL)},{" "}
                {VERIFIED} перевірено · Не замінює ветеринара
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                <Link
                  href="/add-place"
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-surface/70 px-3 py-1.5 text-xs font-medium text-ink/55 transition hover:border-brand-300 hover:text-brand-700"
                >
                  Я представляю зообізнес — додати безкоштовно
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-surface/70 px-3 py-1.5 text-xs font-medium text-ink/55 transition hover:border-brand-300 hover:text-brand-700"
                >
                  Демо для журі
                </Link>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[360px] py-6 lg:py-4">
            <PetCareCockpit />
          </div>
        </div>

        {/* The product starts from the pet, not from the directory. */}
        <PetFirstSelector emergencyHref={EMERGENCY_HREF} className="mt-14" />

        {/* Care paths — needs first, categories second. */}
        <div className="mt-14">
          <h2 className="text-center font-display text-xl font-bold text-ink">
            Що потрібно вашому улюбленцю?
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {CARE_VISIBLE.map((c) => (
              <ServiceCategoryCard
                key={c.category}
                category={c.category}
                label={c.title}
                description={c.desc}
                href={`/nearby?category=${c.category}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useRef } from "react";
import { EmergencyCtaIcon, LocationIcon } from "@/components/icons/ServiceIcons";
import { PetCareCockpit } from "@/components/PetCareCockpit";
import { GeneratedVisual } from "@/components/GeneratedVisual";
import { HeroMotionLayer } from "@/components/HeroMotionLayer";
import { HeroOrbit } from "@/components/HeroOrbit";
import { CountUp } from "@/components/motion/CountUp";
import { RevealGroup } from "@/components/RevealGroup";
import { ServiceCategoryCard } from "@/components/ServiceCategoryCard";
import { usePointerVars } from "@/hooks/usePointerVars";
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
// places), and keep the honest Kyiv dataset numbers for the hero trust line.
const PUBLIC = PLACES.filter(isSearchablePublicPlace);
const TOTAL = PUBLIC.length;
const VERIFIED = PUBLIC.filter((p) => p.verificationStatus === "verified").length;
const PUBLIC_COUNT = PUBLIC.reduce<Partial<Record<PlaceCategory, number>>>((m, p) => {
  m[p.category] = (m[p.category] ?? 0) + 1;
  return m;
}, {});
const CARE_VISIBLE = CARE_PATHS.filter((c) => (PUBLIC_COUNT[c.category] ?? 0) > 0);

const HEADLINE = ["Надійна", "допомога", "для", "вашого", "улюбленця", "поруч"];

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

/** Warm mint/peach "care aura" behind the hero (styles in globals.css). */
function HeroAura() {
  return (
    <div aria-hidden className="hero-aura pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <GeneratedVisual src="/visuals/a-visual-system.webp" className="visual-a-background absolute inset-0 h-full w-full" motion="none" reveal={false} fit="cover" priority sizes="100vw" />
      <HeroMotionLayer />
      <span className="hero-aura__glow hero-aura__glow--mint" />
      <span className="hero-aura__glow hero-aura__glow--peach" />
      <span className="hero-aura__glow hero-aura__glow--soft" />
    </div>
  );
}

export function HomeHero() {
  const sectionRef = useRef<HTMLElement>(null);
  usePointerVars(sectionRef);

  return (
    <section ref={sectionRef} className="hero-3d relative overflow-hidden">
      <HeroAura />

      <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-8 sm:pt-14">
        {/* Above the fold: message left, pet-care cockpit right (stacked on mobile). */}
        <div className="grid items-center gap-6 sm:gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="text-center lg:text-left">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-surface/70 px-3 py-1 text-xs font-semibold text-brand-700 backdrop-blur">
              <LocationIcon className="h-5 w-5" /> Київ · pet-сервіси поруч
            </p>

            {/* Mobile: the orbit scene alone — the full cockpit shows from sm up. */}
            <HeroOrbit className="mx-auto mt-6 h-44 w-40 sm:hidden" priority />

            <h1 className="hero-title mx-auto mt-5 max-w-xl text-4xl font-bold leading-[1.08] sm:text-5xl lg:mx-0">
              {HEADLINE.map((word, i) => (
                <span key={word} className="hero-title__word" style={{ ["--i" as string]: i }}>
                  {i === HEADLINE.length - 1 ? (
                    <span className="hero-title__accent">
                      {word}
                      <svg aria-hidden viewBox="0 0 120 12" preserveAspectRatio="none" className="hero-title__stroke">
                        <path d="M2 8.5C22 3.5 44 2.5 62 5.2c18 2.7 38 3.2 56-1.2" />
                      </svg>
                    </span>
                  ) : (
                    word
                  )}{" "}
                </span>
              ))}
            </h1>

            <p className="mx-auto mt-4 max-w-md text-base text-ink/65 lg:mx-0">
              Перевірені ветклініки, ветаптеки й pet-сервіси Києва — з відстанню,
              статусом даних і прямим маршрутом менш ніж за 90 секунд.
            </p>

            <div className="mx-auto mt-8 flex max-w-md flex-col lg:mx-0">
              <Link href="/help" className="btn btn-brand hero-cta py-4 text-lg">
                Знайти допомогу поруч
                <svg aria-hidden viewBox="0 0 20 20" className="hero-cta__arrow h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 10h12M11 5l5 5-5 5" />
                </svg>
              </Link>

              {/* Safety-critical CTA: rose color and outline set it apart —
                  calm, not alarmist. Routing stays honest (no fake 24/7). */}
              <Link href={EMERGENCY_HREF} className="hero-urgent mt-3">
                <span aria-hidden className="hero-urgent__icon">
                  <EmergencyCtaIcon />
                </span>
                Термінова ситуація
              </Link>

              {/* Honest dataset numbers, counted up once. */}
              <dl className="hero-stats mt-6">
                <div>
                  <dt>{placesWord(TOTAL)} у базі</dt>
                  <dd><CountUp value={TOTAL} /></dd>
                </div>
                <div>
                  <dt>перевірено</dt>
                  <dd><CountUp value={VERIFIED} /></dd>
                </div>
                <div>
                  <dt>районів Києва</dt>
                  <dd><CountUp value={10} duration={900} /></dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-ink/45">Без реєстрації · Не замінює ветеринара</p>
            </div>
          </div>

          <div className="mx-auto hidden w-full max-w-[380px] pb-6 pt-16 sm:block lg:pb-4 lg:pt-20">
            <PetCareCockpit />
          </div>
        </div>

        {/* Care paths — needs first, categories second. */}
        <div className="care-section mt-10 sm:mt-16">
          <h2 className="text-center font-display text-xl font-bold text-ink">
            Що потрібно вашому улюбленцю?
          </h2>
          <RevealGroup className="care-grid mt-5 grid grid-cols-2 gap-3 sm:grid-cols-6">
            {CARE_VISIBLE.map((c) => (
              <ServiceCategoryCard
                key={c.category}
                category={c.category}
                label={c.title}
                description={c.desc}
                href={`/nearby?category=${c.category}`}
              />
            ))}
            {/* Completes the grid without advertising an empty category. */}
            {CARE_VISIBLE.length % 2 === 1 && (
              <ServiceCategoryCard tile="location" label="Усе поруч" description="Всі заклади списком і на карті" href="/nearby" />
            )}
          </RevealGroup>
        </div>
      </div>
    </section>
  );
}

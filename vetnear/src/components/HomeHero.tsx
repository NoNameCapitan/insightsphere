"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatedCTAButton } from "@/components/AnimatedCTAButton";
import { EmergencyCtaIcon } from "@/components/icons/ServiceIcons";
import { PetCareCockpit } from "@/components/PetCareCockpit";
import { PetFirstSelector } from "@/components/PetFirstSelector";
import { PLACES } from "@/lib/data/places";
import { isSearchablePublicPlace } from "@/lib/data/provenance";
import { hasPhoneConfirmedEmergency, SAFE_EMERGENCY_CTA_HREF } from "@/lib/data/verification";

// Honest pilot-base numbers for the hero trust line.
const PUBLIC = PLACES.filter(isSearchablePublicPlace);
const TOTAL = PUBLIC.length;
const VERIFIED = PUBLIC.filter((p) => p.verificationStatus === "verified").length;

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
    <section className="band-hero relative overflow-hidden">
      <HeroAura />

      <div className="mx-auto w-full max-w-5xl px-4 pb-14 pt-10 sm:pt-14">
        {/* Above the fold: message left, pet-care cockpit right (stacked on mobile). */}
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
          <div className="text-center lg:text-left">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-surface/80 px-3.5 py-1.5 text-xs font-semibold text-brand-700 shadow-card backdrop-blur">
              <LocationPin className="h-3.5 w-3.5" /> Київ · pet-сервіси поруч
            </p>

            {/* Second sentence always starts its own line and never breaks
                mid-phrase, so the headline reads as two clean statements. */}
            <h1 className="mx-auto mt-6 max-w-xl text-[1.95rem] font-extrabold leading-[1.08] sm:text-5xl lg:mx-0 lg:text-[3.5rem]">
              Улюбленець у пріоритеті.{" "}
              <span className="block text-brand sm:whitespace-nowrap">Допомога — поруч.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-ink/65 lg:mx-0">
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
              <p className="mt-5 text-xs leading-relaxed text-ink/45">
                Без реєстрації · Пілотна база Києва: {TOTAL} {placesWord(TOTAL)},{" "}
                {VERIFIED} перевірено · Не замінює ветеринара
              </p>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[360px] py-8 lg:py-10">
            <div className="origin-center lg:scale-[1.1]">
              <PetCareCockpit />
            </div>
          </div>
        </div>

        {/* The product starts from the pet, not from the directory. */}
        <PetFirstSelector emergencyHref={EMERGENCY_HREF} className="mt-10 shadow-pop" />

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
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
    </section>
  );
}

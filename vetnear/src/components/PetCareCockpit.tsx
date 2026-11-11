"use client";

import { LocationIcon, PhoneIcon, RouteIcon, ServiceIcon, VerifiedIcon } from "@/components/icons/ServiceIcons";
import { HeroOrbit } from "@/components/HeroOrbit";

// Calm product preview: a compact mobile card that demonstrates the main
// decision path. It tilts in 3D towards the pointer (--mx/--my are set on
// the hero section) with its content floating on separate depth planes.

export function PetCareCockpit() {
  return (
    <div aria-hidden className="cockpit mx-auto w-full max-w-[340px] select-none">
      <span className="cockpit__aura" />

      {/* Phone-like card */}
      <div className="cockpit__device relative rounded-[32px] border border-brand-100 bg-surface p-4 shadow-pop">
        <HeroOrbit className="cockpit__hero mx-auto -mt-24 mb-1 h-52 w-48 sm:-mt-28 sm:h-60 sm:w-56" priority />
        {/* Search context — the homepage stays focused on nearby help. */}
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-brand-100 bg-brand-50">
            <LocationIcon className="h-10 w-10" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-bold leading-tight text-ink">Допомога поруч</p>
            <p className="text-[11px] text-ink/50">Київ · радіус 3 км</p>
          </div>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-brand-50 px-2 py-1 text-[10px] font-semibold text-brand-700">12 місць</span>
        </div>

        {/* Selected need */}
        <div className="mt-3 rounded-2xl bg-brand-50/70 px-3.5 py-2.5">
          <p className="text-[11px] font-semibold text-brand-700/70">Найкращий збіг</p>
          <p className="mt-0.5 text-sm font-semibold text-ink">Перевірена ветклініка · відкрита</p>
        </div>

        {/* Best nearby result */}
        <div className="cockpit__result mt-3 rounded-2xl border border-brand-100 bg-surface p-3 shadow-card">
          <div className="flex items-start gap-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand-100 bg-brand-50">
              <ServiceIcon category="veterinary_clinic" className="h-7 w-7" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold text-ink">Animalia Clinic</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className="inline-flex items-center whitespace-nowrap rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold leading-4 text-white">
                  1.2 км
                </span>
                <span className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium leading-4 text-brand-700">
                  <VerifiedIcon className="h-3.5 w-3.5" /> Перевірено
                </span>
                <span className="inline-flex items-center whitespace-nowrap rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-medium leading-4 text-ink/60">
                  Відкрито
                </span>
              </div>
            </div>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <span className="btn btn-brand min-w-0 gap-1.5 whitespace-nowrap rounded-xl px-2 py-2 text-xs"><PhoneIcon className="h-4 w-4 shrink-0" />Зателефонувати</span>
            <span className="btn btn-ghost min-w-0 gap-1.5 whitespace-nowrap rounded-xl px-2 py-2 text-xs"><RouteIcon className="h-4 w-4 shrink-0" />Маршрут</span>
          </div>
        </div>

        <span className="cockpit__glare" />
      </div>
    </div>
  );
}

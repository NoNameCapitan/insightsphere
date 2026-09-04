import { ServiceIcon } from "@/components/icons/ServiceIcons";

// Premium "pet-care cockpit" hero mockup: a phone-like card with the pet at
// the top, the current need in the middle and the best nearby result with
// call/route actions at the bottom, surrounded by a dashed care ring and
// floating distance chips (styles: globals.css "Pet-care hero"). The whole
// composition is decorative — aria-hidden, pointer-events-none, explicitly
// labeled "приклад інтерфейсу" so it never reads as live data.

function CatAvatar({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <path d="M12.4 21 10.6 6.8l11.6 6.4" fill="#fff" stroke="#0E7C66" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M35.6 21 37.4 6.8l-11.6 6.4" fill="#fff" stroke="#0E7C66" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M14.8 17.6l-1-7 6 3.4z" fill="#F9E0D3" />
      <path d="M33.2 17.6l1-7-6 3.4z" fill="#F9E0D3" />
      <circle cx="24" cy="27.5" r="13" fill="#fff" stroke="#0E7C66" strokeWidth="2.2" />
      <circle cx="18.6" cy="25.5" r="1.7" fill="#0E7C66" />
      <circle cx="29.4" cy="25.5" r="1.7" fill="#0E7C66" />
      <path d="M22.3 30h3.4L24 31.8 22.3 30Z" fill="#E8825F" />
      <path d="M24 31.8v2.4" stroke="#E8825F" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M14 28.5c-2.2.3-4.2.2-6-.3M14.4 31.6c-1.9.6-3.8.8-5.8.7M34 28.5c2.2.3 4.2.2 6-.3M33.6 31.6c1.9.6 3.8.8 5.8.7"
        stroke="#0E7C66"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity=".45"
      />
    </svg>
  );
}

function HeartIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function PawGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="#0E7C66" className={className} aria-hidden>
      <ellipse cx="12" cy="16.2" rx="4.6" ry="3.9" />
      <circle cx="5.8" cy="11.2" r="2" />
      <circle cx="9.9" cy="7.9" r="2.1" />
      <circle cx="14.1" cy="7.9" r="2.1" />
      <circle cx="18.2" cy="11.2" r="2" />
    </svg>
  );
}

/** Faint street grid + dashed route behind the phone — a map feel, not a map. */
function MapBackdrop() {
  return (
    <span className="cockpit__map">
      <svg viewBox="0 0 320 400" preserveAspectRatio="none" aria-hidden>
        <g stroke="#0E7C66" strokeOpacity="0.09" strokeWidth="1.4">
          <path d="M-10 92h340M-10 214h340M-10 320h340" />
          <path d="M74 -10v420M196 -10v420M268 -10v420" />
        </g>
        <path
          d="M52 336C96 320 108 268 150 250s86-10 108-52"
          fill="none"
          stroke="#0E7C66"
          strokeOpacity="0.3"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray="7 9"
        />
        <circle cx="52" cy="336" r="5" fill="#E8825F" fillOpacity="0.5" />
        <circle cx="258" cy="198" r="6" fill="#0E7C66" fillOpacity="0.35" />
      </svg>
    </span>
  );
}

export function PetCareCockpit() {
  return (
    <div aria-hidden className="cockpit pointer-events-none mx-auto w-[290px] select-none sm:w-[312px]">
      <MapBackdrop />
      <span className="cockpit__aura" />
      <span className="cockpit__ring" />

      {/* Phone-like card */}
      <div className="relative rounded-[32px] border border-brand-100 bg-surface p-4 shadow-pop animate-rise">
        {/* Pet profile header */}
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-brand-100 bg-brand-50">
            <CatAvatar className="h-10 w-10" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-bold leading-tight text-ink">Мія · кіт</p>
            <p className="truncate text-[11px] text-ink/50">активний профіль</p>
          </div>
          <HeartIcon className="cockpit__heart h-5 w-5 shrink-0 text-peach" />
        </div>

        {/* Selected need */}
        <div className="mt-3 rounded-2xl bg-brand-50/70 px-3.5 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-700/70">
            Потреба
          </p>
          <p className="mt-0.5 text-sm font-semibold text-ink">Потрібна ветклініка поруч</p>
        </div>

        {/* Best nearby result */}
        <div className="mt-3 rounded-2xl border border-brand-100 bg-surface p-3 shadow-card">
          <div className="flex items-start gap-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand-100 bg-brand-50">
              <ServiceIcon category="veterinary_clinic" className="h-7 w-7" />
            </span>
            <div className="min-w-0 flex-1">
              {/* Kept on one line so the floating chips, which are anchored to
                  fixed offsets, always land in the gaps between rows. */}
              <p className="whitespace-nowrap font-display text-[13px] font-bold text-ink">
                Найближча ветклініка
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  1.2 км
                </span>
                <span className="rounded-full border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                  ✓ Перевірено
                </span>
                <span className="rounded-full bg-ink/5 px-1.5 py-0.5 text-[10px] font-medium text-ink/60">
                  Відкрито
                </span>
              </div>
            </div>
          </div>
          {/* Tight type so both labels fit the narrow mock card at 375px. */}
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <span className="btn btn-brand rounded-xl px-1.5 py-2 text-[11px]">
              Зателефонувати
            </span>
            <span className="btn btn-ghost rounded-xl px-1.5 py-2 text-[11px]">Маршрут</span>
          </div>
        </div>

        <p className="mt-2.5 text-center text-[10px] font-medium uppercase tracking-wider text-ink/35">
          приклад інтерфейсу
        </p>
      </div>

      {/* Floating nearby chips */}
      <span className="cockpit__chip cockpit__chip--pharmacy">
        <ServiceIcon category="vet_pharmacy" /> Ветаптека · 0.8 км
      </span>
      <span className="cockpit__chip cockpit__chip--grooming">
        <ServiceIcon category="grooming" /> Грумінг · 2.1 км
      </span>
      <span className="cockpit__chip cockpit__chip--store">
        <ServiceIcon category="pet_store" /> Зоотовари · поруч
      </span>

      {/* Wandering paw prints */}
      <PawGlyph className="cockpit__paw cockpit__paw--1" />
      <PawGlyph className="cockpit__paw cockpit__paw--2" />
    </div>
  );
}

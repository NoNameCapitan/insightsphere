import Link from "next/link";
import { HomeHero } from "@/components/HomeHero";
import { SocialImpact } from "@/components/SocialImpact";

// The home page is statically rendered. WebSite JSON-LD is emitted once in the
// root layout. Structure (top → bottom): pet-first hero (headline, CTAs, trust
// microcopy, pet-care cockpit mockup, pet selector, care-path cards — all in
// HomeHero), warm trust cards + compact safety line, small "Популярні розділи"
// pills, a collapsed "Докладніше про VetNear" block (full SEO/safety prose
// stays in the DOM) and the compact social-impact card.

const SEO_LINKS: { href: string; label: string }[] = [
  { href: "/pet-services-near-me", label: "Послуги для тварин поруч" },
  { href: "/vet-clinic-near-me", label: "Ветклініки поруч" },
  { href: "/emergency-vet-near-me", label: "Термінова ситуація" },
  { href: "/pet-store-near-me", label: "Зоомагазини поруч" },
  { href: "/vet-pharmacy-near-me", label: "Ветаптеки поруч" },
  { href: "/grooming-near-me", label: "Грумінг поруч" },
  { href: "/pet-map-kyiv", label: "Карта закладів Києва" },
  { href: "/city/kyiv/shelters", label: "Притулки Києва" },
];

/* Small single-color SVG glyphs for the trust cards — no emoji. */
function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <path
        d="M6.6 3.5h2.6l1.4 4-2 1.5a12.8 12.8 0 0 0 5.9 5.9l1.5-2 4 1.4v2.6c0 1-.8 1.9-1.9 1.8C10.6 18 6 13.4 5.3 5.9c-.5-1.3.3-2.4 1.3-2.4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ShieldCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <path d="M12 3 5 5.8v5.4c0 4.4 3 7.9 7 9.3 4-1.4 7-4.9 7-9.3V5.8L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m9 11.8 2.2 2.2L15.4 9.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PawIconMini() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
      <ellipse cx="12" cy="16.2" rx="4.6" ry="3.9" />
      <circle cx="5.8" cy="11.2" r="2" />
      <circle cx="9.9" cy="7.9" r="2.1" />
      <circle cx="14.1" cy="7.9" r="2.1" />
      <circle cx="18.2" cy="11.2" r="2" />
    </svg>
  );
}

const TRUST_CARDS: { icon: React.ReactNode; text: string; tone: string }[] = [
  { icon: <BoltIcon />, text: "Без реєстрації", tone: "bg-brand-50 text-brand-700" },
  { icon: <PhoneIcon />, text: "Дзвінок і маршрут одразу", tone: "bg-brand-50 text-brand-700" },
  { icon: <ShieldCheckIcon />, text: "Дані позначені за рівнем перевірки", tone: "bg-peach-50 text-peach-700" },
  { icon: <PawIconMini />, text: "У фокусі потреба улюбленця, не реклама закладів", tone: "bg-peach-50 text-peach-700" },
];

export default function HomePage() {
  return (
    <>
      <HomeHero />

      {/* Warm trust cards + one calm safety line. */}
      <section className="container-px mx-auto max-w-3xl pt-10">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {TRUST_CARDS.map((c) => (
            <div
              key={c.text}
              className="flex flex-col items-start gap-2.5 rounded-2xl border border-brand-100 bg-surface p-3.5 shadow-card"
            >
              <span className={`grid h-9 w-9 place-items-center rounded-xl ${c.tone}`}>
                {c.icon}
              </span>
              <p className="text-xs font-semibold leading-snug text-ink/80">{c.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-ink/45">
          VetNear не ставить діагноз і не замінює ветеринара.
        </p>
      </section>

      <section className="container-px mx-auto max-w-3xl pt-10">
        <h2 className="text-sm font-semibold text-ink/50">Популярні розділи</h2>
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {SEO_LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="inline-flex items-center gap-1 rounded-full border border-brand-100 bg-surface px-3 py-1.5 text-xs font-medium text-ink/65 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                {l.label}
                <span aria-hidden className="text-brand/70">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Longer explanatory / SEO prose, collapsed into one calm disclosure.
          The full text stays in the DOM for readers and search engines. */}
      <section className="container-px mx-auto max-w-3xl pt-10">
        <details className="group rounded-2xl border border-brand-100 bg-surface shadow-card">
          <summary className="flex cursor-pointer select-none items-center justify-between gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 [&::-webkit-details-marker]:hidden">
            Докладніше про VetNear
            <span
              aria-hidden
              className="text-brand transition-transform group-open:rotate-180"
            >
              ▾
            </span>
          </summary>
          <div className="space-y-3 px-4 pb-4 text-sm text-ink/70">
            <p>
              VetNear допомагає власникам тварин у Києві знайти найближчу{" "}
              <strong>ветклініку</strong>, <strong>зоомагазин</strong>,{" "}
              <strong>ветаптеку</strong>, салон <strong>грумінгу</strong> або
              притулок. Дозвольте доступ до геолокації — і побачите заклади у
              радіусі 1–10 км із відстанню, графіком роботи й маршрутом.
            </p>
            <p>
              Якщо ситуація термінова — телефонуйте у клініку напряму; сервіс покаже
              найближчі ветклініки. Цілодобовий прийом ми позначаємо лише після
              підтвердження дзвінком. Коротке опитування перед візитом
              підкаже, який тип закладу шукати, проте{" "}
              <strong>не ставить діагноз</strong> і не призначає лікування.
            </p>
            <p>
              VetNear не замінює Google Maps. Ми додаємо pet-care контекст: тип тварини,
              потребу, релевантну категорію і статус довіри до даних.
            </p>
          </div>
        </details>
      </section>

      <SocialImpact compact className="pb-2 pt-10" />
    </>
  );
}

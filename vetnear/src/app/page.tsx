import Link from "next/link";
import { HomeHero } from "@/components/HomeHero";
import { SocialImpact } from "@/components/SocialImpact";
import { TrustStrip } from "@/components/TrustStrip";

// The home page is statically rendered. WebSite JSON-LD is emitted once in the
// root layout. Trust/disclaimer/dataset/social content lives in the compact
// TrustStrip disclosures; the longer SEO prose is collapsed behind a native
// <details> so the first screen stays light without losing indexable text.

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

export default function HomePage() {
  return (
    <>
      <HomeHero />

      <TrustStrip className="pt-8" />

      {/* Natural local-keyword prose — compact by default, full text kept in
          the DOM (inside <details>) for readers and search engines. */}
      <section className="container-px mx-auto max-w-3xl py-12">
        <h2 className="font-display text-xl font-bold text-ink">
          Ветеринарна допомога поруч — швидко й зрозуміло
        </h2>
        <p className="mt-3 text-ink/70">
          VetNear допомагає власникам тварин у Києві знайти найближчу{" "}
          <strong>ветклініку</strong>, <strong>зоомагазин</strong>,{" "}
          <strong>ветаптеку</strong>, салон <strong>грумінгу</strong> або притулок.
          Дозвольте доступ до геолокації — і побачите заклади у радіусі 1–10 км
          із відстанню, графіком роботи й маршрутом.
        </p>
        <details className="group mt-4 rounded-2xl border border-brand-100 bg-surface">
          <summary className="flex cursor-pointer select-none items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 [&::-webkit-details-marker]:hidden">
            Докладніше про сервіс
            <span
              aria-hidden
              className="text-brand transition-transform group-open:rotate-180"
            >
              ▾
            </span>
          </summary>
          <div className="space-y-3 px-4 pb-4 text-sm text-ink/70">
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

      <SocialImpact compact />

      <section className="container-px mx-auto max-w-3xl pb-8 pt-12">
        <h2 className="font-display text-lg font-bold text-ink">
          Популярні розділи
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {SEO_LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-surface px-3.5 py-2 text-sm font-medium text-ink/75 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                {l.label}
                <span aria-hidden className="text-brand">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

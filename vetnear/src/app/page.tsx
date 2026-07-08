import Link from "next/link";
import { HomeHero } from "@/components/HomeHero";
import { SocialImpact } from "@/components/SocialImpact";
import { TrustStrip } from "@/components/TrustStrip";

// The home page is statically rendered. WebSite JSON-LD is emitted once in the
// root layout. Structure (top → bottom): hero with primary/emergency CTAs and
// a one-line trust summary, interface preview, category cards (all inside
// HomeHero), then the compact trust disclosures, small "Популярні розділи"
// pills, a single collapsed "Докладніше про VetNear" block (full SEO/safety
// prose stays in the DOM inside <details>) and the compact social-impact card.

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

      <TrustStrip className="pt-10" />

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

import Image from "next/image";
import Link from "next/link";
import { DatasetSummary } from "@/components/DatasetSummary";
import { EmergencyReadinessRail } from "@/components/EmergencyReadinessRail";
import { FounderNote } from "@/components/FounderNote";
import { HomeHero } from "@/components/HomeHero";
import { HomeUpdatesStrip } from "@/components/HomeUpdatesStrip";
import { RevealGroup } from "@/components/RevealGroup";

// The home page is statically rendered. WebSite JSON-LD is emitted once in the
// root layout. Structure (top → bottom): help-first hero (headline, CTAs, trust
// microcopy, nearby-care cockpit and care-path cards — all in HomeHero), warm
// trust cards + compact safety line, a collapsed "Докладніше про VetNear" block (full SEO/safety prose
// stays in the DOM) and the compact social-impact card.

const TRUST_CARDS: { icon: string; text: string }[] = [
  { icon: "location", text: "Без реєстрації" },
  { icon: "phone", text: "Дзвінок і маршрут одразу" },
  { icon: "verified", text: "Статус перевірки в кожного закладу" },
  { icon: "shield", text: "Потреба улюбленця, не реклама" },
];

export default function HomePage() {
  return (
    <>
      <HomeHero />

      <EmergencyReadinessRail />

      <HomeUpdatesStrip />

      {/* Trust, stated once and compactly: one strip instead of four cards. */}
      <section className="container-px mx-auto max-w-3xl pt-10">
        <RevealGroup className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-3xl border border-brand-100 bg-surface p-4 shadow-card sm:grid-cols-4 sm:p-5">
          {TRUST_CARDS.map((c) => (
            <div key={c.text} className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-2.5">
              <span className="icon3d h-11 w-11">
                <Image src={`/visuals/parts/icon-${c.icon}.webp`} alt="" width={96} height={96} sizes="44px" />
              </span>
              <p className="text-xs font-semibold leading-snug text-ink/75">{c.text}</p>
            </div>
          ))}
        </RevealGroup>
      </section>

      {/* Honest dataset provenance, stated in full: how many places are verified
          vs. still awaiting manual review. Counts derive from the dataset. */}
      <DatasetSummary className="pt-6" />

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
              Ми додаємо pet-care контекст: на відміну від загальних мап, VetNear фільтрує результати за потребою улюбленця та актуальністю даних.
            </p>
            <FounderNote className="px-0 pt-1" />
          </div>
        </details>
      </section>

      {/* The full social-impact commitment lives on /for-partners. */}
      <p className="container-px mx-auto max-w-3xl pb-2 pt-8 text-center text-xs leading-5 text-ink/50">
        10% доходу від платних партнерських планів VetNear спрямує на реабілітацію постраждалих від війни.{" "}
        <Link href="/for-partners" className="font-semibold text-brand hover:underline">Докладніше</Link>
      </p>
    </>
  );
}

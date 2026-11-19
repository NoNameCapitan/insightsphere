import Link from "next/link";
import { DatasetSummary } from "@/components/DatasetSummary";
import { EmergencyReadinessRail } from "@/components/EmergencyReadinessRail";
import { FounderNote } from "@/components/FounderNote";
import { HomeDistricts } from "@/components/HomeDistricts";
import { HomeHero } from "@/components/HomeHero";
import { HomeUpdatesStrip } from "@/components/HomeUpdatesStrip";
import { HomeCareReturn } from "@/components/HomeCareReturn";

// The home page is statically rendered. WebSite JSON-LD is emitted once in the
// root layout. Structure (top → bottom): help-first hero (headline, CTAs, trust
// microcopy, nearby-care cockpit and care-path cards — all in HomeHero), warm
// trust cards + compact safety line, a collapsed "Докладніше про VetNear" block (full SEO/safety prose
// stays in the DOM) and the compact social-impact card.

export default function HomePage() {
  return (
    <>
      <HomeHero />

      <HomeCareReturn />

      <HomeDistricts />

      <HomeUpdatesStrip />

      <section className="owner-home" aria-labelledby="owner-home-title">
        <div>
          <h2 id="owner-home-title">Усе важливе про вашу тварину.<br /><span>В одному місці.</span></h2>
          <p>Медичні записи, щеплення та заплановані події — щоб підготуватися до візиту й нічого не забути.</p>
          <Link href="/my-pets" className="owner-home__link">Відкрити моїх тварин <svg aria-hidden className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 15 15 5M5 5h10v10" /></svg></Link>
        </div>
        <div className="owner-home__details">
          <div><span aria-hidden>+</span><p><strong>Своя картка для кожного</strong><small>Історія візитів, алергії та важливі нотатки.</small></p></div>
          <div><svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 11h16m-12 4h3m2 0h3" /></svg><p><strong>Наступний крок під рукою</strong><small>Дати, які ви обрали за рекомендацією ветеринара.</small></p></div>
          <p className="owner-home__local">Картки зберігаються у цьому браузері. Резервну копію можна завантажити в розділі «Мої тварини».</p>
        </div>
      </section>

      <EmergencyReadinessRail />

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
              VetNear допомагає власникам тварин у Києві та області знайти відповідну{" "}
              <strong>ветклініку</strong>, <strong>зоомагазин</strong>,{" "}
              <strong>ветаптеку</strong>, салон <strong>грумінгу</strong> або
              притулок. Дозвольте доступ до геолокації — і побачите заклади у
              вибраному радіусі із відстанню, відомим графіком роботи й маршрутом.
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

      <section className="home-partner" aria-labelledby="home-partner-title">
        <div><h2 id="home-partner-title">Ви дбаєте про тварин.<br /><span>Допоможемо вас знайти.</span></h2><p>Для клінік, аптек, грумерів та інших фахівців Києва й області. Безкоштовний профіль, перевірений перед публікацією, — щоб вас знаходили люди, яким ви потрібні.</p></div>
        <Link href="/for-partners">Стати партнером <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 19 19 5M5 5h14v14" /></svg></Link>
      </section>

      <p className="container-px mx-auto max-w-3xl pb-2 pt-8 text-center text-xs leading-5 text-ink/50">
        Плануємо програму підтримки реабілітації постраждалих від війни. Умови та звітність опублікуємо до її запуску.
      </p>
    </>
  );
}

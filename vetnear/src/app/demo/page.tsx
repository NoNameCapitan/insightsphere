import type { Metadata } from "next";
import Link from "next/link";
import { PLACES } from "@/lib/data/places";
import { isSearchablePublicPlace } from "@/lib/data/provenance";

// Controlled walkthrough for hackathon judges: three scenarios, honest MVP
// facts (derived from the dataset) and a short roadmap. Static, no live data.

export const metadata: Metadata = {
  title: "Демо VetNear для журі",
  description:
    "Три сценарії, які показують основну цінність VetNear: пошук поруч, відповідальна термінова допомога та партнерська модерація.",
  alternates: { canonical: "/demo" },
  robots: { index: false, follow: true },
};

const PUBLIC = PLACES.filter(isSearchablePublicPlace);
const TOTAL = PUBLIC.length;
const VERIFIED = PUBLIC.filter((p) => p.verificationStatus === "verified").length;

const SCENARIOS: {
  step: string;
  title: string;
  description: string;
  cta: { label: string; href: string; tone: "brand" | "emergency" | "ghost" }[];
}[] = [
  {
    step: "Сценарій 1",
    title: "Власник тварини шукає допомогу поруч",
    description:
      "Обирає категорію, бачить найближчі заклади з відстанню та статусом перевірки, телефонує або відкриває маршрут.",
    cta: [{ label: "Відкрити пошук поруч", href: "/nearby", tone: "brand" }],
  },
  {
    step: "Сценарій 2",
    title: "Термінова ситуація",
    description:
      "VetNear не вигадує неперевірені 24/7-заклади, а відповідально показує найближчі перевірені ветклініки та радить телефонувати напряму.",
    cta: [
      { label: "Перейти до термінової допомоги", href: "/emergency-vet-near-me", tone: "emergency" },
    ],
  },
  {
    step: "Сценарій 3",
    title: "Зообізнес подає заявку",
    description:
      "Партнер додає заклад через форму, а адміністратор перевіряє контакти, додає координати та схвалює заявку через панель модерації. Схвалені локальні заявки зʼявляються у пошуку поруч.",
    cta: [
      { label: "Подати тестову заявку", href: "/add-place", tone: "brand" },
      { label: "Відкрити модерацію", href: "/admin/moderation", tone: "ghost" },
    ],
  },
];

const FACTS = [
  `${TOTAL} місць у пілотній базі Києва`,
  `${VERIFIED} перевірено за публічними джерелами`,
  "Без діагнозів і призначень",
  "Безкоштовний локальний ШІ-навігатор",
  "Модерація партнерських заявок",
];

const ROADMAP = [
  "Підтвердження невідкладних/24⁄7 закладів дзвінком",
  "Публікація схвалених партнерів із Supabase у публічний пошук",
  "Повноцінний кабінет партнера",
  "Робочий процес імпорту Google Places",
  "Монетизація через партнерські інструменти",
  "Публічна звітність соціального внеску",
];

const TONE: Record<string, string> = {
  brand: "btn btn-brand py-2.5 text-sm",
  emergency: "btn btn-emergency py-2.5 text-sm",
  ghost: "btn btn-ghost py-2.5 text-sm",
};

export default function DemoPage() {
  return (
    <div className="container-px mx-auto max-w-3xl py-10">
      <p className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-surface px-3 py-1 text-xs font-semibold text-brand-700">
        <span aria-hidden>🎬</span> Для журі хакатону
      </p>
      <h1 className="mt-3 font-display text-3xl font-extrabold text-ink">
        Демо VetNear для журі
      </h1>
      <p className="mt-2 max-w-xl text-ink/65">
        Три сценарії, які показують основну цінність сервісу.
      </p>

      <div className="mt-6 space-y-4">
        {SCENARIOS.map((s) => (
          <section key={s.step} className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">
              {s.step}
            </p>
            <h2 className="mt-1 font-display text-lg font-bold text-ink">{s.title}</h2>
            <p className="mt-1.5 text-sm text-ink/70">{s.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {s.cta.map((c) => (
                <Link key={c.href} href={c.href} className={TONE[c.tone]}>
                  {c.label}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold text-ink">Факти MVP</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {FACTS.map((f) => (
            <li
              key={f}
              className="rounded-full border border-brand-100 bg-brand-50/60 px-3.5 py-2 text-sm font-medium text-brand-700"
            >
              {f}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-3xl border border-brand-100 bg-surface p-5">
        <h2 className="font-display text-lg font-bold text-ink">Що далі (roadmap)</h2>
        <ul className="mt-3 grid gap-2 text-sm text-ink/70 sm:grid-cols-2">
          {ROADMAP.map((r) => (
            <li key={r} className="flex gap-2">
              <span aria-hidden className="text-brand">→</span> {r}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-6 text-xs text-ink/45">
        VetNear не замінює консультацію ветеринара, не ставить діагнози й не
        призначає лікування. Демо-сторінка не індексується пошуковиками.
      </p>
    </div>
  );
}

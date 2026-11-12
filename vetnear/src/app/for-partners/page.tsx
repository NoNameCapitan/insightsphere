import type { Metadata } from "next";
import Link from "next/link";
import { PartnerInterestForm } from "@/components/PartnerInterestForm";
import { SocialImpact } from "@/components/SocialImpact";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "VetNear для партнерів",
  description: "Додайте ветклініку, ветаптеку, зоомагазин, грумінг або притулок у перевірений каталог VetNear.",
  alternates: { canonical: "/for-partners" },
  openGraph: { title: "VetNear для партнерів", url: `${SITE.url}/for-partners`, type: "website" },
};

const VALUE = [
  ["Намір уже сформований", "Користувач бачить профіль тоді, коли шукає конкретну послугу поруч."],
  ["Дії без зайвих кроків", "Телефон і маршрут доступні без реєстрації та рекламних барʼєрів."],
  ["Довіра до профілю", "Джерело, дата перевірки й статус даних показані користувачу відкрито."],
];

const PLANS = [
  {
    name: "Базовий",
    tagline: "Базовий лістинг безкоштовний",
    price: "Безкоштовно",
    note: "Після модерації",
    features: ["Профіль у пошуку й на карті", "Телефон, сайт і маршрут", "Статус перевірки даних", "Повідомлення про неточності"],
  },
  {
    name: "Verified",
    tagline: "Verified — перевірений профіль",
    price: "449 ₴ / місяць",
    note: "Передоплата: 1, 3, 6 або 12 місяців",
    features: ["Усе з базового плану", "Розширений профіль", "Фото, послуги й ціни", "Базова аналітика дій"],
  },
  {
    name: "Promoted",
    tagline: "Promoted — більша помітність у звичайному пошуку",
    price: "За домовленістю",
    note: "Передоплата: 1 або 3 місяці",
    features: ["Усе з Verified", "Вища позиція у звичайному пошуку", "Завжди з позначкою «Промо»", "У термінових запитах не працює"],
  },
];

const STEPS = [
  ["Додайте заклад", "Коротка форма з контактами. Це безкоштовно."],
  ["Пройдіть модерацію", "Ми перевіряємо назву, адресу, категорію та джерела."],
  ["Оплатіть передоплату", "Виставляємо рахунок; після надходження коштів активуємо тариф на оплачений період."],
];

export default function ForPartnersPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-16">
      <section className="max-w-2xl">
        <p className="text-sm font-semibold text-brand">VetNear для партнерів</p>
        <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-ink sm:text-5xl">Станьте помітними саме тоді, коли власнику потрібна допомога</h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-ink/65">Додайте заклад до перевіреного каталогу Києва. Базовий профіль безкоштовний, а публікація відбувається після модерації.</p>
        <div className="mt-7 flex flex-wrap gap-2.5"><Link href="/add-place" className="btn btn-brand">Додати заклад</Link><a href="#paid" className="btn btn-ghost">Запит на Verified</a></div>
        <p className="mt-3 text-sm text-ink/45">Форма займає близько двох хвилин. Оплата не потрібна.</p>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-3" aria-label="Переваги VetNear">
        {VALUE.map(([title, description]) => (
          <article key={title} className="rounded-3xl border border-brand-100 bg-surface p-5 shadow-card">
            <span className="block h-1.5 w-9 rounded-full bg-brand" aria-hidden />
            <h2 className="mt-5 font-display text-lg font-bold text-ink">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">{description}</p>
          </article>
        ))}
      </section>

      <section id="pricing" className="mt-16">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold text-ink">Проста модель без прихованих умов</h2>
          <p className="mt-3 leading-7 text-ink/60">Базовий лістинг безкоштовний. Verified і Promoted — за передоплатою: після підтвердження оплати ми активуємо тариф. Онлайн-оплату ще підключаємо, тому поки що рахунок виставляємо вручну.</p>
        </div>
        <div className="mt-7 grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan, index) => (
            <article key={plan.name} className={`rounded-3xl border bg-surface p-6 ${index === 0 ? "border-brand-300 shadow-card" : "border-brand-100"}`}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-xl font-bold text-ink">{plan.name}</h3>
                {index === 0 && <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">Рекомендовано</span>}
              </div>
              <p className="mt-2 text-sm text-ink/60">{plan.tagline}</p>
              <p className="mt-4 text-2xl font-bold text-ink">{plan.price}</p>
              <p className="mt-1 text-sm text-ink/45">{plan.note}</p>
              <ul className="mt-6 space-y-3 text-sm text-ink/70">
                {plan.features.map((feature) => <li key={feature} className="flex gap-2"><span className="font-bold text-brand">✓</span><span>{feature}</span></li>)}
              </ul>
            </article>
          ))}
        </div>
        <p className="mt-4 rounded-2xl border border-emergency/15 bg-emergency-50 px-4 py-3 text-sm leading-6 text-emergency-700">
          <strong>У термінових запитах платне просування не працює.</strong> Жоден тариф не дає позначку 24/7 чи
          «термінова допомога» — її ми ставимо лише після телефонного підтвердження.
        </p>
        <p className="mt-3 text-sm leading-6 text-ink/55">
          Коли оплачений період закінчується, профіль повертається на базовий тариф — без автосписань.
          Для мереж із кількома філіями умови індивідуальні. Притулки та зоозахисні організації розміщуються безкоштовно.
        </p>
      </section>

      <section className="mt-16" aria-labelledby="steps-title">
        <h2 id="steps-title" className="font-display text-2xl font-bold text-ink">Як підключити Verified або Promoted за 3 кроки</h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-3">
          {STEPS.map(([title, text], index) => (
            <li key={title} className="rounded-3xl border border-brand-100 bg-surface p-5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-bold text-white">{index + 1}</span>
              <h3 className="mt-3 font-display text-lg font-bold text-ink">{title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-ink/60">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="paid" className="mt-8 grid gap-8 rounded-3xl border border-brand-100 bg-surface p-6 sm:p-8 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="text-sm font-semibold text-brand">Платні тарифи</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-ink">Запит на Verified або Promoted</h2>
          <p className="mt-3 text-sm leading-6 text-ink/60">
            Залиште контакт — ми звʼяжемось, щоб узгодити умови й виставити рахунок.
            Оплата передоплатою. Після підтвердження ми активуємо тариф.
          </p>
        </div>
        <PartnerInterestForm />
      </section>

      <section className="mt-8 grid gap-8 rounded-3xl border border-brand-100 bg-surface p-6 sm:p-8 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="text-sm font-semibold text-brand">Перевірка даних</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-ink">Довіра важливіша за кількість профілів</h2>
        </div>
        <ol className="space-y-5 text-sm leading-6 text-ink/65">
          <li><strong className="text-ink">1. Заявка.</strong> Ви надаєте основні контакти й опис послуг.</li>
          <li><strong className="text-ink">2. Модерація.</strong> VetNear перевіряє назву, адресу, категорію та джерела.</li>
          <li><strong className="text-ink">3. Публікація.</strong> Профіль зʼявляється з видимим статусом і датою перевірки.</li>
          <li><strong className="text-ink">4. Екстрені позначки.</strong> Статус 24/7 або невідкладної допомоги додається тільки після телефонного підтвердження.</li>
        </ol>
      </section>

      <SocialImpact className="mt-12 px-0" />

      <section className="mt-12 rounded-3xl bg-brand-900 px-6 py-8 text-white sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-8">
        <div><h2 className="font-display text-2xl font-bold">Додайте заклад до VetNear</h2><p className="mt-2 text-sm text-white/65">Почніть із базового профілю. Рішення про платні інструменти можна прийняти пізніше.</p></div>
        <Link href="/add-place" className="btn mt-5 shrink-0 bg-white text-brand-800 hover:bg-brand-50 sm:mt-0">Заповнити коротку форму</Link>
      </section>
    </main>
  );
}

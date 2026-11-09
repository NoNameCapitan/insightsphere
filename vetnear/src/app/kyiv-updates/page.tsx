import type { Metadata } from "next";
import Link from "next/link";
import {
  EMERGENCY_VERIFICATION_FIELDS,
  KYIV_INFO_ITEMS,
  KYIV_OPERATIONAL_UPDATES,
  KYIV_UPDATES_AS_OF,
  PARTNERSHIP_OPPORTUNITIES,
  type KyivUpdateStatus,
} from "@/lib/data/kyivUpdates";
import { EXTERNAL_LINK_PROPS } from "@/lib/security/url";

export const metadata: Metadata = {
  title: "Актуальні зміни ветсервісів Києва",
  description:
    "Перевірені зміни ветклінік, документів, адопції та екстреної маршрутизації у Києві.",
  alternates: { canonical: "/kyiv-updates" },
};

const STATUS_LABELS: Record<KyivUpdateStatus, string> = {
  confirmed: "Підтверджено офіційно",
  source_checked: "Перевірено за першоджерелом",
  needs_phone_check: "Потрібен контрольний дзвінок",
  coming_soon: "Ще не відкрито",
};

const INFO_LABELS = {
  event: "Подія",
  vaccination: "Вакцинація тварин",
  safety: "Безпека людей",
  campaign: "Допомога",
  service: "Сервіс",
} as const;

export default function KyivUpdatesPage() {
  return (
    <div className="container-px mx-auto max-w-4xl py-8">
      <div className="overflow-hidden rounded-3xl border border-brand-100 bg-surface shadow-card">
        <div className="border-b border-brand-100 bg-brand-50/70 p-5 sm:p-7">
          <p className="text-sm font-semibold text-brand">Оновлено {KYIV_UPDATES_AS_OF}</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-ink">
            Новини, події та зміни ветсервісів Києва
          </h1>
          <p className="mt-3 max-w-3xl text-ink/70">
            Операційні зміни, які впливають на маршрут власника тварини. Публічне джерело
            підтверджує адресу або заяву провайдера, але не замінює контрольний дзвінок.
          </p>
        </div>
        <div className="grid gap-px bg-brand-100 sm:grid-cols-3">
          <div className="bg-surface px-5 py-4"><strong className="block text-xl text-ink">Без розсилок</strong><span className="text-xs text-ink/55">інформація лише на сайті</span></div>
          <div className="bg-surface px-5 py-4"><strong className="block text-xl text-ink">Офіційні джерела</strong><span className="text-xs text-ink/55">посилання в кожній картці</span></div>
          <div className="bg-surface px-5 py-4"><strong className="block text-xl text-ink">Київ</strong><span className="text-xs text-ink/55">локальні маршрути й події</span></div>
        </div>
      </div>

      <section className="mt-8" aria-labelledby="news-events-heading">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-brand">Коротко й по суті</p>
            <h2 id="news-events-heading" className="mt-1 font-display text-2xl font-bold text-ink">Новини та події</h2>
          </div>
          <p className="text-xs text-ink/45">Перед поїздкою відкрийте джерело</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {KYIV_INFO_ITEMS.map((item) => (
            <article key={item.id} className="card p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-brand-50 px-2 py-1 font-semibold text-brand-700">{INFO_LABELS[item.kind]}</span>
                <span className="text-ink/50">{item.dateLabel}</span>
              </div>
              <h3 className="mt-3 font-display text-lg font-bold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink/70">{item.summary}</p>
              <a href={item.href} {...EXTERNAL_LINK_PROPS} className="mt-3 inline-block text-sm font-semibold text-brand underline decoration-brand/25 underline-offset-4 hover:decoration-brand">
                {item.linkLabel} ↗
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-emergency/25 bg-emergency-50 p-5">
        <p className="text-xs font-semibold text-emergency-700">Людину вкусила або подряпала тварина</p>
        <h2 className="mt-1 font-display text-xl font-bold text-ink">Не шукайте лише ветеринара</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/75">
          Промийте місце контакту водою з милом 10–15 хвилин і якнайшвидше зверніться до медичного закладу. Антирабічна допомога надається безоплатно, а потребу у вакцинації визначає лікар. Тварину маршрутизуйте до ветеринара окремо.
        </p>
        <a href="https://kyiv.cdc.gov.ua/article/ukus-podryapyna-chy-oslynennya-tvarynoyu-kudy-zvertatysya-u-kyyevi-za-antyrabichnoyu-dopomogoyu/" {...EXTERNAL_LINK_PROPS} className="btn btn-emergency mt-4 inline-flex py-2.5 text-sm">
          Пункти антирабічної допомоги
        </a>
      </section>

      <div className="mt-10 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-brand">Для каталогу VetNear</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink">Операційні зміни</h2>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {KYIV_OPERATIONAL_UPDATES.map((item) => (
          <article key={item.id} className="card p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-brand-50 px-2 py-1 font-semibold text-brand-700">
                {STATUS_LABELS[item.status]}
              </span>
              <time className="text-ink/50" dateTime={item.date}>{item.date}</time>
            </div>
            <h2 className="mt-3 font-display text-xl font-bold text-ink">{item.title}</h2>
            <p className="mt-1 text-sm font-medium text-ink/60">{item.area}</p>
            <p className="mt-3 text-sm leading-6 text-ink/75">{item.summary}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-ink/[0.035] p-3 text-sm text-ink/70">
                <span className="font-semibold text-ink">Чому це важливо: </span>{item.whyItMatters}
              </div>
              <div className="rounded-2xl bg-brand-50 p-3 text-sm text-brand-700">
                <span className="font-semibold">Дія: </span>{item.action}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {item.sources.map((source) => (
                <a key={source.url} href={source.url} {...EXTERNAL_LINK_PROPS} className="text-brand hover:underline">
                  {source.label} ↗
                </a>
              ))}
            </div>
          </article>
        ))}
      </div>

      <section className="mt-8 rounded-3xl border border-emergency/25 bg-emergency-50 p-5">
        <h2 className="font-display text-xl font-bold text-emergency-700">Перевірка термінового прийому</h2>
        <p className="mt-2 text-sm text-ink/70">
          Позначка 24/7 зʼявляється у VetNear лише після дзвінка. Для кожної клініки потрібно зафіксувати:
        </p>
        <ul className="mt-3 grid gap-2 text-sm text-ink/75 sm:grid-cols-2">
          {EMERGENCY_VERIFICATION_FIELDS.map((field) => <li key={field}>• {field}</li>)}
        </ul>
        <Link href="/emergency-vet-near-me" className="btn btn-brand mt-4 inline-flex">
          Терміновий маршрут
        </Link>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl font-bold text-ink">Партнерські можливості</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {PARTNERSHIP_OPPORTUNITIES.map((lead) => (
            <article key={lead.name} className="card p-4">
              <p className="text-xs font-semibold text-brand">{lead.timing}</p>
              <h3 className="mt-1 font-display font-bold text-ink">{lead.name}</h3>
              <p className="mt-2 text-sm text-ink/70">{lead.action}</p>
              <a href={lead.url} {...EXTERNAL_LINK_PROPS} className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
                Джерело ↗
              </a>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

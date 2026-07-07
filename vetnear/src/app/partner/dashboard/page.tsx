"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { Disclaimer } from "@/components/JsonLd";
import { DemoAdminBanner } from "@/components/DemoBanner";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/labels";
import { getSubmissions } from "@/lib/partners/store";
import type { PartnerSubmission } from "@/lib/types";

export default function PartnerDashboardPage() {
  const [subs, setSubs] = useState<PartnerSubmission[]>([]);
  useEffect(() => {
    track("partner_dashboard_opened");
    setSubs(getSubmissions());
  }, []);

  return (
    <div className="container-px mx-auto max-w-3xl py-6">
      <h1 className="font-display text-2xl font-extrabold text-ink">Кабінет партнера (демо)</h1>
      <p className="mt-1 text-ink/60">
        Демонстрація. У продакшені партнер бачитиме лише власні заклади після авторизації.
      </p>

      <div className="mt-4"><DemoAdminBanner /></div>

      <div className="mt-4 flex gap-2">
        <Link href="/add-place" className="btn btn-brand py-2 text-sm">+ Додати заклад</Link>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 font-display text-lg font-bold text-ink">Мої заявки</h2>
        {subs.length === 0 ? (
          <p className="text-sm text-ink/50">Заявок ще немає.</p>
        ) : (
          <ul className="divide-y divide-brand-100/70 rounded-2xl border border-brand-100 text-sm">
            {subs.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-ink/80">{s.name}</p>
                  <p className="text-ink/50">{CATEGORY_LABELS[s.category]}</p>
                </div>
                <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/60">
                  {STATUS_LABELS[s.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink">Показники профілю</h2>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber/30 bg-amber/10 px-2.5 py-1 text-[11px] font-semibold text-amber">
            <span aria-hidden>◇</span> демо-дані
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {([
            ["Перегляди профілю", "1 280"],
            ["Кліки «Зателефонувати»", "184"],
            ["Кліки «Маршрут»", "96"],
            ["Кліки на сайт", "73"],
            ["Збережено користувачами", "41"],
            ["Запити на послуги", "12"],
          ] as const).map(([label, val]) => (
            <div key={label} className="card px-3 py-3 text-center">
              <p className="text-lg font-bold text-ink">{val}</p>
              <p className="text-[11px] text-ink/50">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
          <div className="rounded-2xl border border-brand-100 px-3 py-2">
            <p className="text-[11px] text-ink/50">Оцінка конверсії</p>
            <p className="font-medium text-ink">≈ 23% → дзвінок/маршрут</p>
          </div>
          <div className="rounded-2xl border border-brand-100 px-3 py-2">
            <p className="text-[11px] text-ink/50">Статус перевірки</p>
            <p className="font-medium text-ink">Перевірено за публічними джерелами</p>
          </div>
          <div className="rounded-2xl border border-brand-100 px-3 py-2">
            <p className="text-[11px] text-ink/50">План</p>
            <p className="font-medium text-ink">Free (базовий)</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-ink/40">
          Показники демонстраційні. Реальна аналітика зʼявиться з планами Verified / Pro.
        </p>
      </section>

      <div className="mt-6">
        <Disclaimer text="Дані демо зберігаються у вашому браузері. Реальний кабінет потребуватиме авторизації та перевірки прав власника." />
      </div>
    </div>
  );
}

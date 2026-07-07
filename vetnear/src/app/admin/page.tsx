"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Disclaimer } from "@/components/JsonLd";
import { DemoAdminBanner } from "@/components/DemoBanner";
import { getEventHistory } from "@/lib/analytics";
import { getPlaces } from "@/lib/store";
import { getSubmissions } from "@/lib/partners/store";
import { getReports } from "@/lib/reports/store";
import { getRequests } from "@/lib/requests/store";
import type { AnalyticsEvent } from "@/lib/types";

export default function AdminPage() {
  const [counts, setCounts] = useState({ places: 0, submissions: 0, pending: 0, reports: 0, requests: 0 });
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);

  useEffect(() => {
    const subs = getSubmissions();
    setCounts({
      places: getPlaces().length,
      submissions: subs.length,
      pending: subs.filter((s) => s.status === "pending_review").length,
      reports: getReports().length,
      requests: getRequests().length,
    });
    setEvents(getEventHistory().slice(0, 20));
  }, []);

  const Stat = ({ label, value }: { label: string; value: number }) => (
    <div className="card p-4">
      <p className="text-2xl font-extrabold text-ink">{value}</p>
      <p className="text-sm text-ink/60">{label}</p>
    </div>
  );

  return (
    <div className="container-px mx-auto max-w-3xl py-6">
      <h1 className="font-display text-2xl font-extrabold text-ink">Адмін-демо</h1>
      <p className="mt-1 text-ink/60">Локальна демонстрація. Дані зберігаються у браузері.</p>

      <div className="mt-4"><DemoAdminBanner /></div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Заклади" value={counts.places} />
        <Stat label="Заявки" value={counts.submissions} />
        <Stat label="На модерації" value={counts.pending} />
        <Stat label="Скарги" value={counts.reports} />
        <Stat label="Запити послуг" value={counts.requests} />
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Link href="/admin/moderation" className="btn btn-brand justify-between">
          Модерація заявок
          {counts.pending > 0 && (
            <span className="rounded-full bg-white/25 px-2 text-sm">{counts.pending}</span>
          )}
        </Link>
        <Link href="/admin/moderation" className="btn btn-ghost justify-between">
          Скарги / оновлення
          {counts.reports > 0 && (
            <span className="rounded-full bg-brand-50 px-2 text-sm text-brand-700">{counts.reports}</span>
          )}
        </Link>
        <Link href="/admin/imports/google-places" className="btn btn-ghost">Імпорт Google Places</Link>
        <Link href="/admin/imports" className="btn btn-ghost">Імпорт товарів</Link>
      </div>

      <section className="mt-6 rounded-2xl border border-brand-100 bg-surface p-4">
        <h2 className="font-display text-sm font-bold text-ink">Статус системи</h2>
        <ul className="mt-2 space-y-1 text-sm text-ink/70">
          <li>
            Режим заявок:{" "}
            {process.env.NEXT_PUBLIC_BACKEND_ENABLED === "1" ? (
              <strong className="text-brand-700">сервер (Supabase) + локальна копія</strong>
            ) : (
              <strong>локальне демо (localStorage)</strong>
            )}
          </li>
          <li>
            Схвалені <strong>локальні</strong> заявки одразу зʼявляються у пошуку поруч.
          </li>
          <li className="text-ink/50">
            Наступний крок для production: публікація схвалених Supabase-заявок у
            публічний фід місць.
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-display text-lg font-bold text-ink">Події аналітики (останні)</h2>
        {events.length === 0 ? (
          <p className="text-sm text-ink/50">Подій ще немає — почніть користуватись застосунком.</p>
        ) : (
          <ul className="divide-y divide-brand-100/70 rounded-2xl border border-brand-100 text-sm">
            {events.map((e, i) => (
              <li key={i} className="flex justify-between px-4 py-2">
                <span className="font-medium text-ink/80">{e.name}</span>
                <span className="text-ink/50">{new Date(e.ts).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6">
        <Disclaimer text="Демонстраційна панель. У продакшені доступ обмежується ролями moderator/admin із серверною авторизацією." />
      </div>
    </div>
  );
}

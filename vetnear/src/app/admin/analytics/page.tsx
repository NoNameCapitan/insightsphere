"use client";
import Link from "next/link";
import { useState } from "react";
import { getAdminToken } from "@/lib/api/backendClient";
import type { summarizeMeasurement } from "@/lib/measurement/schema";
type Summary = ReturnType<typeof summarizeMeasurement> & { days: number; truncated: boolean; sampleSize: number; totalEvents: number | null; enabled: boolean; generatedAt: string };
const LABELS: Record<string, string> = { page_viewed: "Відкриття сторінок", nearby_search_started: "Початок пошуку", search_results_viewed: "Результати пошуку", place_profile_opened: "Перехід до профілю", place_profile_viewed: "Перегляд профілю", call_clicked: "Натискання телефону", route_clicked: "Натискання маршруту", website_clicked: "Перехід на сайт", place_saved: "Збереження закладу", pet_profile_created: "Створення картки тварини", care_event_created: "Запланована подія", calendar_exported: "Експорт календаря", add_place_started: "Початок додавання закладу", add_place_submitted: "Локально створена заявка" };
export default function AnalyticsPage() {
  const [days, setDays] = useState(7); const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function load() {
    setBusy(true); setError("");
    try {
      const token = getAdminToken(); if (!token) throw Error("Увійдіть із персональним токеном адміністратора в панелі модерації.");
      const res = await fetch(`/api/admin/analytics?days=${days}`, { headers: { "x-admin-token": token }, cache: "no-store" });
      if (!res.ok) throw Error(res.status === 401 ? "Потрібна роль адміністратора." : "Серверні дані недоступні. Перевірте підключення та міграцію 007.");
      setSummary(await res.json());
    } catch (e) { setSummary(null); setError(e instanceof Error ? e.message : "Не вдалося завантажити звіт."); }
    finally { setBusy(false); }
  }
  return <div className="operating-screen container-px mx-auto max-w-4xl py-8">
    <Link href="/admin" className="text-sm text-brand underline">До адміністративної панелі</Link>
    <h1 className="operating-heading mt-5">Як працює запуск</h1>
    <p className="mt-3 max-w-2xl text-ink/70">Знеособлені сесії та контактні дії. Натискання телефону не підтверджує дзвінок, запис або візит. Ці дані не використовуються для автоматичних списань.</p>
    <div className="my-6 flex flex-wrap items-center gap-3">
      <label htmlFor="measurement-period">Період</label><select id="measurement-period" className="input" value={days} onChange={e => setDays(Number(e.target.value))}><option value={7}>7 днів</option><option value={28}>28 днів</option><option value={90}>90 днів</option></select>
      <button className="btn btn-brand" onClick={load} disabled={busy}>{busy ? "Завантажуємо…" : "Показати звіт"}</button>
    </div>
    {error && <p role="alert" className="mb-5 text-emergency">{error} <Link href="/admin/moderation" className="underline">Відкрити модерацію</Link></p>}
    {!summary && !busy && !error && <p className="care-surface p-6">Звіт завантажується лише після авторизації. Показники не підміняються демонстраційними числами.</p>}
    {summary && <>
      {!summary.enabled && <p className="mb-4 text-ink/70">Збір нових подій вимкнений. Нижче — лише раніше збережені події.</p>}
      {summary.truncated && <p role="status" className="mb-4 font-semibold text-emergency">Частковий звіт: показано останні {summary.sampleSize} подій{summary.totalEvents !== null ? ` із ${summary.totalEvents}` : ""}. Для повного періоду потрібна серверна агрегація.</p>}
      <dl className="grid gap-5 border-y border-ink/10 py-6 sm:grid-cols-3">
        <div><dt className="text-sm text-ink/70">Сесії з виміряною дією</dt><dd className="mt-2 text-3xl font-bold tabular-nums">{summary.sessions}</dd></div>
        <div><dt className="text-sm text-ink/70">Сесії з контактною дією</dt><dd className="mt-2 text-3xl font-bold tabular-nums">{summary.contactSessions}</dd></div>
        <div><dt className="text-sm text-ink/70">Порожні результати / усі покази</dt><dd className="mt-2 text-3xl font-bold tabular-nums">{summary.emptyResults} / {summary.results}</dd></div>
      </dl>
      <h2 className="mt-8 text-xl font-bold">Дії у сервісі</h2>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-ink/10"><th className="py-3">Дія</th><th className="py-3 text-right">Події</th><th className="py-3 text-right">Сесії</th></tr></thead><tbody>{Object.entries(summary.events).map(([name, value]) => <tr key={name} className="border-b border-ink/10"><th className="py-3 pr-3 font-medium">{LABELS[name] ?? name}</th><td className="text-right tabular-nums">{value.events}</td><td className="text-right tabular-nums">{value.sessions}</td></tr>)}</tbody></table></div>
      {!Object.keys(summary.events).length && <p className="mt-3">У цьому періоді немає збережених подій.</p>}
      <h2 className="mt-8 text-xl font-bold">Кампанії</h2>
      <ul className="mt-3 divide-y divide-ink/10">{summary.campaigns.map(c => <li key={c.campaign} className="flex flex-wrap justify-between gap-3 py-3"><span>{c.campaign}</span><span>{c.sessions} сесій · {c.contactSessions} із контактом</span></li>)}</ul>
      <p className="mt-5 text-sm text-ink/70">Ідентифікатор змінюється щодня, а сесія завершується після 30 хвилин бездіяльності. Звіт не вимірює унікальних людей або повернення між днями. Час звіту: {new Date(summary.generatedAt).toLocaleString("uk-UA")}.</p>
    </>}
  </div>;
}

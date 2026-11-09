"use client";
// Admin → Leads (v1.9). The commercial view: how many real outbound actions a
// listing produced, and the control that puts it on a paid tier.
//
// These are server-recorded counts from /api/partner/leads, not demo numbers.
// When the backend is off the endpoint answers 503 and this page says so
// plainly rather than inventing a chart.
import Link from "next/link";
import { useState } from "react";
import { DemoAdminBanner } from "@/components/DemoBanner";
import { fetchLeadSummary, setPlaceTier } from "@/lib/api/backendClient";
import { BILLABLE_LEAD_TYPES } from "@/lib/places/leads";
import { TIER_LABELS } from "@/lib/places/tier";
import type { LeadEventType, LeadSummary, PlaceTier } from "@/lib/types";

const TYPE_LABELS: Record<LeadEventType, string> = {
  call: "Дзвінки",
  route: "Маршрути",
  website: "Переходи на сайт",
  social: "Соцмережі",
  request: "Запити послуги",
  detail_view: "Перегляди картки",
};

const TIERS: PlaceTier[] = ["free", "verified", "promoted"];

export default function AdminLeadsPage() {
  const [placeId, setPlaceId] = useState("");
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<LeadSummary | null>(null);
  const [billable, setBillable] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tier, setTier] = useState<PlaceTier>("free");
  const [promoDays, setPromoDays] = useState(30);
  const [tierMsg, setTierMsg] = useState<string | null>(null);

  const load = async () => {
    if (!placeId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetchLeadSummary(placeId.trim(), days);
      setSummary(res.summary);
      setBillable(res.billableLeads);
    } catch (e) {
      setSummary(null);
      setError(
        e instanceof Error && e.message === "unauthorized"
          ? "Потрібен дійсний токен модератора (введіть його в панелі модерації)."
          : "Бекенд вимкнено або сталася помилка читання.",
      );
    } finally {
      setBusy(false);
    }
  };

  const applyTier = async () => {
    if (!placeId.trim()) return;
    setBusy(true);
    setTierMsg(null);
    try {
      const res = await setPlaceTier(
        placeId.trim(),
        tier,
        tier === "promoted" ? promoDays : undefined,
      );
      setTierMsg(
        res.promotedUntil
          ? `Промо активне до ${new Date(res.promotedUntil).toLocaleDateString("uk-UA")}`
          : `Тариф змінено: ${TIER_LABELS[tier]}`,
      );
    } catch {
      setTierMsg("Не вдалося змінити тариф (потрібна роль admin).");
    } finally {
      setBusy(false);
    }
  };

  const maxDaily = summary
    ? Math.max(1, ...summary.daily.map((d) => d.count))
    : 1;

  return (
    <div className="container-px mx-auto max-w-3xl py-6">
      <h1 className="font-display text-2xl font-extrabold text-ink">Ліди та тарифи</h1>
      <p className="mt-1 text-ink/60">
        Реальні дії користувачів по картці закладу. Перегляди не є лідом —
        оплачуються лише дзвінки, маршрути та запити послуги.
      </p>

      <div className="mt-4">
        <DemoAdminBanner />
      </div>

      <section className="mt-6 rounded-2xl border border-brand-100 p-4">
        <label className="block text-sm font-medium text-ink/80" htmlFor="placeId">
          ID закладу
        </label>
        <input
          id="placeId"
          value={placeId}
          onChange={(e) => setPlaceId(e.target.value)}
          placeholder="напр. alden-vet-pozniaky-1"
          className="mt-1 w-full rounded-xl border border-brand-100 px-3 py-2 text-sm"
        />
        <div className="mt-3 flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-xl border border-brand-100 px-3 py-2 text-sm"
          >
            <option value={7}>7 днів</option>
            <option value={30}>30 днів</option>
            <option value={90}>90 днів</option>
          </select>
          <button
            onClick={load}
            disabled={busy || !placeId.trim()}
            className="btn btn-brand py-2 text-sm disabled:opacity-50"
          >
            Показати ліди
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-emergency">{error}</p>}
      </section>

      {summary && (
        <section className="mt-4 rounded-2xl border border-brand-100 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-bold text-ink">
              {summary.total} дій за {summary.rangeDays} дн.
            </h2>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
              {billable} оплачуваних лідів
            </span>
          </div>

          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {(Object.keys(TYPE_LABELS) as LeadEventType[]).map((t) => (
              <li
                key={t}
                className="flex items-center justify-between rounded-xl bg-ink/[0.03] px-3 py-2"
              >
                <span className="text-ink/70">
                  {TYPE_LABELS[t]}
                  {BILLABLE_LEAD_TYPES.includes(t) && (
                    <span className="ml-1 text-[11px] text-brand-700">₴</span>
                  )}
                </span>
                <span className="font-semibold text-ink">{summary.totals[t]}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex h-20 items-end gap-[2px]" aria-hidden>
            {summary.daily.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${d.count}`}
                style={{ height: `${Math.round((d.count / maxDaily) * 100)}%` }}
                className="min-h-[2px] flex-1 rounded-t bg-brand/60"
              />
            ))}
          </div>
          <p className="mt-1 text-[11px] text-ink/45">
            Ліди за днями. Дані знеособлені: IP та user-agent не зберігаються.
          </p>
        </section>
      )}

      <section className="mt-4 rounded-2xl border border-brand-100 p-4">
        <h2 className="font-display text-lg font-bold text-ink">Комерційний тариф</h2>
        <p className="mt-1 text-sm text-ink/60">
          Промо дає невелике підняття в списку, завжди позначається міткою «Промо»
          і не діє в термінових запитах.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as PlaceTier)}
            className="rounded-xl border border-brand-100 px-3 py-2 text-sm"
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {TIER_LABELS[t]}
              </option>
            ))}
          </select>
          {tier === "promoted" && (
            <input
              type="number"
              min={1}
              max={365}
              value={promoDays}
              onChange={(e) => setPromoDays(Number(e.target.value))}
              className="w-24 rounded-xl border border-brand-100 px-3 py-2 text-sm"
              aria-label="Днів промо"
            />
          )}
          <button
            onClick={applyTier}
            disabled={busy || !placeId.trim()}
            className="btn btn-ghost py-2 text-sm disabled:opacity-50"
          >
            Застосувати
          </button>
        </div>
        {tierMsg && <p className="mt-2 text-sm text-brand">{tierMsg}</p>}
      </section>

      <Link href="/admin" className="btn btn-ghost mt-6 py-2 text-sm">
        ← До адмінпанелі
      </Link>
    </div>
  );
}

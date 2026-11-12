"use client";
// Admin → Leads (v1.9). The commercial view: how many real outbound actions a
// listing produced, and the control that puts it on a paid tier.
//
// These are server-recorded counts from /api/partner/leads, not demo numbers.
// When the backend is off the endpoint answers 503 and this page says so
// plainly rather than inventing a chart.
import Link from "next/link";
import { useState } from "react";
import { AdminBillingPanel } from "@/components/admin/AdminBillingPanel";
import { DemoAdminBanner } from "@/components/DemoBanner";
import { fetchLeadSummary, fetchPartnerInterest, setPartnerInterestStatus, setPlaceTier, type PartnerInterestItem } from "@/lib/api/backendClient";
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
const INTEREST_STATUS: Record<string, string> = { new: "новий", contacted: "звʼязались", won: "підключено", lost: "відмова" };

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
  const [interest, setInterest] = useState<PartnerInterestItem[] | null>(null);
  const [interestError, setInterestError] = useState<string | null>(null);

  const loadInterest = async () => {
    setInterestError(null);
    try {
      setInterest(await fetchPartnerInterest());
    } catch (e) {
      setInterest(null);
      setInterestError(e instanceof Error && e.message === "unauthorized" ? "Потрібен токен адміністратора." : "Не вдалося завантажити запити.");
    }
  };

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
        <h2 className="font-display text-lg font-bold text-ink">Тариф вручну (без оплати)</h2>
        <p className="mt-1 text-sm text-ink/60">
          Щоб зняти тариф або виправити помилку. Оплачений період вмикайте блоком «Передоплата» нижче.{" "}
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

      <AdminBillingPanel placeId={placeId} />

      <section className="mt-4 rounded-2xl border border-brand-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-ink">Запити на платні тарифи{interest ? ` · нових: ${interest.filter((i) => i.status === "new").length}` : ""}</h2>
          <button onClick={() => { void loadInterest(); }} className="btn btn-ghost py-2 text-sm">Завантажити</button>
        </div>
        <p className="mt-1 text-sm text-ink/60">
          Заявки з форми на сторінці «Партнерам». Оплата поки вручну: звʼяжіться, узгодьте умови, потім поставте тариф вище.
        </p>
        {interestError && <p className="mt-2 text-sm text-emergency-700">{interestError}</p>}
        {interest && interest.length === 0 && <p className="mt-2 text-sm text-ink/50">Запитів поки немає.</p>}
        {interest && interest.length > 0 && (
          <ul className="mt-3 divide-y divide-brand-100 text-sm">
            {interest.map((item) => (
              <li key={item.id} className="py-2.5">
                <p className="font-semibold text-ink">{item.place_name} <span className="ml-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">{item.plan}</span></p>
                <p className="mt-0.5 text-ink/65">
                  <a href={`tel:${item.phone}`} className="text-brand hover:underline">{item.phone}</a> ·{" "}
                  <a href={`mailto:${item.email}`} className="text-brand hover:underline">{item.email}</a>
                </p>
                <p className="text-xs text-ink/45">{new Date(item.created_at).toLocaleString("uk-UA")} · статус: {INTEREST_STATUS[item.status] ?? item.status}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(["contacted", "won", "lost"] as const).filter((st) => st !== item.status).map((st) => (
                    <button
                      key={st}
                      onClick={() => { void setPartnerInterestStatus(item.id, st).then(loadInterest).catch(() => setInterestError("Не вдалося змінити статус.")); }}
                      className="rounded-full border border-brand-100 px-2.5 py-1 text-xs font-medium text-ink/65 hover:border-brand-300 hover:text-brand-700"
                    >
                      {INTEREST_STATUS[st]}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/admin" className="btn btn-ghost mt-6 py-2 text-sm">
        ← До адмінпанелі
      </Link>
    </div>
  );
}

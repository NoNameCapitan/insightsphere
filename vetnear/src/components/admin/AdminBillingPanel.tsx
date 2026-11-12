"use client";

import { useState } from "react";
import {
  activatePrepaidPlan,
  expirePrepaidPlans,
  fetchBillingOverview,
  type BillingOverview,
} from "@/lib/api/backendClient";
import { BILLING_PLANS, getBillingPlan } from "@/lib/billing/plans";
import { TIER_LABELS } from "@/lib/places/tier";
import type { PlaceTier } from "@/lib/types";

const date = (value: string | null | undefined) =>
  value ? new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "—";
const REASON: Record<string, string> = { admin: "вручну", payment: "оплата", expired: "період завершився" };
const input = "rounded-xl border border-brand-100 px-3 py-2 text-sm";

/**
 * Prepaid operations for one place: record a received payment (which switches
 * the plan on for its period), see the current plan and history, and review
 * plans that end soon. Online payments are not connected — this is the path.
 */
export function AdminBillingPanel({ placeId }: { placeId: string }) {
  const [planCode, setPlanCode] = useState(BILLING_PLANS[0].code);
  const [amount, setAmount] = useState(String(BILLING_PLANS[0].listPriceUah ?? ""));
  const [paymentRef, setPaymentRef] = useState("");
  const [note, setNote] = useState("");
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const fail = (e: unknown, fallback: string) =>
    setMessage({ kind: "error", text: e instanceof Error && e.message === "unauthorized" ? "Потрібен токен адміністратора." : e instanceof Error && e.message.startsWith("msg:") ? e.message.slice(4) : fallback });

  const load = async () => {
    setBusy(true);
    try {
      setOverview(await fetchBillingOverview(placeId.trim()));
    } catch (e) {
      fail(e, "Не вдалося завантажити дані. Перевірте, що міграцію 007 застосовано.");
    } finally {
      setBusy(false);
    }
  };

  const choosePlan = (code: string) => {
    setPlanCode(code);
    const price = getBillingPlan(code)?.listPriceUah;
    setAmount(price != null ? String(price) : "");
  };

  const activate = async () => {
    const plan = getBillingPlan(planCode);
    if (!placeId.trim() || !plan) return;
    if (amount.trim() === "") { setMessage({ kind: "error", text: "Вкажіть суму, яку отримано." }); return; }
    if (!window.confirm(`Позначити оплату ${amount} ₴ отриманою й активувати «${plan.label}» для ${placeId.trim()}?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await activatePrepaidPlan({ placeId: placeId.trim(), planCode, amountUah: amount, paymentRef, note });
      setMessage({
        kind: "ok",
        text: result.duplicate
          ? `Цю оплату вже було враховано раніше — нічого не змінено. Тариф діє до ${date(result.periodEnd)}.`
          : `Активовано: ${plan.label}. Діє до ${date(result.periodEnd)}.`,
      });
      setPaymentRef("");
      setNote("");
      await load();
    } catch (e) {
      fail(e, "Не вдалося активувати тариф.");
    } finally {
      setBusy(false);
    }
  };

  const expire = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await expirePrepaidPlans();
      setMessage({ kind: "ok", text: `Завершено прострочених тарифів: ${result.expired}.` });
      await load();
    } catch (e) {
      fail(e, "Не вдалося завершити прострочені тарифи.");
    } finally {
      setBusy(false);
    }
  };

  const place = overview?.place;

  return (
    <section className="mt-4 rounded-2xl border border-brand-100 p-4">
      <h2 className="font-display text-lg font-bold text-ink">Передоплата</h2>
      <p className="mt-1 text-sm text-ink/60">
        Онлайн-оплату ще не підключено. Коли гроші надійшли на рахунок, позначте оплату тут — тариф увімкнеться
        на оплачений період і сам вимкнеться після його завершення.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium text-ink/60">
          План
          <select value={planCode} onChange={(e) => choosePlan(e.target.value)} className={`${input} mt-1 block w-full`}>
            {BILLING_PLANS.map((plan) => (
              <option key={plan.code} value={plan.code}>{plan.label}{plan.listPriceUah != null ? ` — ${plan.listPriceUah} ₴` : " — за домовленістю"}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-ink/60">
          Отримано, ₴
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={`${input} mt-1 block w-full`} placeholder="449" />
        </label>
        <label className="text-xs font-medium text-ink/60">
          Номер рахунку / платежу
          <input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} className={`${input} mt-1 block w-full`} placeholder="INV-2026-014" />
        </label>
        <label className="text-xs font-medium text-ink/60">
          Нотатка
          <input value={note} onChange={(e) => setNote(e.target.value)} className={`${input} mt-1 block w-full`} placeholder="необовʼязково" />
        </label>
      </div>
      <p className="mt-1.5 text-[11px] text-ink/45">Із номером платежу повторне натискання нічого не змінить — та сама оплата не зарахується двічі.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => { void activate(); }} disabled={busy || !placeId.trim()} className="btn btn-brand py-2 text-sm disabled:opacity-50">
          Оплату отримано — активувати
        </button>
        <button onClick={() => { void load(); }} disabled={busy} className="btn btn-ghost py-2 text-sm">Стан та історія</button>
        <button onClick={() => { void expire(); }} disabled={busy} className="btn btn-ghost py-2 text-sm">Завершити прострочені</button>
      </div>
      {message && <p role="status" className={`mt-2 text-sm ${message.kind === "ok" ? "text-brand-700" : "text-emergency-700"}`}>{message.text}</p>}

      {overview && (
        <div className="mt-4 space-y-4 text-sm">
          {placeId.trim() && (
            <div>
              <h3 className="font-semibold text-ink">Поточний стан</h3>
              {place ? (
                <p className="mt-1 text-ink/70">
                  {TIER_LABELS[(place.tier as PlaceTier) ?? "free"] ?? place.tier}
                  {place.billing_plan_code ? ` · ${getBillingPlan(place.billing_plan_code)?.label ?? place.billing_plan_code}` : ""}
                  {" · "}оплачено до: <strong className="text-ink">{date(place.prepaid_until)}</strong>
                  {place.tier === "promoted" ? ` · промо до: ${date(place.promoted_until)}` : ""}
                  {" · "}статус: {place.subscription_status}
                </p>
              ) : (
                <p className="mt-1 text-ink/50">Такого опублікованого закладу немає.</p>
              )}
            </div>
          )}

          {overview.payments.length > 0 && (
            <div>
              <h3 className="font-semibold text-ink">Оплати</h3>
              <ul className="mt-1 divide-y divide-brand-100">
                {overview.payments.map((p) => (
                  <li key={p.id} className="py-1.5 text-ink/70">
                    {date(p.created_at)} · <strong className="text-ink">{p.amount_uah} ₴</strong> · {getBillingPlan(p.plan_code)?.label ?? p.plan_code} · до {date(p.period_end)}
                    {p.provider_payment_id ? ` · № ${p.provider_payment_id}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {overview.events.length > 0 && (
            <div>
              <h3 className="font-semibold text-ink">Історія тарифу</h3>
              <ul className="mt-1 divide-y divide-brand-100">
                {overview.events.map((e) => (
                  <li key={e.id} className="py-1.5 text-ink/70">
                    {date(e.created_at)} · {e.from_tier ?? "—"} → <strong className="text-ink">{e.to_tier}</strong> · {REASON[e.reason] ?? e.reason}
                    {e.note ? ` · ${e.note}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="font-semibold text-ink">Закінчуються за {overview.days} днів</h3>
            {overview.expiring.length === 0 ? (
              <p className="mt-1 text-ink/50">Немає тарифів, що скоро закінчуються.</p>
            ) : (
              <ul className="mt-1 divide-y divide-brand-100">
                {overview.expiring.map((p) => (
                  <li key={p.id} className="py-1.5 text-ink/70">
                    <strong className="text-ink">{p.id}</strong> · {p.tier} · до {date(p.prepaid_until)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

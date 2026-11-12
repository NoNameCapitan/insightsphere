"use client";

import { useState } from "react";

const PLANS = [
  { id: "verified", label: "Verified" },
  { id: "promoted", label: "Promoted" },
  { id: "network", label: "Для мережі" },
] as const;

const field = "w-full rounded-2xl border border-brand-100 bg-white px-3.5 py-3 text-ink outline-none placeholder:text-ink/30 focus:border-brand focus:ring-2 focus:ring-brand/10";
const label = "mb-1.5 block text-sm font-medium text-ink/70";

/** "I want Verified / Promoted": leaves a contact; a person calls back. */
export function PartnerInterestForm() {
  const [placeName, setPlaceName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<(typeof PLANS)[number]["id"]>("verified");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setState("sending");
    const res = await fetch("/api/partner-interest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ placeName, phone, email, plan }),
    }).catch(() => null);
    if (res?.ok) { setState("sent"); return; }
    setState("idle");
    setError(
      res?.status === 422 ? "Перевірте назву, телефон і пошту."
        : res?.status === 429 ? "Забагато запитів. Спробуйте за кілька хвилин."
          : "Не вдалося надіслати запит. Спробуйте ще раз трохи пізніше.",
    );
  };

  if (state === "sent") {
    return (
      <p role="status" className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-4 text-sm leading-6 text-brand-800">
        Запит отримано. Ми звʼяжемось для рахунку протягом двох робочих днів — зателефонуємо або напишемо на пошту.
        Якщо заклад ще не додано, додайте його зараз: модерація йде паралельно.
      </p>
    );
  }

  return (
    <form onSubmit={(event) => { void submit(event); }} className="space-y-4">
      <div>
        <span className={label}>Який тариф цікавить</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Тариф">
          {PLANS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={plan === item.id}
              onClick={() => setPlan(item.id)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${plan === item.id ? "border-brand bg-brand text-white" : "border-brand-100 bg-white text-ink/70 hover:border-brand-300"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={label} htmlFor="interest-name">Назва закладу</label>
        <input id="interest-name" required minLength={2} maxLength={120} className={field} value={placeName} onChange={(e) => setPlaceName(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="interest-phone">Телефон</label>
          <input id="interest-phone" type="tel" inputMode="tel" autoComplete="tel" required className={field} placeholder="+380…" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="interest-email">Пошта</label>
          <input id="interest-email" type="email" autoComplete="email" required className={field} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      {error && <p role="alert" className="rounded-2xl border border-emergency/15 bg-emergency-50 px-4 py-3 text-sm text-emergency-700">{error}</p>}
      <button type="submit" disabled={state === "sending"} className="btn btn-brand w-full sm:w-auto">
        {state === "sending" ? "Надсилаємо…" : "Надіслати запит"}
      </button>
      <p className="text-xs leading-5 text-ink/45">Запит ні до чого не зобовʼязує й нічого не змінює в профілі. Оплата передоплатою за рахунком.</p>
    </form>
  );
}

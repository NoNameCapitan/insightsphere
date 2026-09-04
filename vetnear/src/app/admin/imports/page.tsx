"use client";

import Link from "next/link";
import { useState } from "react";
import { Disclaimer } from "@/components/JsonLd";

// Mock import history (Module 6). Real parsing/sync is documented in the README.
const MOCK_HISTORY = [
  { id: "imp-1", file: "petfood_feed.csv", rows: 240, accepted: 233, rejected: 7, status: "imported", when: "2 дні тому" },
  { id: "imp-2", file: "pharmacy_otc.xlsx", rows: 88, accepted: 88, rejected: 0, status: "imported", when: "5 днів тому" },
  { id: "imp-3", file: "accessories.zip", rows: 0, accepted: 0, rejected: 0, status: "failed", when: "минулого тижня" },
];

export default function ImportsPage() {
  const [picked, setPicked] = useState<string | null>(null);
  const [validated, setValidated] = useState(false);

  return (
    <div className="container-px mx-auto max-w-3xl py-6">
      <Link href="/admin" className="text-sm text-brand hover:underline">← Адмін</Link>
      <h1 className="mt-2 font-display text-2xl font-extrabold text-ink">Імпорт товарів</h1>
      <p className="mt-1 text-ink/60">
        Завантаження прайсів CSV / XLSX / ZIP. Демо-інтерфейс — фактична синхронізація
        описана в README (майбутній модуль).
      </p>

      <Link
        href="/admin/imports/google-places"
        className="mt-4 flex items-center justify-between rounded-2xl border border-brand-100 bg-brand-50/40 px-4 py-3 hover:bg-brand-50"
      >
        <span>
          <span className="block font-semibold text-ink">Перевірка імпорту Google Places →</span>
          <span className="block text-sm text-ink/60">
            Зовнішні кандидати (needs_review) — ручна перевірка перед публікацією.
          </span>
        </span>
      </Link>

      <div className="mt-5 rounded-3xl border border-dashed border-brand-100 p-6 text-center">
        <input
          id="file"
          type="file"
          accept=".csv,.xlsx,.zip"
          className="hidden"
          onChange={(e) => {
            setPicked(e.target.files?.[0]?.name ?? null);
            setValidated(false);
          }}
        />
        <label htmlFor="file" className="btn btn-brand cursor-pointer">Вибрати файл</label>
        {picked && <p className="mt-3 text-sm text-ink/70">Обрано: {picked}</p>}
        {picked && !validated && (
          <button className="btn btn-ghost mt-3" onClick={() => setValidated(true)}>
            Перевірити (демо)
          </button>
        )}
        {validated && (
          <div className="mt-3 rounded-2xl bg-brand-50 p-3 text-sm text-brand-700">
            Демо-валідація: знайдено 124 рядки, 119 коректних, 5 з попередженнями.
            Імпорт у цій демо-версії не виконується.
          </div>
        )}
      </div>

      <section className="mt-8">
        <h2 className="mb-2 font-display text-lg font-bold text-ink">Історія імпортів (демо)</h2>
        <ul className="divide-y divide-brand-100/70 rounded-2xl border border-brand-100 text-sm">
          {MOCK_HISTORY.map((h) => (
            <li key={h.id} className="flex items-center justify-between px-4 py-2">
              <span className="text-ink/80">{h.file}</span>
              <span className="text-ink/60">
                {h.status === "failed" ? "помилка" : `${h.accepted}/${h.rows}`} · {h.when}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6">
        <Disclaimer text="Завантаження файлів у проді обмежується типом і розміром, скануються на сервері, парсинг виконується в черзі. Див. SECURITY.md." />
      </div>
    </div>
  );
}

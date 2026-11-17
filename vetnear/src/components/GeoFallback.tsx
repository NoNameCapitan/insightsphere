"use client";

import { useEffect, useId, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { isValidCoordinates } from "@/lib/geo/coordinates";
import { COVERAGE_LABEL } from "@/config/coverage";
import type { Coordinates } from "@/lib/types";

// Explicit offline choices. A failed address lookup must never choose one for the user.
const CITY_PRESETS: { label: string; coords: Coordinates }[] = [
  { label: "Київ — центр", coords: { latitude: 50.4501, longitude: 30.5234 } },
  { label: "Київ — Поділ", coords: { latitude: 50.4659, longitude: 30.5167 } },
  { label: "Київ — Печерськ", coords: { latitude: 50.4275, longitude: 30.5385 } },
  { label: "Київ — Оболонь", coords: { latitude: 50.5012, longitude: 30.4985 } },
  { label: "Київ — Позняки", coords: { latitude: 50.4047, longitude: 30.6286 } },
];
type LocationResult = { label: string; coords: Coordinates };

function locationResults(value: unknown): LocationResult[] {
  if (!Array.isArray(value)) throw new Error("invalid-response");
  const results: LocationResult[] = [];
  for (const item of value.slice(0, 5)) {
    if (!item || typeof item !== "object") continue;
    const number = (v: unknown) => typeof v === "number" ? v
      : typeof v === "string" && v.trim() ? Number(v) : NaN;
    const coords = { latitude: number(item.lat), longitude: number(item.lon) };
    if (!isValidCoordinates(coords) || typeof item.display_name !== "string" || !item.display_name.trim()) continue;
    const label = item.display_name.trim().slice(0, 400);
    if (!results.some((r) => r.coords.latitude === coords.latitude && r.coords.longitude === coords.longitude)) {
      results.push({ label, coords });
    }
  }
  if (value.length && !results.length) throw new Error("invalid-response");
  return results;
}

export function GeoFallback({
  onResolved,
  compact = false,
}: {
  onResolved: (coords: Coordinates) => void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const currentRequest = useRef<AbortController | null>(null);
  const id = useId();

  useEffect(() => () => {
    currentRequest.current?.abort();
    currentRequest.current = null;
  }, []);

  function stopSearch() {
    currentRequest.current?.abort();
    currentRequest.current = null;
    setBusy(false);
  }

  function choose(result: LocationResult) {
    stopSearch();
    setResults([]);
    setError(null);
    setSelected(result.label);
    onResolved(result.coords);
  }

  async function search() {
    if (!query.trim() || currentRequest.current) return;
    const controller = new AbortController();
    currentRequest.current = controller;
    setBusy(true);
    setError(null);
    setResults([]);
    setSelected(null);
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const params = new URLSearchParams({ format: "json", limit: "5", q: query.trim() });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { Accept: "application/json" }, signal: controller.signal,
      });
      if (!res.ok) throw new Error("lookup-failed");
      const found = locationResults(await res.json());
      if (currentRequest.current !== controller || controller.signal.aborted) return;
      setResults(found);
      if (!found.length) setError("Адресу не знайдено. Додайте назву населеного пункту, область або вулицю та спробуйте ще раз.");
    } catch {
      if (currentRequest.current === controller) {
        setError(controller.signal.aborted
          ? "Пошук триває надто довго. Спробуйте ще раз або оберіть точку нижче."
          : "Не вдалося перевірити адресу. Перевірте з’єднання та спробуйте ще раз або оберіть точку нижче.");
      }
    } finally {
      window.clearTimeout(timeout);
      if (currentRequest.current === controller) {
        currentRequest.current = null;
        setBusy(false);
      }
    }
  }

  return (
    <div className={compact ? "" : "card p-4"}>
      {!compact && <h3 className="mb-2 text-base font-bold">{t.nearby.manualTitle}</h3>}
      <form onSubmit={(event) => { event.preventDefault(); void search(); }} className="flex gap-2" aria-busy={busy}>
        <input
          value={query}
          onChange={(event) => {
            stopSearch();
            setQuery(event.target.value);
            setResults([]);
            setError(null);
            setSelected(null);
          }}
          placeholder={t.nearby.manualPlaceholder}
          className="min-w-0 flex-1 rounded-xl border border-brand-100 bg-surface px-3 py-2.5 text-sm"
          aria-label={t.nearby.manualTitle}
          aria-describedby={`${id}-coverage${error ? ` ${id}-error` : ""}`}
          aria-invalid={error ? true : undefined}
          maxLength={240}
          autoComplete="off"
        />
        <button type="submit" disabled={busy || !query.trim()} className="btn-brand px-4 py-2.5 text-sm">
          {busy ? "Шукаємо…" : t.nearby.manualApply}
        </button>
      </form>
      {error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm leading-5 text-emergency-700">{error}</p>}
      <div role="status" aria-live="polite" className="mt-2 text-sm text-ink/75">
        {results.length > 0 ? "Оберіть потрібну адресу зі списку:" : selected ? `Обрана точка: ${selected}` : busy ? "Перевіряємо адресу…" : null}
      </div>
      {results.length > 0 && (
        <ul className="mt-2 space-y-1.5" aria-label="Знайдені адреси">
          {results.map((result) => (
            <li key={`${result.coords.latitude}:${result.coords.longitude}`}>
              <button type="button" onClick={() => choose(result)} className="min-h-11 w-full rounded-xl border border-brand-100 bg-white px-3 py-3 text-left text-sm leading-5 text-ink hover:bg-brand-50">
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p id={`${id}-coverage`} className="mt-3 text-xs leading-5 text-ink/65">Каталог: {COVERAGE_LABEL}. Адреса може бути в місті або селі; оберіть точний результат. Нижче — швидкі точки Києва:</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {CITY_PRESETS.map((result) => (
          <button type="button" key={result.label} onClick={() => choose(result)} className="chip-off min-h-11 text-xs">
            {result.label}
          </button>
        ))}
      </div>
    </div>
  );
}

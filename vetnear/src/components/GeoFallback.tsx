"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import type { Coordinates } from "@/lib/types";

// Offline-safe city presets (no API key needed). Free-text optionally
// resolves via OpenStreetMap Nominatim at runtime; falls back to Kyiv.
const CITY_PRESETS: { label: string; coords: Coordinates }[] = [
  { label: "Київ — центр", coords: { latitude: 50.4501, longitude: 30.5234 } },
  { label: "Київ — Поділ", coords: { latitude: 50.4659, longitude: 30.5167 } },
  { label: "Київ — Печерськ", coords: { latitude: 50.4275, longitude: 30.5385 } },
  { label: "Київ — Оболонь", coords: { latitude: 50.5012, longitude: 30.4985 } },
  { label: "Київ — Позняки", coords: { latitude: 50.4047, longitude: 30.6286 } },
];

export function GeoFallback({
  onResolved,
  compact = false,
}: {
  onResolved: (coords: Coordinates) => void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        query,
      )}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        onResolved({ latitude: +data[0].lat, longitude: +data[0].lon });
        return;
      }
    } catch {
      /* fall through to Kyiv default */
    } finally {
      setBusy(false);
    }
    onResolved(CITY_PRESETS[0].coords);
  }

  return (
    <div className={compact ? "" : "card p-4"}>
      {!compact && (
        <h3 className="mb-2 text-base font-bold">{t.nearby.manualTitle}</h3>
      )}
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder={t.nearby.manualPlaceholder}
          className="min-w-0 flex-1 rounded-xl border border-brand-100 bg-surface px-3 py-2.5 text-sm"
          aria-label={t.nearby.manualTitle}
        />
        <button onClick={search} disabled={busy} className="btn-brand px-4 py-2.5 text-sm">
          {busy ? t.hero.locating : t.nearby.manualApply}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {CITY_PRESETS.map((c) => (
          <button
            key={c.label}
            onClick={() => onResolved(c.coords)}
            className="chip-off text-xs"
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

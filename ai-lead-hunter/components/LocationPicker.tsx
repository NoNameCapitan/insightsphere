"use client";

import { useState } from "react";
import type { LocationMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RADIUS_OPTIONS } from "@/lib/options";

export type LocationValue = {
  mode: LocationMode;
  city: string;
  address: string;
  lat?: number;
  lng?: number;
  radiusKm: number;
};

const MODES: Array<{ value: LocationMode; label: string }> = [
  { value: "near_me", label: "Поруч зі мною" },
  { value: "city", label: "Місто" },
  { value: "address", label: "Район / адреса" },
];

export default function LocationPicker({
  value,
  onChange,
}: {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
}) {
  const [geoStatus, setGeoStatus] = useState<string>("");

  function requestLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("Геолокація недоступна. Використайте пошук за містом.");
      onChange({ ...value, mode: "city" });
      return;
    }
    setGeoStatus("Запитуємо доступ до геолокації…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoStatus("Локацію визначено ✓");
        onChange({
          ...value,
          mode: "near_me",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          radiusKm: value.radiusKm || 5,
        });
      },
      () => {
        setGeoStatus(
          "Доступ відхилено. Переходимо до пошуку за містом (Київ за замовчуванням).",
        );
        onChange({ ...value, mode: "city", lat: undefined, lng: undefined });
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  return (
    <div>
      <span className="label">Локація</span>
      <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => {
              if (m.value === "near_me") requestLocation();
              else
                onChange({
                  ...value,
                  mode: m.value,
                  // "Whole city" only makes sense for a city search.
                  radiusKm:
                    m.value !== "city" && value.radiusKm === 0
                      ? 5
                      : value.radiusKm,
                });
            }}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition",
              value.mode === m.value
                ? "bg-white text-ink shadow-sm"
                : "text-slate-500 hover:text-ink",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {value.mode === "near_me" && (
        <div className="mt-2 text-xs text-slate-500">
          {value.lat != null
            ? `Координати: ${value.lat.toFixed(3)}, ${value.lng?.toFixed(3)}`
            : geoStatus ||
              "Натисніть «Поруч зі мною», щоб дозволити геолокацію."}
        </div>
      )}

      {value.mode === "city" && (
        <input
          className="input mt-2"
          placeholder="Місто (напр. Київ)"
          value={value.city}
          onChange={(e) => onChange({ ...value, city: e.target.value })}
        />
      )}

      {value.mode === "address" && (
        <input
          className="input mt-2"
          placeholder="Район або адреса (напр. Позняки, Київ)"
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
        />
      )}

      <div className="mt-3">
        <span className="label">
          Радіус: {value.radiusKm ? `${value.radiusKm} км` : "усе місто"}
        </span>
        <div className="flex flex-wrap gap-1">
          {(value.mode === "city" ? [0, ...RADIUS_OPTIONS] : RADIUS_OPTIONS).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onChange({ ...value, radiusKm: r })}
              className={cn(
                "flex-1 rounded-md border px-2 py-1.5 text-sm font-medium transition",
                value.radiusKm === r
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
              )}
            >
              {r === 0 ? "Усе місто" : `${r} км`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

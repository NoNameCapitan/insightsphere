"use client";

// Free map fallback: Leaflet + OpenStreetMap tiles. Used when no Google Maps
// browser key is configured, so the map view works in demo and real mode alike.
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Lead, ScoreLabel } from "@/lib/types";

const PIN_COLOR: Record<ScoreLabel, string> = {
  hot: "#059669",
  warm: "#d97706",
  cold: "#0284c7",
  bad_fit: "#64748b",
};

const KYIV: [number, number] = [50.4501, 30.5234];

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

export default function OsmMap({
  leads,
  onSelect,
  center,
  radiusKm,
}: {
  leads: Lead[];
  onSelect: (lead: Lead) => void;
  center?: { lat: number; lng: number };
  radiusKm?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | null = null;
    import("leaflet")
      .then((mod) => {
        const L = mod.default ?? mod;
        if (cancelled || !ref.current) return;
        const pts = leads.filter((l) => l.lat != null && l.lng != null);
        map = L.map(ref.current, { scrollWheelZoom: false }).setView(
          center ? [center.lat, center.lng] : KYIV,
          12,
        );
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        const bounds = L.latLngBounds([]);
        if (center && radiusKm) {
          const circle = L.circle([center.lat, center.lng], {
            radius: radiusKm * 1000,
            color: "#16745b",
            weight: 1,
            fillOpacity: 0.04,
            dashArray: "4 4",
          }).addTo(map);
          bounds.extend(circle.getBounds());
        }
        for (const lead of pts) {
          const pos: [number, number] = [lead.lat!, lead.lng!];
          L.circleMarker(pos, {
            radius: 11,
            color: "#ffffff",
            weight: 2,
            fillColor: PIN_COLOR[lead.score.label],
            fillOpacity: 0.95,
          })
            .bindTooltip(
              `<b>${escapeHtml(lead.name)}</b><br/>Оцінка ${lead.score.total}/100`,
              { direction: "top", offset: [0, -8] },
            )
            .on("click", () => onSelect(lead))
            .addTo(map);
          bounds.extend(pos);
        }
        if (pts.length > 0) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
      })
      .catch(() => {
        if (!cancelled) setError("Не вдалося завантажити карту.");
      });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [leads, onSelect, center, radiusKm]);

  return (
    <div className="card overflow-hidden">
      {error && (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}
      <div ref={ref} className="z-0 h-[60vh] w-full" />
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
        {(
          [
            ["hot", "Гарячий"],
            ["warm", "Теплий"],
            ["cold", "Холодний"],
            ["bad_fit", "Слабкий"],
          ] as const
        ).map(([k, label]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ background: PIN_COLOR[k] }}
            />
            {label}
          </span>
        ))}
        <span className="ml-auto">Карта: OpenStreetMap</span>
      </div>
    </div>
  );
}

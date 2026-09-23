"use client";

import { useEffect, useRef, useState } from "react";
import type { Lead, ScoreLabel } from "@/lib/types";
import OsmMap from "./OsmMap";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

const PIN_COLOR: Record<ScoreLabel, string> = {
  hot: "#059669",
  warm: "#d97706",
  cold: "#0284c7",
  bad_fit: "#64748b",
};

const KYIV = { lat: 50.4501, lng: 30.5234 };

// Minimal structural types for the bits of the Google Maps JS API we use,
// so we don't need the full @types/google.maps dependency or `any`.
type LatLng = { lat: number; lng: number };
interface GMarker {
  addListener(ev: string, cb: () => void): void;
  setMap(map: unknown): void;
}
interface GBounds {
  extend(p: LatLng): void;
}
interface GMap {
  fitBounds(b: GBounds): void;
}
interface GoogleNS {
  maps: {
    Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap;
    Marker: new (opts: Record<string, unknown>) => GMarker;
    LatLngBounds: new () => GBounds;
    SymbolPath: { CIRCLE: number };
  };
}

function getGoogle(): GoogleNS | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { google?: GoogleNS }).google ?? null;
}

// Load the Google Maps JS API exactly once.
let mapsPromise: Promise<void> | null = null;
function loadMaps(key: string): Promise<void> {
  if (typeof window === "undefined")
    return Promise.reject(new Error("no window"));
  if (getGoogle()) return Promise.resolve();
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key,
    )}`;
    script.async = true;
    const timer = setTimeout(() => {
      script.remove();
      mapsPromise = null;
      reject(new Error("maps timeout"));
    }, 12000);
    script.onload = () => {
      clearTimeout(timer);
      if (getGoogle()?.maps?.Map) resolve();
      else {
        mapsPromise = null;
        script.remove();
        reject(new Error("maps unavailable"));
      }
    };
    script.onerror = () => {
      clearTimeout(timer);
      mapsPromise = null;
      script.remove();
      reject(new Error("maps load failed"));
    };
    document.head.appendChild(script);
  });
  return mapsPromise;
}

export default function MapView({
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
    if (!MAPS_KEY || !ref.current) return;
    setError(null);
    let cancelled = false;
    let markers: GMarker[] = [];

    loadMaps(MAPS_KEY)
      .then(() => {
        const g = getGoogle();
        if (cancelled || !ref.current || !g) return;
        const pts = leads.filter((l) => l.lat != null && l.lng != null);
        const center = pts.length
          ? { lat: pts[0].lat as number, lng: pts[0].lng as number }
          : KYIV;
        const map = new g.maps.Map(ref.current, {
          center,
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
        });
        const bounds = new g.maps.LatLngBounds();
        for (const lead of pts) {
          const pos = { lat: lead.lat as number, lng: lead.lng as number };
          const marker = new g.maps.Marker({
            position: pos,
            map,
            title: `${lead.name} · ${lead.score.total}`,
            icon: {
              path: g.maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: PIN_COLOR[lead.score.label],
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
            label: {
              text: String(lead.score.total),
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: "bold",
            },
          });
          marker.addListener("click", () => onSelect(lead));
          markers.push(marker);
          bounds.extend(pos);
        }
        if (pts.length > 1) map.fitBounds(bounds);
      })
      .catch(() => {
        if (!cancelled) setError("Не вдалося завантажити карту.");
      });

    return () => {
      cancelled = true;
      markers.forEach((m) => m.setMap(null));
      markers = [];
    };
  }, [leads, onSelect]);

  // No Google key: a free OpenStreetMap map keeps the map view working.
  if (!MAPS_KEY)
    return (
      <OsmMap
        leads={leads}
        onSelect={onSelect}
        center={center}
        radiusKm={radiusKm}
      />
    );

  return (
    <div className="card overflow-hidden">
      {error && (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}
      <div ref={ref} className="h-[60vh] w-full" />
    </div>
  );
}

export const GOOGLE_MAPS_AVAILABLE = !!MAPS_KEY;

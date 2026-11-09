"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { CATEGORY_COLOR, CATEGORY_EMOJI, CATEGORY_LABELS } from "@/lib/labels";
import { isDemoPlace } from "@/lib/data/provenance";
import type { KyivShelter } from "@/lib/safety/types";
import type { Coordinates, PlaceWithDistance } from "@/lib/types";

const KYIV: Coordinates = { latitude: 50.4501, longitude: 30.5234 };

function placeIcon(place: PlaceWithDistance, active: boolean): L.DivIcon {
  const emergency = place.emergencyAvailable || place.isOpen24_7;
  const ring = emergency ? "#E11D48" : CATEGORY_COLOR[place.category];
  const size = active ? 46 : (emergency ? 40 : 36);
  return L.divIcon({
    className: "vetnear-pin",
    html: `<div style="
        width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);background:#fff;border:2px solid ${ring};
        box-shadow:0 4px 10px rgba(15,42,46,.25);display:grid;place-items:center;">
        <span style="transform:rotate(45deg);font-size:${active ? 20 : 16}px;line-height:1;">
          ${CATEGORY_EMOJI[place.category]}
        </span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

let _userIcon: L.DivIcon | null = null;
function userIcon(): L.DivIcon {
  if (!_userIcon) {
    _userIcon = L.divIcon({
      className: "vetnear-user",
      html: `<div style="position:relative;width:20px;height:20px;">
          <span style="position:absolute;inset:0;border-radius:50%;background:#0B6B62;opacity:.25;
            animation:vnpulse 2s infinite ease-out;"></span>
          <span style="position:absolute;inset:5px;border-radius:50%;background:#0B6B62;border:2px solid #fff;"></span>
        </div>
        <style>@keyframes vnpulse{0%{transform:scale(1);opacity:.4}100%{transform:scale(2.4);opacity:0}}</style>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }
  return _userIcon;
}

let _shelterIcon: L.DivIcon | null = null;
function shelterIcon(): L.DivIcon {
  if (!_shelterIcon) {
    _shelterIcon = L.divIcon({
      className: "vetnear-shelter-pin",
      html: `<div style="width:38px;height:38px;border-radius:12px;background:#7f1d1d;border:2px solid #fff;box-shadow:0 4px 12px rgba(127,29,29,.35);display:grid;place-items:center;color:#fff;font-size:20px;">⌂</div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
      popupAnchor: [0, -20],
    });
  }
  return _shelterIcon;
}

function walkingRoute(shelter: KyivShelter): string {
  const destination = encodeURIComponent(`${shelter.latitude},${shelter.longitude}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;
}

function Recenter({ center, zoom }: { center: Coordinates; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.latitude, center.longitude], zoom, { animate: true });
  }, [map, center.latitude, center.longitude, zoom]);
  return null;
}

function FitSafetyRoute({ origin, shelter }: { origin: Coordinates; shelter: KyivShelter }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(
      L.latLngBounds([
        L.latLng(origin.latitude, origin.longitude),
        L.latLng(shelter.latitude, shelter.longitude),
      ]),
      { padding: [48, 48], maxZoom: 16 },
    );
  }, [map, origin.latitude, origin.longitude, shelter.latitude, shelter.longitude]);
  return null;
}

/** Draws a route from origin to dest. Tries OSRM; falls back to a straight line. */
function Routing({
  origin,
  dest,
}: {
  origin: Coordinates;
  dest: Coordinates;
}) {
  const [line, setLine] = useState<[number, number][]>([
    [origin.latitude, origin.longitude],
    [dest.latitude, dest.longitude],
  ]);
  const [routed, setRouted] = useState(false);
  const map = useMap();

  useEffect(() => {
    let cancelled = false;
    const straight: [number, number][] = [
      [origin.latitude, origin.longitude],
      [dest.latitude, dest.longitude],
    ];
    setLine(straight);
    setRouted(false);

    (async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${dest.longitude},${dest.latitude}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("routing unavailable");
        const data = await res.json();
        const coords: [number, number][] =
          data?.routes?.[0]?.geometry?.coordinates?.map(
            (c: [number, number]) => [c[1], c[0]],
          ) ?? straight;
        if (!cancelled) {
          setLine(coords);
          setRouted(true);
        }
      } catch {
        // Keep the straight-line fallback; external "Open route" link still works.
        if (!cancelled) setRouted(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [origin.latitude, origin.longitude, dest.latitude, dest.longitude]);

  useEffect(() => {
    const bounds = L.latLngBounds(line.map(([a, b]) => L.latLng(a, b)));
    map.fitBounds(bounds, { padding: [48, 48] });
  }, [map, line]);

  return (
    <Polyline
      positions={line}
      pathOptions={{
        color: "#0B6B62",
        weight: 5,
        opacity: 0.85,
        dashArray: routed ? undefined : "8 10",
      }}
    />
  );
}

export default function MapView({
  places,
  origin,
  center,
  zoom = 13,
  activeId,
  routeTo,
  shelters = [],
  selectedShelterId,
  onSelectShelter,
  onSelect,
}: {
  places: PlaceWithDistance[];
  origin?: Coordinates | null;
  center?: Coordinates | null;
  zoom?: number;
  activeId?: string | null;
  routeTo?: PlaceWithDistance | null;
  shelters?: KyivShelter[];
  selectedShelterId?: string | null;
  onSelectShelter?: (id: string) => void;
  onSelect?: (id: string) => void;
}) {
  const c = center || origin || KYIV;
  const selectedShelter = shelters.find((shelter) => shelter.id === selectedShelterId) ?? shelters[0] ?? null;
  return (
    <MapContainer
      center={[c.latitude, c.longitude]}
      zoom={zoom}
      scrollWheelZoom
      className="h-full w-full"
      aria-label="map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter center={c} zoom={zoom} />

      {origin && <Marker position={[origin.latitude, origin.longitude]} icon={userIcon()} />}

      {places.map((p) => (
        <Marker
          key={p.id}
          position={[p.latitude, p.longitude]}
          icon={placeIcon(p, p.id === activeId)}
          eventHandlers={{ click: () => onSelect?.(p.id) }}
        >
          <Popup>
            <strong>{p.name}</strong>
            <br />
            {CATEGORY_LABELS[p.category]}
            {isDemoPlace(p) && (
              <span style={{ display: "block", color: "#B45309", fontSize: 11, marginTop: 2 }}>
                Демо-дані — телефонуйте, щоб підтвердити
              </span>
            )}
          </Popup>
        </Marker>
      ))}

      {shelters.map((shelter) => (
        <Marker
          key={`shelter-${shelter.id}`}
          position={[shelter.latitude, shelter.longitude]}
          icon={shelterIcon()}
          eventHandlers={{ click: () => onSelectShelter?.(shelter.id) }}
          zIndexOffset={1000}
        >
          <Popup>
            <strong>Укриття · {shelter.address}</strong>
            <br />
            <span>{shelter.shelterType ?? "Тип не вказано"}</span>
            <br />
            <span>{shelter.declaredOpen24h ? "У наборі: цілодобово" : "Графік потребує перевірки"}</span>
            <br />
            <a href={walkingRoute(shelter)} target="_blank" rel="noopener noreferrer">
              Відкрити піший маршрут ↗
            </a>
          </Popup>
        </Marker>
      ))}

      {origin && selectedShelter && (
        <>
          <FitSafetyRoute origin={origin} shelter={selectedShelter} />
          <Polyline
            positions={[
              [origin.latitude, origin.longitude],
              [selectedShelter.latitude, selectedShelter.longitude],
            ]}
            pathOptions={{ color: "#B91C1C", weight: 4, opacity: 0.85, dashArray: "7 8" }}
          />
        </>
      )}

      {origin && routeTo && (
        <Routing
          origin={origin}
          dest={{ latitude: routeTo.latitude, longitude: routeTo.longitude }}
        />
      )}
    </MapContainer>
  );
}

"use client";

import dynamic from "next/dynamic";
import { PLACES } from "@/lib/data/places";
import { regionOf } from "@/config/coverage";
import type { PlaceRegion, PlaceWithDistance } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-brand-50" />,
});

const PLACES_WD: PlaceWithDistance[] = PLACES.map((p) => ({ ...p, distanceMeters: null }));

export function MapEmbed({ region }: { region?: PlaceRegion }) {
  const places = region ? PLACES_WD.filter((place) => regionOf(place) === region) : PLACES_WD;
  return (
    <div className="h-[65vh] w-full overflow-hidden rounded-3xl border border-brand-100">
      <MapView places={places} zoom={11} />
    </div>
  );
}

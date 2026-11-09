"use client";

import dynamic from "next/dynamic";
import type { PlaceWithDistance } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full animate-pulse rounded-3xl bg-brand-50" />
  ),
});

/** Single-place map used on the details page (no user origin required). */
export function PlaceDetailMap({ place }: { place: PlaceWithDistance }) {
  return (
    <div className="h-64 w-full overflow-hidden rounded-3xl border border-brand-100">
      <MapView
        places={[place]}
        center={{ latitude: place.latitude, longitude: place.longitude }}
        zoom={15}
        activeId={place.id}
      />
    </div>
  );
}

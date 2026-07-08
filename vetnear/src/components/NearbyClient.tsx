"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ActivePetSelector } from "@/components/ActivePetSelector";
import { FiltersBar } from "@/components/Filters";
import { GeoFallback } from "@/components/GeoFallback";
import { Disclaimer } from "@/components/JsonLd";
import { PlaceCard } from "@/components/PlaceCard";
import { PLACES } from "@/lib/data/places";
import { EMERGENCY_EMPTY_STATE } from "@/lib/data/verification";
import { RadiusSelector } from "@/components/RadiusSelector";
import { track } from "@/lib/analytics";
import { DEFAULT_FILTERS, getRecommendedPlaces } from "@/lib/geo/ranking";
import { t } from "@/lib/i18n";
import { CATEGORY_LABELS } from "@/lib/labels";
import { getActivePet } from "@/lib/pets/store";
import { getPlaces } from "@/lib/store";
import type {
  AnimalType,
  FilterState,
  PetProfile,
  Place,
  PlaceCategory,
  RadiusMeters,
} from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-brand-50" />,
});

const VALID_RADII: RadiusMeters[] = [1000, 2000, 3000, 5000, 10000];

function seedFilters(params: URLSearchParams): FilterState {
  const f = { ...DEFAULT_FILTERS };
  // accept both ?category= and legacy ?type=
  const category = (params.get("category") || params.get("type")) as
    | PlaceCategory
    | null;
  if (category) f.category = category;
  const animal = params.get("animal") as AnimalType | null;
  if (animal) f.animal = animal;
  const district = params.get("district") as FilterState["district"] | null;
  if (district) f.district = district;
  const radius = Number(params.get("radius")) as RadiusMeters;
  if (VALID_RADII.includes(radius)) f.radius = radius;
  if (params.get("emergency") === "1") f.emergency = true;
  const sort = params.get("sort");
  if (sort) f.sort = sort as FilterState["sort"];
  return f;
}

export function NearbyClient() {
  const params = useSearchParams();
  const geo = useGeo();
  const [filters, setFilters] = useState<FilterState>(() => seedFilters(params));
  const [pet, setPet] = useState<PetProfile | null>(null);
  const [view, setView] = useState<"list" | "map">("list");

  // Start from the deterministic seed dataset so server and client render the
  // same HTML, then merge localStorage additions (approved submissions, admin
  // edits) after mount — otherwise an approved local place causes a hydration
  // mismatch on this page.
  const [allPlaces, setAllPlaces] = useState<Place[]>(PLACES);

  useEffect(() => {
    setPet(getActivePet());
    setAllPlaces(getPlaces());
    track("nearby_search_started", { category: filters.category });
    if (geo.status === "idle" && !geo.coords) geo.request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const result = useMemo(
    () => getRecommendedPlaces(allPlaces, geo.coords, { pet, filters }),
    [allPlaces, geo.coords, pet, filters],
  );

  const emergencyMode =
    filters.emergency || filters.category === "emergency_vet";

  const update = (patch: Partial<FilterState>) =>
    setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="container-px mx-auto max-w-3xl py-4">
      {emergencyMode && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-emergency px-4 py-3 text-white">
          <span aria-hidden className="text-xl">🚑</span>
          <p className="text-sm font-medium">
            У цій версії VetNear показує найближчі ветклініки. Цілодобові/термінові
            провайдери додаються тільки після підтвердження дзвінком. При загрозі життю
            телефонуйте у клініку напряму негайно.
          </p>
        </div>
      )}

      <div className="mb-3">
        <ActivePetSelector onChange={setPet} />
      </div>

      <div className="space-y-3">
        <RadiusSelector value={filters.radius} onChange={(r) => update({ radius: r })} />
        <FiltersBar filters={filters} onChange={update} onReset={() => setFilters(DEFAULT_FILTERS)} />
      </div>

      <div className="my-3 flex items-center justify-between">
        <p className="text-sm text-ink/60">
          Знайдено: <strong className="text-ink">{result.places.length}</strong>
          {filters.category !== "all" && ` · ${CATEGORY_LABELS[filters.category]}`}
        </p>
        <div className="flex overflow-hidden rounded-xl border border-brand-100">
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1.5 text-sm transition-colors ${view === "list" ? "bg-brand text-white" : "text-ink/60 hover:bg-brand-50 hover:text-brand-700"}`}
          >
            Список
          </button>
          <button
            onClick={() => setView("map")}
            className={`px-3 py-1.5 text-sm transition-colors ${view === "map" ? "bg-brand text-white" : "text-ink/60 hover:bg-brand-50 hover:text-brand-700"}`}
          >
            Карта
          </button>
        </div>
      </div>

      {result.expandedFrom && (
        <p className="mb-3 rounded-2xl bg-amber/10 px-4 py-2 text-sm text-amber">
          Нічого не знайдено в межах {result.expandedFrom / 1000} км. Показуємо
          найближчі в межах {result.appliedRadius / 1000} км.
        </p>
      )}

      <Disclaimer text={t.disclaimer} className="mb-3" />

      {(geo.status === "denied" || geo.status === "unavailable") && (
        <div className="mb-3">
          <GeoFallback onResolved={geo.setManual} />
        </div>
      )}

      {view === "map" ? (
        <div className="h-[60vh] w-full overflow-hidden rounded-3xl border border-brand-100">
          <MapView
            places={result.places}
            origin={geo.coords}
            zoom={13}
          />
        </div>
      ) : result.places.length === 0 ? (
        <div className="rounded-3xl border border-brand-100 bg-surface p-8 text-center">
          {emergencyMode ? (
            <p className="text-ink/60">{EMERGENCY_EMPTY_STATE}</p>
          ) : (
            <>
              <p aria-hidden className="text-3xl">🐾</p>
              <p className="mt-3 font-display font-bold text-ink">
                За цими фільтрами нічого не знайдено
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink/60">
                Спробуйте збільшити радіус, змінити категорію або скинути фільтри —
                і ми покажемо всі місця поруч.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="btn btn-brand py-2 text-sm"
                >
                  Скинути фільтри
                </button>
                <button
                  onClick={() => setFilters({ ...DEFAULT_FILTERS, radius: 10000 })}
                  className="btn btn-ghost py-2 text-sm"
                >
                  Показати всі місця поруч
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {result.places.map((p) => (
            <li key={p.id}>
              <PlaceCard place={p} origin={geo.coords} emergencyMode={emergencyMode} petAnimal={pet?.animalType} />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 text-center text-xs text-ink/40" role="status">
        {geo.status === "prompting" && !geo.coords ? (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
            Визначаємо вашу локацію…
          </span>
        ) : geo.coords ? (
          "Локацію визначено"
        ) : (
          "Локація не визначена — увімкніть геолокацію або оберіть район"
        )}
      </div>
    </div>
  );
}

// local import kept at bottom to avoid clutter
import { useGeolocation as useGeo } from "@/hooks/useGeolocation";
